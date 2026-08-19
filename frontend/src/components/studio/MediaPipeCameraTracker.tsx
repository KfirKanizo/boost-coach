import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Flag,
  Pause,
  Play,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/client';
import {
  type ExerciseConfig,
  getExerciseConfig,
  setExerciseConfig,
} from '../../services/exerciseConfig';
import {
  reportVisionFps,
  reportVisionSessionFps,
} from '../../services/telemetry';
import type {
  LandmarkPoint,
  ExercisePhase,
  ExerciseWarning,
  MovementPattern,
  VisionWorkerResponse,
} from '../../workers/visionProtocol';
import { ExerciseConfigModal } from './ExerciseConfigModal';
import { SkeletonOverlay } from './SkeletonOverlay';

interface MediaPipeCameraTrackerProps {
  /** Countdown length (seconds); mirrors `target_metrics.duration_sec`. */
  durationSec?: number;
  /**
   * DailyBoost id to report completion to once the session finishes. Omitted
   * in preview mode. Offline completions are queued and flushed on reconnect.
   */
  boostId?: string;
  /** Exercise id for per-exercise config persistence. */
  exerciseId?: string;
  /** Display name shown on the HUD and config modal. */
  exerciseName?: string;
  /** Movement pattern routed to the correct kinematics module. */
  movementPattern?: MovementPattern;
}

type TrackerStatus =
  | 'initializing'
  | 'loading'
  | 'ready'
  | 'active'
  | 'paused'
  | 'done'
  | 'error';

/** How long the "Set complete" victory overlay stays up before navigating home. */
const VICTORY_DELAY_MS = 1500;
/** Front camera suits self-correcting form feedback. */
const CAMERA_FACING_MODE: 'user' | 'environment' = 'user';

const PHASE_LABELS: Record<ExercisePhase, string> = {
  get_ready: 'GET READY',
  squat: 'SQUAT',
  stand_up: 'STAND UP',
  down: 'DOWN',
  up: 'UP',
  holding: 'HOLDING',
};

