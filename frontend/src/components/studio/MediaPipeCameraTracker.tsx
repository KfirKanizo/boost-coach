import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, ShieldAlert, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/client';
import {
  reportVisionFps,
  reportVisionSessionFps,
} from '../../services/telemetry';
import type {
  LandmarkPoint,
  SquatPhase,
  SquatWarning,
  VisionWorkerResponse,
} from '../../workers/visionProtocol';
import { SkeletonOverlay } from './SkeletonOverlay';

interface MediaPipeCameraTrackerProps {
  /** Countdown length in seconds; mirrors `target_metrics.duration_sec`. */
  durationSec?: number;
  /**
   * DailyBoost id to report completion to once the session finishes. Omitted
   * in preview mode. Offline completions are queued and flushed on reconnect.
   */
  boostId?: string;
}

type TrackerStatus =
  | 'initializing'
  | 'loading'
  | 'tracking'
  | 'done'
  | 'error';

const DEFAULT_DURATION_SEC = 60;
/** How long the "Set complete" victory overlay stays up before navigating home. */
const VICTORY_DELAY_MS = 1500;
/** Front camera suits self-correcting form feedback; flip to 'environment' to track from behind. */
const CAMERA_FACING_MODE: 'user' | 'environment' = 'user';

const PHASE_LABELS: Record<SquatPhase, string> = {
  get_ready: 'GET READY',
  squat: 'SQUAT',
  stand_up: 'STAND UP',
};

