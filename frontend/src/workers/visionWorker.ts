/**
 * Vision Web Worker — owns PoseLandmarker inference and squat kinematics.
 *
 * The main React thread never touches MediaPipe: it only transfers `ImageBitmap`
 * frames here and receives lightweight landmark/state JSON back. Inference is
 * synchronous inside this worker, so it can never block the UI thread.
 */

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

import { getEngine, type ExerciseState } from './kinematicsEngine';
import type {
  LandmarkPoint,
  MovementPattern,
  VisionWorkerRequest,
  VisionWorkerResponse,
} from './visionProtocol';

/**
 * Minimal dedicated-worker surface. Declared locally instead of pulling in the
 * `webworker` lib so this file type-checks cleanly under the DOM project config.
 */
interface WorkerLikeScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<VisionWorkerRequest>) => void,
  ): void;
}

const ctx = self as unknown as WorkerLikeScope;

/**
 * Absolute origin so local paths resolve even when this worker is
 * instantiated as a blob: URL by Vite (relative paths would fail).
 */
const origin = self.location.origin;

/** Served from `public/mediapipe/tasks-vision/` (see scripts/setup-mediapipe.mjs). */
const WASM_BASE_PATH = `${origin}/mediapipe/tasks-vision/wasm`;
const MODEL_ASSET_PATH = `${origin}/mediapipe/tasks-vision/pose_landmarker_lite.task`;

const post = (message: VisionWorkerResponse): void => {
  ctx.postMessage(message);
};

let poseLandmarker: PoseLandmarker | null = null;
let movementPattern: MovementPattern = 'squat';
let currentState: ExerciseState = { phase: 'get_ready', repCount: 0 };
let lastFrameTimestampMs = 0;

/**
 * FPS telemetry — privacy first.
 *
 * Only aggregate performance numbers are ever reported. We derive a rolling
 * FPS from the inter-frame deltas of the monotonic `timestampMs` the main
 * thread stamps on each frame (both clocks are `performance.now()`), post a
 * `TELEMETRY` message every few seconds, and the main thread forwards it as
 * an anonymized Sentry breadcrumb. No frame data, landmarks, or PII ever
 * leave the worker.
 */
const FPS_WINDOW_SIZE = 60;
const FPS_REPORT_INTERVAL_MS = 5000;
let fpsWindow: number[] = [];
let lastFrameTimestamp = 0;
let lastTelemetryTimestamp = 0;
let framesProcessed = 0;

function recordFrameFps(timestampMs: number): void {
  framesProcessed += 1;
  if (lastFrameTimestamp > 0) {
    const deltaMs = timestampMs - lastFrameTimestamp;
    if (deltaMs > 0) {
      fpsWindow.push(1000 / deltaMs);
      if (fpsWindow.length > FPS_WINDOW_SIZE) {
        fpsWindow.shift();
      }
    }
  }
  lastFrameTimestamp = timestampMs;

  if (timestampMs - lastTelemetryTimestamp >= FPS_REPORT_INTERVAL_MS) {
    const avgFps =
      fpsWindow.reduce((sum, value) => sum + value, 0) /
      Math.max(1, fpsWindow.length);
    post({
      type: 'TELEMETRY',
      fps: Math.round(avgFps * 10) / 10,
      framesProcessed,
    });
    lastTelemetryTimestamp = timestampMs;
  }
}

function toPoints(landmarks: NormalizedLandmark[]): LandmarkPoint[] {
  return landmarks.map((landmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }));
}

async function initPoseLandmarker(): Promise<void> {
  // Emscripten-compiled WASM glue references debug helpers that are absent
  // in an ES Module worker environment. Stub them out before the WASM module
  // is loaded to prevent "custom_dbg is not defined" runtime crashes.
  const s = self as unknown as Record<string, unknown>;
  if (typeof s.custom_dbg === 'undefined') {
    s.custom_dbg = function () {};
  }
  if (typeof s.custom_trace === 'undefined') {
    s.custom_trace = function () {};
  }

  // In an ES Module Worker, `var ModuleFactory` inside vision_wasm_internal.js
  // is scoped to the module and never leaks onto `self`.  We fetch the script
  // text, append an ES export, wrap it in a Blob URL, and import() it so we
  // can grab the factory and place it on the global scope where MediaPipe
  // expects to find it.
  const w = self as unknown as Record<string, unknown>;
  if (!w.ModuleFactory) {
    try {
      const wasmJsUrl = `${origin}/mediapipe/tasks-vision/wasm/vision_wasm_internal.js`;
      const response = await fetch(wasmJsUrl);
      const scriptText = await response.text();

      const blob = new Blob([scriptText + '\nexport default ModuleFactory;'], {
        type: 'application/javascript',
      });
      const blobUrl = URL.createObjectURL(blob);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wasmModule: any = await import(/* @vite-ignore */ blobUrl);
      w.ModuleFactory = wasmModule.default;
    } catch (e) {
      console.error('Failed to bridge MediaPipe WASM:', e);
    }
  }

  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
      // CPU is portable (workers, WebViews) and deterministic; GPU can be
      // enabled later once per-device profiling is in place.
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  post({ type: 'READY' });
}

function handleFrame(request: Extract<VisionWorkerRequest, { type: 'FRAME' }>): void {
  if (!poseLandmarker) {
    // Main thread gates frames on READY, so this is defensive only.
    request.bitmap.close();
    return;
  }
  try {
    const result = poseLandmarker.detectForVideo(
      request.bitmap,
      request.timestampMs,
    );
    recordFrameFps(request.timestampMs);
    const rawLandmarks = result.landmarks?.[0] ?? null;
    const points = rawLandmarks ? toPoints(rawLandmarks) : null;

    const deltaMs = lastFrameTimestampMs > 0
      ? Math.max(0, request.timestampMs - lastFrameTimestampMs)
      : 0;
    const engine = getEngine(movementPattern);
    const analysis = engine.analyzeFrame(points, currentState, deltaMs);
    currentState = analysis.nextState;
    lastFrameTimestampMs = request.timestampMs;

    post({
      type: 'RESULTS',
      frame: {
        landmarks: analysis.detected ? toPoints(rawLandmarks ?? []) : null,
        repCount: analysis.repCount,
        phase: analysis.phase,
        warning: analysis.warning,
      },
    });
  } catch (error) {
    post({
      type: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    request.bitmap.close();
  }
}

ctx.addEventListener('message', (event) => {
  const request = event.data;
  if (request.type === 'INIT') {
    movementPattern = request.movementPattern;
    currentState = getEngine(movementPattern).initialState();
    lastFrameTimestampMs = 0;
  } else if (request.type === 'FRAME') {
    handleFrame(request);
  }
});

void initPoseLandmarker().catch((error: unknown) => {
  post({
    type: 'ERROR',
    message:
      error instanceof Error
        ? `MediaPipe init failed: ${error.message}`
        : `MediaPipe init failed: ${String(error)}`,
  });
});
