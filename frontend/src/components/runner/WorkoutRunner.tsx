import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronRight,
  Dumbbell,
  Info,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { api } from '../../api/client';
import { SkeletonOverlay } from '../studio/SkeletonOverlay';
import type {
  LandmarkPoint,
  ExercisePhase,
  ExerciseWarning,
  MovementPattern,
  VisionWorkerResponse,
} from '../../workers/visionProtocol';

import type { RoutineExercise } from '../builder/RoutineEditor';
import { CompletionScreen } from './CompletionScreen';
import { RestOverlay } from './RestOverlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RunnerPhase = 'loading' | 'ready' | 'active' | 'resting' | 'completed' | 'error';

interface WorkoutLocationState {
  sessionExercises: RoutineExercise[];
}

/** Describes a completed exercise for the summary screen. */
interface CompletedExercise {
  name: string;
  sets: number;
  repsPerSet: number;
  isDuration?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAMERA_FACING_MODE: 'user' | 'environment' = 'user';

const PHASE_LABELS: Record<ExercisePhase, string> = {
  get_ready: 'GET READY',
  squat: 'SQUAT',
  stand_up: 'STAND UP',
  down: 'DOWN',
  up: 'UP',
  holding: 'HOLDING',
};

// ---------------------------------------------------------------------------
// WorkoutRunner
// ---------------------------------------------------------------------------

/**
 * Camera-driven multi-exercise workout runner.
 *
 * Receives an array of `RoutineExercise` from route state and orchestrates
 * the entire hands-free session: per-set rep tracking via the vision worker,
 * automatic rest-countdown transitions, exercise-to-exercise advancement, and
 * a final completion summary.
 *
 * Route: `/workout`  — state: `{ sessionExercises: RoutineExercise[] }`
 */
export function WorkoutRunner() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionExercises = useMemo(() => {
    const state = location.state as WorkoutLocationState | null;
    return state?.sessionExercises ?? [];
  }, [location.state]);

  // ── Redirect guard ─────────────────────────────────────────────────
  const redirectingRef = useRef(false);
  useEffect(() => {
    if (redirectingRef.current) return;
    if (!sessionExercises || sessionExercises.length === 0) {
      redirectingRef.current = true;
      navigate('/', { replace: true });
    }
  }, [sessionExercises, navigate]);

