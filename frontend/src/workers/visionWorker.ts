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

import {
  analyzeSquatFrame,
  createInitialSquatState,
  type SquatState,
} from './squatKinematics';
import type {
  LandmarkPoint,
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

/** Served from `public/mediapipe/tasks-vision/` (see scripts/setup-mediapipe.mjs). */
const WASM_BASE_PATH = '/mediapipe/tasks-vision/wasm';
const MODEL_ASSET_PATH = '/mediapipe/tasks-vision/pose_landmarker_lite.task';

const post = (message: VisionWorkerResponse): void => {
  ctx.postMessage(message);
};

let poseLandmarker: PoseLandmarker | null = null;
let squatState: SquatState = createInitialSquatState();

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

    const analysis = analyzeSquatFrame(
      rawLandmarks ? toPoints(rawLandmarks) : null,
      squatState,
    );
    squatState = analysis.nextState;

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
  if (request.type === 'FRAME') {
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