function formatTime(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * VISION_REP execution environment.
 *
 * The main thread only captures camera frames, transfers them to the vision
 * worker as `ImageBitmap`s, and renders the lightweight results the worker
 * posts back. All MediaPipe inference runs off-thread — this component never
 * imports `@mediapipe/tasks-vision`.
 */
export function MediaPipeCameraTracker({
  durationSec = DEFAULT_DURATION_SEC,
  boostId,
}: MediaPipeCameraTrackerProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TrackerStatus>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<SquatPhase>('get_ready');
  const [warning, setWarning] = useState<SquatWarning | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkPoint[] | null>(null);
  const [remainingSec, setRemainingSec] = useState(durationSec);
  const [aspectRatio, setAspectRatio] = useState(3 / 4);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerReadyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const processingRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  /**
   * Anonymous FPS samples reported by the worker during this session. Only
   * the average is ever reported to Sentry — no frames, landmarks, or PII.
   */
  const sessionFpsSamplesRef = useRef<number[]>([]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /** Grab the newest video frame and hand it to the worker (max 1 in flight). */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const worker = workerRef.current;
    if (!video || !worker || !workerReadyRef.current) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    if (processingRef.current || captureInFlightRef.current) return;

    captureInFlightRef.current = true;
    createImageBitmap(video)
      .then((bitmap) => {
        captureInFlightRef.current = false;
        processingRef.current = true;
        worker.postMessage(
          { type: 'FRAME', bitmap, timestampMs: performance.now() },
          [bitmap],
        );
      })
      .catch(() => {
        captureInFlightRef.current = false;
      });
  }, []);

  const startCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      if (mountedRef.current) {
        setErrorMessage('Camera API is not available in this browser.');
        setStatus('error');
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: CAMERA_FACING_MODE },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      video.muted = true;
      video.srcObject = stream;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise.catch((error: unknown) => {
          console.warn('Video play interrupted, likely by React re-render:', error);
        });
      }

      if (!mountedRef.current) return;
      cameraReadyRef.current = true;
      setStatus((current) =>
        current === 'error' || current === 'done'
          ? current
          : workerReadyRef.current
            ? 'tracking'
            : 'loading',
      );
      captureFrame();
    } catch (error) {
      if (!mountedRef.current) return;
      setErrorMessage(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Camera access denied. Enable the camera permission and retry.'
          : error instanceof Error
            ? error.message
            : String(error),
      );
      setStatus('error');
    }
  }, [captureFrame]);

  const createWorker = useCallback(() => {
    const worker = new Worker(
      new URL('../../workers/visionWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<VisionWorkerResponse>) => {
      const message = event.data;

      if (message.type === 'READY') {
        workerReadyRef.current = true;
        setStatus((current) =>
          current === 'error' || current === 'done'
            ? current
            : cameraReadyRef.current
              ? 'tracking'
              : 'loading',
        );
        captureFrame();
      } else if (message.type === 'RESULTS') {
        processingRef.current = false;
        setRepCount(message.frame.repCount);
        setPhase(message.frame.phase);
        setWarning(message.frame.warning);
        setLandmarks(message.frame.landmarks);
        captureFrame();
      } else if (message.type === 'TELEMETRY') {
        // Privacy first: only anonymous aggregate FPS is forwarded — never
        // frames, landmark data, or any user-identifiable information.
        sessionFpsSamplesRef.current.push(message.fps);
        reportVisionFps(message.fps);
      } else if (message.type === 'ERROR') {
        processingRef.current = false;
        setErrorMessage(message.message);
        setStatus('error');
        stopCamera();
      }
    };

    worker.onerror = (event) => {
      processingRef.current = false;
      setErrorMessage(event.message || 'Vision worker crashed.');
      setStatus('error');
      stopCamera();
    };
  }, [captureFrame, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    createWorker();
    return () => {
      mountedRef.current = false;
      workerRef.current?.terminate();
      workerRef.current = null;
      stopCamera();
    };
  }, [createWorker, startCamera, stopCamera]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateAspectRatio = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    };
    video.addEventListener('loadedmetadata', updateAspectRatio);
    return () => video.removeEventListener('loadedmetadata', updateAspectRatio);
  }, []);

  useEffect(() => {
    if (status !== 'tracking') return;
    const id = window.setInterval(() => {
      setRemainingSec((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === 'tracking' && remainingSec === 0) {
      setStatus('done');
      stopCamera();
    }
  }, [remainingSec, status, stopCamera]);

  const completeSession = useCallback(async () => {
    if (!boostId) return;
    try {
      const result = await api.completeBoost(boostId, {
        reps_completed: repCount,
        duration_sec: durationSec,
      });
      setQueuedOffline(result.queued);
    } catch {
      // Non-network failure (e.g. unknown boost); the session stays complete.
    }
  }, [boostId, durationSec, repCount]);

  useEffect(() => {
    if (status !== 'done' || completedRef.current) return;
    completedRef.current = true;
    setQueuedOffline(false);
    const samples = sessionFpsSamplesRef.current;
    if (samples.length > 0) {
      const avgFps =
        samples.reduce((sum, value) => sum + value, 0) / samples.length;
      reportVisionSessionFps(avgFps);
    }
    void completeSession();
  }, [status, completeSession]);

  // In a real session the victory overlay stays up 1.5s before returning home.
  useEffect(() => {
    if (status !== 'done' || !boostId) return;
    const id = window.setTimeout(() => navigate('/'), VICTORY_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [status, boostId, navigate]);

  const handleRetry = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    workerReadyRef.current = false;
    cameraReadyRef.current = false;
    processingRef.current = false;
    captureInFlightRef.current = false;
    completedRef.current = false;
    sessionFpsSamplesRef.current = [];
    setErrorMessage(null);
    setRepCount(0);
    setPhase('get_ready');
    setWarning(null);
    setLandmarks(null);
    setQueuedOffline(false);
    setRemainingSec(durationSec);
    setStatus('initializing');
    void startCamera();
    createWorker();
  }, [createWorker, durationSec, startCamera]);

  const progressPct =
    durationSec > 0 ? Math.min(100, (remainingSec / durationSec) * 100) : 0;

  return (
    <div
      className="relative w-full overflow-hidden rounded-card bg-black"
      style={{ aspectRatio }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
        aria-label="Live camera feed"
      />
      <SkeletonOverlay landmarks={landmarks} warning={warning} />

      {/* Top HUD */}
      <div className="absolute left-0 right-0 top-0 z-40 flex items-start justify-between p-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-paper drop-shadow">
            Vision Boost
          </h2>
          <span className="mt-1 inline-block rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon">
            VISION_REP
          </span>
        </div>
        <div className="text-right">
          <div className="font-timer text-3xl font-bold leading-none text-paper drop-shadow">
            {formatTime(remainingSec)}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ash">
            time
          </div>
        </div>
      </div>

      {/* Live rep + phase HUD */}
      {status === 'tracking' && (
        <>
          <div className="absolute bottom-16 left-4 z-40">
            <div className="font-timer text-5xl font-bold leading-none text-neon drop-shadow">
              {repCount}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ash">
              reps
            </div>
          </div>
          <div className="absolute bottom-16 right-4 z-40 rounded-full border border-white/10 bg-ink/70 px-4 py-1.5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-widest text-paper">
              {PHASE_LABELS[phase]}
            </span>
          </div>
        </>
      )}

      {/* Posture warning */}
      {status === 'tracking' && warning === 'knee_valgus' && (
        <div className="absolute bottom-24 left-0 right-0 z-40 mx-4 flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/15 px-3 py-2 backdrop-blur">
          <ShieldAlert size={14} className="shrink-0 text-crimson" />
          <span className="text-xs font-semibold text-paper">
            Knees caving in — press them outward
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-40 h-1.5 bg-white/10">
        <div
          className="h-full bg-neon transition-all duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Loading overlay */}
      {(status === 'initializing' || status === 'loading') && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-neon/30 bg-neon/10">
            <Camera size={24} className="animate-pulse text-neon" />
          </div>
          <p className="text-sm font-semibold text-paper">
            {status === 'initializing'
              ? 'Requesting camera…'
              : 'Loading motion model…'}
          </p>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
          <ShieldAlert size={28} className="text-crimson" />
          <p className="max-w-[280px] text-sm leading-relaxed text-paper">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-1 flex items-center gap-2 rounded-full bg-neon px-6 py-2.5 text-sm font-bold text-ink transition-transform active:scale-95"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {/* Completed overlay */}
      {status === 'done' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
          <Trophy size={28} className="text-neon" />
          <p className="font-display text-lg font-bold text-paper">
            Set complete
          </p>
          <p className="text-sm text-ash">
            {repCount} {repCount === 1 ? 'rep' : 'reps'} counted
          </p>
          {boostId && (
            <p className="rounded-full border border-white/10 bg-ink/70 px-3 py-1 text-[11px] font-semibold text-ash backdrop-blur">
              {queuedOffline
                ? 'Saved locally — will sync when back online'
                : 'Progress saved to your profile'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