  // ── Runner state ───────────────────────────────────────────────────
  const [phase, setPhase] = useState<RunnerPhase>('loading');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0); // 0-indexed within current exercise
  const [localRepCount, setLocalRepCount] = useState(0);
  const [holdElapsed, setHoldElapsed] = useState(0); // seconds accumulated while holding
  const [restRemaining, setRestRemaining] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing camera...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Camera / vision state
  const [landmarks, setLandmarks] = useState<LandmarkPoint[] | null>(null);
  const [warning, setWarning] = useState<ExerciseWarning | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerReadyRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const processingRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const workerStartRepCountRef = useRef(0);
  const workerRepCountRef = useRef(0);
  const pauseLockRef = useRef(false); // blocks rep processing while paused
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false); // tracks whether worker reports 'holding' phase
  const isEarlyExitRef = useRef(false); // true when user quit early — partial credit
  const partialRepsRef = useRef(0); // accumulated reps at quit time
  const partialDurationRef = useRef(0); // accumulated duration at quit time
  const partialExerciseCountRef = useRef(0); // number of exercises with any work done

  // ── Derived values ─────────────────────────────────────────────────
  const currentExercise = sessionExercises[exerciseIndex];

  // eslint-disable-next-line no-console
  console.log('Runner Exercise:', {
    animationUrl: currentExercise?.animationUrl,
    instructions: currentExercise?.instructions,
    exerciseName: currentExercise?.exerciseName,
  });

  const isDurationExercise = currentExercise?.movementPattern === 'core';
  const targetReps = currentExercise?.reps ?? 12;
  const targetDurationSec = isDurationExercise ? targetReps : 0;
  const totalSets = currentExercise?.sets ?? 3;
  const restDuration = currentExercise?.restSeconds ?? 30;
  const isLastExercise = exerciseIndex >= sessionExercises.length - 1;
  const isLastSet = setIndex >= totalSets - 1;

  // ── Camera helpers ─────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const worker = workerRef.current;
    if (!video || !worker || !workerReadyRef.current) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    if (processingRef.current || captureInFlightRef.current) return;
    if (pauseLockRef.current) return;

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
        setPhase('error');
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
        await playPromise.catch((err: unknown) => {
          console.warn('Video play interrupted:', err);
        });
      }
      if (!mountedRef.current) return;

      cameraReadyRef.current = true;
      setPhase((current) => {
        if (current === 'error' || current === 'completed') return current;
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
      setPhase('error');
    }
  }, [captureFrame]);

  // ── Worker ─────────────────────────────────────────────────────────
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
        const pattern: MovementPattern =
          currentExercise?.movementPattern === 'push'
            ? 'push'
            : currentExercise?.movementPattern === 'core'
              ? 'core'
              : 'squat';
        worker.postMessage({ type: 'INIT', movementPattern: pattern });
        setPhase((current) => {
          if (current === 'error' || current === 'completed') return current;
          return cameraReadyRef.current ? 'ready' : 'loading';
        });
        captureFrame();
      } else if (message.type === 'RESULTS') {
        processingRef.current = false;

        // Track worker's absolute rep count
        workerRepCountRef.current = message.frame.repCount;
        setLandmarks(message.frame.landmarks);
        setWarning(message.frame.warning);

        // Track holding phase for duration exercises
        isHoldingRef.current = message.frame.phase === 'holding';

        // Calculate local reps (since start of current set)
        if (!pauseLockRef.current && !isDurationExercise) {
          const local = Math.max(
            0,
            message.frame.repCount - workerStartRepCountRef.current,
          );
          setLocalRepCount(local);

          // Smart start: activate on first rep
          setPhase((current) => {
            if (current === 'ready' && local > 0) return 'active';
            return current;
          });
        }

        captureFrame();
      } else if (message.type === 'TELEMETRY') {
        // Ignored in runner — no telemetry reporting needed
      } else if (message.type === 'ERROR') {
        processingRef.current = false;
        setErrorMessage(message.message);
        setPhase('error');
        stopCamera();
      }
    };

    worker.onerror = (event) => {
      processingRef.current = false;
      setErrorMessage(event.message || 'Vision worker crashed.');
      setPhase('error');
      stopCamera();
    };
  }, [captureFrame, currentExercise, stopCamera]);

  /** Terminate worker + stop camera (used between exercises) */
  const teardownVision = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    workerReadyRef.current = false;
    cameraReadyRef.current = false;
    processingRef.current = false;
    captureInFlightRef.current = false;
    pauseLockRef.current = false;
    workerRepCountRef.current = 0;
    workerStartRepCountRef.current = 0;
    setLandmarks(null);
    setWarning(null);
    stopCamera();
  }, [stopCamera]);

  // ── Boot camera + worker on mount ──────────────────────────────────
  useEffect(() => {
    if (sessionExercises.length === 0) return;
    mountedRef.current = true;
    setLoadingMessage('Initializing camera...');
    void startCamera();
    createWorker();
    return () => {
      mountedRef.current = false;
      teardownVision();
    };
    // Only run on mount / when exercises change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rest countdown ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'resting') return;
    if (restRemaining <= 0) {
      // Rest finished → start next set
      beginSet();
      return;
    }
    const id = window.setInterval(() => {
      setRestRemaining((s) => {
        if (s <= 1) {
          // Will trigger beginSet via the effect above
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // beginSet is stable (useCallback with no deps that change during resting)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restRemaining]);

  // ── Duration timer (core exercises: ticks only while holding) ───────
  useEffect(() => {
    if (!isDurationExercise || phase !== 'active') return;
    const id = window.setInterval(() => {
      if (!isHoldingRef.current) return; // paused when form breaks
      setHoldElapsed((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isDurationExercise, phase]);

  // ── Target reached → advance ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return;

    const targetReached = isDurationExercise
      ? holdElapsed >= targetDurationSec
      : localRepCount >= targetReps;
    if (!targetReached) return;

    // Target hit! Determine next state.
    if (!isLastSet) {
      beginRest();
    } else if (!isLastExercise) {
      advanceExercise();
    } else {
      setPhase('completed');
    }
  }, [
    phase,
    holdElapsed,
    targetDurationSec,
    isDurationExercise,
    localRepCount,
    targetReps,
    isLastSet,
    isLastExercise,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Set transitions ────────────────────────────────────────────────

  /** Begin a rest period after a completed set. */
  const beginRest = useCallback(() => {
    pauseLockRef.current = true; // stop processing frames
    setRestRemaining(restDuration);
    setPhase('resting');
  }, [restDuration]);

  /** Start (or restart) the camera+worker for a new set/exercise. */
  const beginSet = useCallback(() => {
    pauseLockRef.current = false;
    isHoldingRef.current = false;
    setLocalRepCount(0);
    setHoldElapsed(0);
    setSetIndex((prev) => prev + 1);
    workerStartRepCountRef.current = workerRepCountRef.current;
    setPhase('ready');
  }, []);

  /** Transition to the next exercise: tear down, brief pause, re-init. */
  const advanceExercise = useCallback(() => {
    teardownVision();
    setIsTransitioning(true);
    setSetIndex(0);
    setLocalRepCount(0);
    setHoldElapsed(0);
    setShowInstructions(false);

    const nextIndex = exerciseIndex + 1;
    setExerciseIndex(nextIndex);

    // Brief transition delay, then re-init camera + worker
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      if (!mountedRef.current) return;
      setIsTransitioning(false);
      setLoadingMessage(
        `Get ready — ${sessionExercises[nextIndex]?.exerciseName ?? 'Next exercise'}`,
      );
      void startCamera();
      createWorker();
    }, 1200);
  }, [exerciseIndex, sessionExercises, teardownVision, startCamera, createWorker]);

  /** Skip the current rest period and jump to the next set. */
  const skipRest = useCallback(() => {
    setRestRemaining(0);
    // beginSet will be triggered by the rest countdown effect
  }, []);

  // ── Error retry ────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    teardownVision();
    setErrorMessage(null);
    setLocalRepCount(0);
    setLoadingMessage('Re-initializing...');
    setPhase('loading');
    void startCamera();
    createWorker();
  }, [teardownVision, startCamera, createWorker]);

  // ── Return to dashboard ────────────────────────────────────────────
  const handleReturn = useCallback(() => {
    navigate('/');
  }, [navigate]);

  /** Quit workout: tear down vision, record partial volume, transition to completion. */
  const handleQuit = useCallback(() => {
    // Calculate partial volume at this exact moment
    let reps = 0;
    let duration = 0;
    let exercisesWithWork = 0;

    // Fully completed exercises before current
    for (let i = 0; i < exerciseIndex; i++) {
      const ex = sessionExercises[i];
      exercisesWithWork++;
      if (ex.movementPattern === 'core') {
        duration += ex.reps * ex.sets;
      } else {
        reps += ex.reps * ex.sets;
      }
    }

    // Current exercise partial volume
    if (currentExercise) {
      // During resting, the set that just finished hasn't bumped setIndex yet
      const setsCompleted = phase === 'resting' ? setIndex + 1 : setIndex;
      const currentSetReps = phase === 'resting' ? 0 : (isDurationExercise ? 0 : localRepCount);
      const currentSetDuration = phase === 'resting' ? 0 : (isDurationExercise ? holdElapsed : 0);

      const exerciseReps = setsCompleted * currentExercise.reps + currentSetReps;
      const exerciseDuration = setsCompleted * currentExercise.reps + currentSetDuration;

      if (exerciseReps > 0 || exerciseDuration > 0) {
        exercisesWithWork++;
      }

      if (isDurationExercise) {
        duration += exerciseDuration;
      } else {
        reps += exerciseReps;
      }
    }

    isEarlyExitRef.current = true;
    partialRepsRef.current = reps;
    partialDurationRef.current = duration;
    partialExerciseCountRef.current = Math.max(exercisesWithWork, 1);

    teardownVision();
    setPhase('completed');
  }, [
    phase, exerciseIndex, sessionExercises, currentExercise, setIndex,
    isDurationExercise, localRepCount, holdElapsed, teardownVision,
  ]);

  /** Force-advance: skip current set (or end workout if last set of last exercise). */
  const handleSkipSet = useCallback(() => {
    if (isLastSet && isLastExercise) {
      teardownVision();
      setPhase('completed');
    } else if (isLastSet) {
      advanceExercise();
    } else {
      beginRest();
    }
  }, [isLastSet, isLastExercise, teardownVision, advanceExercise, beginRest]);

  // ── Send completion payload to backend ─────────────────────────────
  const completionSentRef = useRef(false);
  useEffect(() => {
    if (phase !== 'completed') return;
    if (completionSentRef.current) return;
    completionSentRef.current = true;

    const isSingle = sessionExercises.length === 1;
    const isEarlyExit = isEarlyExitRef.current;

    let totalReps: number;
    let totalDurationSec: number;
    let exerciseCount: number;

    if (isEarlyExit) {
      totalReps = partialRepsRef.current;
      totalDurationSec = partialDurationRef.current;
      exerciseCount = partialExerciseCountRef.current;
    } else {
      totalReps = 0;
      totalDurationSec = 0;
      for (const ex of sessionExercises) {
        if (ex.movementPattern === 'core') {
          totalDurationSec += ex.reps * ex.sets;
        } else {
          totalReps += ex.reps * ex.sets;
        }
      }
      exerciseCount = sessionExercises.length;
    }

    void api.completeWorkout({
      session_type: isSingle ? 'single' : 'flow',
      total_reps: totalReps,
      total_duration_seconds: totalDurationSec,
      exercise_count: exerciseCount,
    }).catch(() => {
      // Silent — completion is best-effort; the user sees the screen either way.
    });
  }, [phase, sessionExercises]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early exit guard ───────────────────────────────────────────────
  if (!sessionExercises || sessionExercises.length === 0) return null;

  // ── Derived HUD values ─────────────────────────────────────────────
  const isActive = phase === 'active';
  const progressPct = isDurationExercise
    ? targetDurationSec > 0
      ? Math.min(100, (holdElapsed / targetDurationSec) * 100)
      : 0
    : targetReps > 0
      ? Math.min(100, (localRepCount / targetReps) * 100)
      : 0;

  // Completed exercises for summary
  const isEarlyExit = isEarlyExitRef.current;
  const completedExercises: CompletedExercise[] = [];

  if (isEarlyExit) {
    // Partial: fully completed exercises before current
    for (let i = 0; i < exerciseIndex; i++) {
      const ex = sessionExercises[i];
      completedExercises.push({
        name: ex.exerciseName,
        sets: ex.sets,
        repsPerSet: ex.reps,
        isDuration: ex.movementPattern === 'core',
      });
    }
    // Partial: current exercise — during resting the last set just finished
    if (currentExercise) {
      const setsCompleted = phase === 'resting' ? setIndex + 1 : setIndex;
      const lastSetReps = phase === 'resting' ? 0 : (isDurationExercise ? holdElapsed : localRepCount);
      completedExercises.push({
        name: currentExercise.exerciseName,
        sets: Math.max(setsCompleted, 1),
        repsPerSet: isDurationExercise ? lastSetReps : (setsCompleted > 0 ? currentExercise.reps : lastSetReps),
        isDuration: isDurationExercise,
      });
    }
  } else {
    for (let i = 0; i <= exerciseIndex; i++) {
      const ex = sessionExercises[i];
      completedExercises.push({
        name: ex.exerciseName,
        sets: ex.sets,
        repsPerSet: ex.reps,
        isDuration: ex.movementPattern === 'core',
      });
    }
  }

  // Next label for rest overlay
  const nextSetNum = setIndex + 2; // next set (1-indexed)
  const nextRestLabel =
    !isLastSet
      ? `Set ${nextSetNum} of ${currentExercise?.exerciseName}`
      : !isLastExercise
        ? sessionExercises[exerciseIndex + 1]?.exerciseName ?? 'Next exercise'
        : '';

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-black"
    >
      {/* ── Camera feed ──────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
        aria-label="Live camera feed"
      />
      {landmarks && <SkeletonOverlay landmarks={landmarks} warning={warning} />}

      {/* ── Top HUD (always visible except loading/completed) ─────────── */}
      {phase !== 'loading' && phase !== 'completed' && phase !== 'error' && (
        <div className="absolute left-0 right-0 top-0 z-40 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-paper drop-shadow">
              {currentExercise?.exerciseName}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon">
                Set {setIndex + 1} / {totalSets}
              </span>
              <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ash">
                {exerciseIndex + 1}/{sessionExercises.length}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            {isActive && (
              <div className="text-right">
                <div className="font-timer text-3xl font-bold leading-none text-paper drop-shadow">
                  {isDurationExercise ? (
                    <>
                      {targetDurationSec - holdElapsed}
                      <span className="ml-1 text-lg text-ash">s</span>
                    </>
                  ) : (
                    <>
                      {localRepCount}
                      <span className="ml-1 text-lg text-ash">/{targetReps}</span>
                    </>
                  )}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ash">
                  {isDurationExercise ? 'time' : 'reps'}
                </div>
              </div>
            )}

            {/* Quit button */}
            <button
              type="button"
              aria-label="End workout"
              onClick={() => setShowQuitConfirm(true)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-paper backdrop-blur transition-all hover:bg-black/50 active:scale-90"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Ready overlay (waiting for first rep) ─────────────────────── */}
      {phase === 'ready' && (
        <div className="absolute inset-x-0 bottom-28 z-40 flex justify-center px-4">
          <div className="rounded-full border border-neon/30 bg-ink/70 px-5 py-2 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-widest text-neon animate-pulse">
              {isDurationExercise
                ? 'Start when ready — hold the plank to begin'
                : 'Start when ready — first rep begins the set'}
            </span>
          </div>
        </div>
      )}

      {/* ── Animation sidebar + instructions (exercise reference) ────── */}
      {(phase === 'ready' || isActive) && currentExercise && (
        <div className="absolute right-4 top-28 z-50 flex flex-col items-end gap-2">
          {/* Animation card or placeholder */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 backdrop-blur-md">
            {currentExercise.animationUrl ? (
              <img
                src={
                  currentExercise.animationUrl.includes('rapidapi-key')
                    ? currentExercise.animationUrl
                    : `${currentExercise.animationUrl}${currentExercise.animationUrl.includes('?') ? '&' : '?'}rapidapi-key=112648333fmsh4983575ee18bf9ap13ecf2jsnc09b81349a34`
                }
                alt={`${currentExercise.exerciseName} demonstration`}
                className="h-28 w-28 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-28 w-28 flex-col items-center justify-center">
                <Dumbbell size={28} className="mb-1 text-ash" />
                <span className="text-[9px] font-bold uppercase text-ash">No preview</span>
              </div>
            )}
          </div>

          {/* Prominent instructions button */}
          {currentExercise.instructions && currentExercise.instructions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInstructions((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neon backdrop-blur-md transition-all hover:bg-neon/25 active:scale-95"
            >
              <Info size={12} />
              {showInstructions ? 'Hide Steps' : 'View Steps'}
            </button>
          )}
        </div>
      )}

      {/* ── Instructions overlay (full-width, below animation widget) ── */}
      {showInstructions && currentExercise?.instructions && currentExercise.instructions.length > 0 && (
        <div className="absolute right-4 top-[11.5rem] z-50 max-h-48 w-72 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neon">
            How to perform
          </p>
          <ol className="space-y-1">
            {currentExercise.instructions.map((step, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-paper/80">
                <span className="mr-1 font-bold text-neon/70">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Active phase — rep progress + phase label ─────────────────── */}
      {isActive && (
        <>
          {/* Rep progress bar */}
          <div className="absolute bottom-20 left-4 right-4 z-40">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-neon transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Phase label */}
          <div className="absolute bottom-28 right-4 z-40 rounded-full border border-white/10 bg-ink/70 px-4 py-1.5 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-widest text-paper">
              {PHASE_LABELS[warning === 'pose_lost' ? 'get_ready' : isDurationExercise ? (isHoldingRef.current ? 'holding' : 'get_ready') : 'squat']}
            </span>
          </div>

          {/* Posture warning */}
          {warning === 'knee_valgus' && (
            <div className="absolute bottom-36 left-0 right-0 z-40 mx-4 flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/15 px-3 py-2 backdrop-blur">
              <ShieldAlert size={14} className="shrink-0 text-crimson" />
              <span className="text-xs font-semibold text-paper">
                Knees caving in — press them outward
              </span>
            </div>
          )}
          {warning === 'hip_sag' && (
            <div className="absolute bottom-36 left-0 right-0 z-40 mx-4 flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/15 px-3 py-2 backdrop-blur">
              <ShieldAlert size={14} className="shrink-0 text-crimson" />
              <span className="text-xs font-semibold text-paper">
                Hips sagging — raise your hips to form a straight line
              </span>
            </div>
          )}
          {warning === 'hip_pike' && (
            <div className="absolute bottom-36 left-0 right-0 z-40 mx-4 flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/15 px-3 py-2 backdrop-blur">
              <ShieldAlert size={14} className="shrink-0 text-crimson" />
              <span className="text-xs font-semibold text-paper">
                Hips too high — lower your hips to form a straight line
              </span>
            </div>
          )}

          {/* Skip Set button */}
          <div className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2">
            <button
              type="button"
              aria-label="Skip set"
              onClick={handleSkipSet}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-5 py-3 text-sm font-bold text-paper backdrop-blur transition-all hover:bg-black/50 active:scale-95"
            >
              Skip Set
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* ── Loading overlay ───────────────────────────────────────────── */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-neon/30 bg-neon/10">
            <Camera size={24} className="animate-pulse text-neon" />
          </div>
          <p className="max-w-[240px] text-center text-sm font-semibold text-paper">
            {loadingMessage}
          </p>
        </div>
      )}

      {/* ── Transition overlay (between exercises) ────────────────────── */}
      {isTransitioning && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-black/80 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-widest text-neon">
            Get Ready
          </p>
          <p className="font-display text-2xl font-black text-paper">
            {sessionExercises[exerciseIndex + 1]?.exerciseName ?? 'Next'}
          </p>
          <p className="text-sm text-ash">Set 1 of {sessionExercises[exerciseIndex + 1]?.sets}</p>
        </div>
      )}

      {/* ── Rest overlay ──────────────────────────────────────────────── */}
      {phase === 'resting' && (
        <RestOverlay
          secondsRemaining={restRemaining}
          totalSeconds={restDuration}
          nextLabel={nextRestLabel}
          onSkip={skipRest}
        />
      )}

      {/* ── Error overlay ─────────────────────────────────────────────── */}
      {phase === 'error' && (
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

      {/* ── Quit confirmation dialog ──────────────────────────────────── */}
      {showQuitConfirm && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="End workout"
        >
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-surface/90 p-6 text-center backdrop-blur-md">
            <h3 className="font-display text-lg font-bold text-paper">
              End workout?
            </h3>
            <p className="mt-2 text-sm text-ash">
              You'll keep all the reps and time you've completed so far.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleQuit}
                className="w-full rounded-xl border border-crimson/40 bg-crimson/15 py-3 text-sm font-bold text-crimson transition-colors hover:bg-crimson/25 active:scale-[0.98]"
              >
                Quit Workout
              </button>
              <button
                type="button"
                onClick={() => setShowQuitConfirm(false)}
                className="w-full rounded-xl bg-white/5 py-3 text-sm font-bold text-paper transition-colors hover:bg-white/10 active:scale-[0.98]"
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Completion screen ─────────────────────────────────────────── */}
      {phase === 'completed' && (
        <CompletionScreen exercises={completedExercises} onReturn={handleReturn} />
      )}
    </div>
  );
}