function formatTime(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * VISION_REP execution environment.
 *
 * Lifecycle: initializing → loading → ready → active → paused → done
 *
 * - **ready**: camera on, MediaPipe tracking, but timer hasn't started.
 *              Waiting for the first rep. Settings icon visible.
 * - **active**: first rep detected; timer ticking, reps counting.
 * - **paused**: user tapped pause; timer frozen.
 */
export function MediaPipeCameraTracker({
  durationSec = 60,
  boostId,
  exerciseId,
  exerciseName = 'Vision Boost',
  movementPattern = 'squat',
}: MediaPipeCameraTrackerProps) {
  const navigate = useNavigate();

  // ── status ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState<TrackerStatus>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── workout metrics ─────────────────────────────────────────────────
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<ExercisePhase>('get_ready');
  const [warning, setWarning] = useState<ExerciseWarning | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkPoint[] | null>(null);
  const [remainingSec, setRemainingSec] = useState(durationSec);
  const [aspectRatio, setAspectRatio] = useState(3 / 4);
  const [queuedOffline, setQueuedOffline] = useState(false);

  // ── config / settings ───────────────────────────────────────────────
  const [config, setConfig] = useState<ExerciseConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // ── refs ────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerReadyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const processingRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const timerStartedRef = useRef(false);
  const sessionFpsSamplesRef = useRef<number[]>([]);

  // Derive live values from config (may be updated by modal save).
  const targetDuration = config?.duration ?? durationSec;
  const targetReps = config?.reps ?? 12;

  // ── camera helpers ──────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

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
      setStatus((current) => {
        if (current === 'error' || current === 'done') return current;
        return workerReadyRef.current ? 'ready' : 'loading';
      });
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

  // ── worker ──────────────────────────────────────────────────────────
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
        worker.postMessage({ type: 'INIT', movementPattern });
        setStatus((current) => {
          if (current === 'error' || current === 'done') return current;
          return cameraReadyRef.current ? 'ready' : 'loading';
        });
        captureFrame();
      } else if (message.type === 'RESULTS') {
        processingRef.current = false;
        setRepCount(message.frame.repCount);
        setPhase(message.frame.phase);
        setWarning(message.frame.warning);
        setLandmarks(message.frame.landmarks);

        // Smart start: timer begins on the first completed rep.
        if (
          !timerStartedRef.current &&
          mountedRef.current &&
          message.frame.repCount > 0
        ) {
          timerStartedRef.current = true;
          setStatus('active');
        }

        captureFrame();
      } else if (message.type === 'TELEMETRY') {
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
  }, [captureFrame, movementPattern, stopCamera]);

  // ── load persisted config on mount ──────────────────────────────────
  useEffect(() => {
    if (!exerciseId) return;
    void getExerciseConfig(exerciseId, 'VISION_REP').then((cfg) => {
      if (mountedRef.current) {
        setConfig(cfg);
        setRemainingSec(cfg.duration);
      }
    });
  }, [exerciseId]);

  // ── lifecycle ───────────────────────────────────────────────────────
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

  // ── aspect ratio ────────────────────────────────────────────────────
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

  // ── countdown (only while active) ──────────────────────────────────
  useEffect(() => {
    if (status !== 'active') return;
    const id = window.setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // ── time's up ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'active' && remainingSec === 0) {
      setStatus('done');
      stopCamera();
    }
  }, [remainingSec, status, stopCamera]);

  // ── session completion ─────────────────────────────────────────────
  const completeSession = useCallback(async () => {
    if (!boostId) return;
    try {
      const result = await api.completeBoost(boostId, {
        reps_completed: repCount,
        duration_sec: targetDuration,
      });
      setQueuedOffline(result.queued);
    } catch {
      // Non-network failure; the session stays complete.
    }
  }, [boostId, targetDuration, repCount]);

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

  // ── victory auto-navigate ──────────────────────────────────────────
  useEffect(() => {
    if (status !== 'done' || !boostId) return;
    const id = window.setTimeout(() => navigate('/'), VICTORY_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [status, boostId, navigate]);

  // ── config save ────────────────────────────────────────────────────
  const handleConfigSave = useCallback(
    async (newConfig: ExerciseConfig) => {
      setConfig(newConfig);
      setRemainingSec(newConfig.duration);
      setShowConfig(false);
      if (exerciseId) {
        await setExerciseConfig(exerciseId, newConfig);
      }
    },
    [exerciseId],
  );

  // ── pause / resume ─────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    setStatus((current) => (current === 'active' ? 'paused' : 'active'));
  }, []);

  // ── stop early ─────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    setStatus('done');
    stopCamera();
  }, [stopCamera]);

  // ── retry ──────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    workerReadyRef.current = false;
    cameraReadyRef.current = false;
    processingRef.current = false;
    captureInFlightRef.current = false;
    completedRef.current = false;
    timerStartedRef.current = false;
    sessionFpsSamplesRef.current = [];
    setErrorMessage(null);
    setRepCount(0);
    setPhase('get_ready');
    setWarning(null);
    setLandmarks(null);
    setQueuedOffline(false);
    setRemainingSec(config?.duration ?? durationSec);
    setStatus('initializing');
    void startCamera();
    createWorker();
  }, [config, createWorker, durationSec, startCamera]);

  // ── derived ────────────────────────────────────────────────────────
  const progressPct =
    targetDuration > 0
      ? Math.min(100, (remainingSec / targetDuration) * 100)
      : 0;
  const isActive = status === 'active' || status === 'paused';

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

      {/* ── Top HUD ──────────────────────────────────────────────────── */}
      <div className="absolute left-0 right-0 top-0 z-40 flex items-start justify-between p-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-paper drop-shadow">
            {exerciseName}
          </h2>
          <span className="mt-1 inline-block rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon">
            VISION_REP
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          {isActive && (
            <div className="text-right">
              <div className="font-timer text-3xl font-bold leading-none text-paper drop-shadow">
                {formatTime(remainingSec)}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ash">
                time
              </div>
            </div>
          )}

          {/* Settings gear — visible in ready + active + paused */}
          {(status === 'ready' || isActive) && (
            <button
              type="button"
              onClick={() => setShowConfig(true)}
              aria-label="Exercise settings"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur transition-transform active:scale-90"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── Rep counter + phase (active / paused) ─────────────────────── */}
      {isActive && (
        <>
          <div className="absolute bottom-20 left-4 z-40">
            <div className="font-timer text-5xl font-bold leading-none text-neon drop-shadow">
              {repCount}
              <span className="ml-1 text-lg text-ash">/{targetReps}</span>
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ash">
              reps
            </div>
          </div>
          <div className="absolute bottom-20 right-4 z-40 rounded-full border border-white/10 bg-ink/70 px-4 py-1.5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-widest text-paper">
              {status === 'paused' ? 'PAUSED' : PHASE_LABELS[phase]}
            </span>
          </div>
        </>
      )}

      {/* ── Posture warning ──────────────────────────────────────────── */}
      {isActive && warning === 'knee_valgus' && (
        <div className="absolute bottom-36 left-0 right-0 z-40 mx-4 flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/15 px-3 py-2 backdrop-blur">
          <ShieldAlert size={14} className="shrink-0 text-crimson" />
          <span className="text-xs font-semibold text-paper">
            Knees caving in — press them outward
          </span>
        </div>
      )}
      {isActive && warning === 'hip_sag' && (
        <div className="absolute bottom-36 left-0 right-0 z-40 mx-4 flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/15 px-3 py-2 backdrop-blur">
          <ShieldAlert size={14} className="shrink-0 text-crimson" />
          <span className="text-xs font-semibold text-paper">
            Hips sagging — raise your hips to form a straight line
          </span>
        </div>
      )}
      {isActive && warning === 'hip_pike' && (
        <div className="absolute bottom-36 left-0 right-0 z-40 mx-4 flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/15 px-3 py-2 backdrop-blur">
          <ShieldAlert size={14} className="shrink-0 text-crimson" />
          <span className="text-xs font-semibold text-paper">
            Hips too high — lower your hips to form a straight line
          </span>
        </div>
      )}

      {/* ── Pause / Stop controls (active + paused) ──────────────────── */}
      {isActive && (
        <div className="absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 gap-3">
          <button
            type="button"
            aria-label={status === 'paused' ? 'Resume' : 'Pause'}
            onClick={togglePause}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-ink/70 text-paper backdrop-blur transition-transform active:scale-90"
          >
            {status === 'paused' ? <Play size={20} /> : <Pause size={20} />}
          </button>
          <button
            type="button"
            aria-label="Stop workout"
            onClick={handleStop}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-crimson/40 bg-crimson/20 text-crimson backdrop-blur transition-transform active:scale-90"
          >
            <Flag size={20} />
          </button>
        </div>
      )}

      {/* ── Ready overlay (camera on, waiting for first rep) ─────────── */}
      {status === 'ready' && (
        <div className="absolute inset-x-0 bottom-28 z-40 flex justify-center px-4">
          <div className="rounded-full border border-neon/30 bg-ink/70 px-5 py-2 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-widest text-neon animate-pulse">
              Start when ready — first rep starts the timer
            </span>
          </div>
        </div>
      )}

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-40 h-1.5 bg-white/10">
        <div
          className="h-full bg-neon transition-all duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Loading overlay ──────────────────────────────────────────── */}
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

      {/* ── Error overlay ────────────────────────────────────────────── */}
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

      {/* ── Completed overlay ────────────────────────────────────────── */}
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

      {/* ── Config modal ─────────────────────────────────────────────── */}
      {showConfig && config && (
        <ExerciseConfigModal
          exerciseName={exerciseName}
          boostType="VISION_REP"
          config={config}
          onSave={handleConfigSave}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
