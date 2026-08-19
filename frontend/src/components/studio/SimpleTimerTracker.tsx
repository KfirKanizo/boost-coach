import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag, Pause, Play, Settings, Timer, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/client';
import {
  type ExerciseConfig,
  getExerciseConfig,
  setExerciseConfig,
} from '../../services/exerciseConfig';
import { ExerciseConfigModal } from './ExerciseConfigModal';

interface SimpleTimerTrackerProps {
  /** Seconds for the countdown (mirrors target_metrics.duration_sec). */
  initialSeconds?: number;
  /**
   * DailyBoost id to report completion to once the session finishes. Omitted
   * in preview mode. Offline completions are queued and flushed on reconnect.
   */
  boostId?: string;
  /** Exercise id for per-exercise config persistence. */
  exerciseId?: string;
  /** Display name shown on the HUD and config modal. */
  exerciseName?: string;
}

type TrackerStatus = 'ready' | 'active' | 'paused' | 'done';

/** How long the "Set complete" victory overlay stays up before navigating home. */
const VICTORY_DELAY_MS = 1500;

/**
 * Timer-based execution environment (e.g., planks).
 *
 * Starts in a "ready" state — the countdown only begins when the user taps
 * the start button. A ⚙️ settings icon lets the user adjust duration, sets,
 * and rest between sets without leaving the screen.
 */
export function SimpleTimerTracker({
  initialSeconds = 60,
  boostId,
  exerciseId,
  exerciseName = 'Duration Boost',
}: SimpleTimerTrackerProps) {
  const navigate = useNavigate();

  const [config, setConfig] = useState<ExerciseConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [status, setStatus] = useState<TrackerStatus>('ready');
  const [queuedOffline, setQueuedOffline] = useState(false);
  const completedRef = useRef(false);

  const targetDuration = config?.duration ?? initialSeconds;
  const progress = targetDuration > 0 ? remaining / targetDuration : 0;

  // ── load persisted config ──────────────────────────────────────────
  useEffect(() => {
    if (!exerciseId) return;
    void getExerciseConfig(exerciseId, 'DURATION').then((cfg) => {
      setConfig(cfg);
      setRemaining(cfg.duration);
    });
  }, [exerciseId]);

  // ── countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'active') return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : value));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === 'active' && remaining === 0) void finish();
  }, [remaining, status]);

  // ── completion ─────────────────────────────────────────────────────
  const finish = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setStatus('done');
    if (!boostId) return;
    try {
      const result = await api.completeBoost(boostId, {
        duration_sec: targetDuration,
      });
      setQueuedOffline(result.queued);
    } catch {
      // Non-network failure; the session stays complete.
    }
  }, [boostId, targetDuration]);

  useEffect(() => {
    if (status !== 'done' || !boostId) return;
    const id = window.setTimeout(() => navigate('/'), VICTORY_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [status, boostId, navigate]);

  // ── controls ───────────────────────────────────────────────────────
  const handleStart = useCallback(() => setStatus('active'), []);

  const togglePause = useCallback(() => {
    setStatus((current) => (current === 'active' ? 'paused' : 'active'));
  }, []);

  const handleStop = useCallback(() => {
    void finish();
  }, [finish]);

  const handleConfigSave = useCallback(
    async (newConfig: ExerciseConfig) => {
      setConfig(newConfig);
      setRemaining(newConfig.duration);
      completedRef.current = false;
      setShowConfig(false);
      if (exerciseId) {
        await setExerciseConfig(exerciseId, newConfig);
      }
    },
    [exerciseId],
  );

  return (
    <div className="relative flex min-h-[70vh] w-full flex-col overflow-hidden rounded-card bg-surface">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-neon/10 blur-3xl" />

      {status === 'done' ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
          <Trophy size={28} className="text-neon" />
          <p className="font-display text-lg font-bold text-paper">
            Set complete
          </p>
          {boostId && (
            <p className="rounded-full border border-white/10 bg-ink/70 px-3 py-1 text-[11px] font-semibold text-ash backdrop-blur">
              {queuedOffline
                ? 'Saved locally — will sync when back online'
                : 'Progress saved to your profile'}
            </p>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          {/* Header: exercise name + settings */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-ash">
              <Timer size={14} className="text-neon" />
              {status === 'paused' ? 'Paused' : exerciseName}
            </span>
            <button
              type="button"
              onClick={() => setShowConfig(true)}
              aria-label="Exercise settings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur transition-transform active:scale-90"
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Massive countdown */}
          <div className="font-timer text-[120px] font-bold leading-none tracking-tighter text-paper/90">
            {remaining}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {status === 'ready' && (
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-2 rounded-full bg-neon px-8 py-3 font-bold text-ink shadow-neon-glow transition-all active:scale-95"
              >
                <Play size={20} fill="currentColor" />
                Start
              </button>
            )}

            {status === 'active' && (
              <>
                <button
                  type="button"
                  aria-label="Pause"
                  onClick={togglePause}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur transition-transform active:scale-95"
                >
                  <Pause size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex items-center gap-2 rounded-full bg-crimson/20 px-6 py-3 font-bold text-crimson border border-crimson/40 backdrop-blur transition-all active:scale-95"
                >
                  <Flag size={18} />
                  Stop
                </button>
              </>
            )}

            {status === 'paused' && (
              <>
                <button
                  type="button"
                  aria-label="Resume"
                  onClick={togglePause}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur transition-transform active:scale-95"
                >
                  <Play size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex items-center gap-2 rounded-full bg-crimson/20 px-6 py-3 font-bold text-crimson border border-crimson/40 backdrop-blur transition-all active:scale-95"
                >
                  <Flag size={18} />
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Thin neon progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
        <div
          className="h-full rounded-r-full bg-neon shadow-neon-glow transition-all duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Config modal */}
      {showConfig && config && (
        <ExerciseConfigModal
          exerciseName={exerciseName}
          boostType="DURATION"
          config={config}
          onSave={handleConfigSave}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
