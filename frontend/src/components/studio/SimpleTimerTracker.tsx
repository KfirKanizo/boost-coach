import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag, Pause, Play, Timer, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/client';

interface SimpleTimerTrackerProps {
  /** Seconds for the countdown (mirrors target_metrics.duration_sec). */
  initialSeconds?: number;
  /**
   * DailyBoost id to report completion to once the session finishes. Omitted
   * in preview mode. Offline completions are queued and flushed on reconnect.
   */
  boostId?: string;
}

type TrackerStatus = 'active' | 'paused' | 'done';

/** How long the "Set complete" victory overlay stays up before navigating home. */
const VICTORY_DELAY_MS = 1500;

/**
 * Timer-based execution environment (e.g., planks).
 *
 * Main-thread countdown with a working Pause toggle. No camera permission
 * is required. Completing the countdown or tapping "Finish Set" reports the
 * session via completeBoost, shows the victory overlay, and (in a real
 * session) returns to The Flow after the victory delay.
 */
export function SimpleTimerTracker({
  initialSeconds = 60,
  boostId,
}: SimpleTimerTrackerProps) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [status, setStatus] = useState<TrackerStatus>('active');
  const [queuedOffline, setQueuedOffline] = useState(false);
  const completedRef = useRef(false);
  const navigate = useNavigate();
  const progress = remaining / initialSeconds;

  const finish = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setStatus('done');
    if (!boostId) return;
    try {
      const result = await api.completeBoost(boostId, {
        duration_sec: initialSeconds,
      });
      setQueuedOffline(result.queued);
    } catch {
      // Non-network failure (e.g. unknown boost); the session stays complete.
    }
  }, [boostId, initialSeconds]);

  // Countdown — only ticks when active (not paused or done).
  useEffect(() => {
    if (status !== 'active') return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : value));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === 'active' && remaining === 0) void finish();
  }, [remaining, status, finish]);

  useEffect(() => {
    if (status !== 'done' || !boostId) return;
    const id = window.setTimeout(() => navigate('/'), VICTORY_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [status, boostId, navigate]);

  const togglePause = () => {
    setStatus((current) => (current === 'active' ? 'paused' : 'active'));
  };

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
          <span className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-ash">
            <Timer size={14} className="text-neon" />
            {status === 'paused' ? 'Paused' : 'Duration Boost'}
          </span>

          {/* Massive countdown */}
          <div className="font-timer text-[120px] font-bold leading-none tracking-tighter text-paper/90">
            {remaining}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={status === 'paused' ? 'Resume' : 'Pause'}
              onClick={togglePause}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur transition-transform active:scale-95"
            >
              {status === 'paused' ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              className="flex items-center gap-2 rounded-full bg-neon px-8 py-3 font-bold text-ink shadow-neon-glow transition-all active:scale-95"
            >
              <Flag size={20} />
              Finish Set
            </button>
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
    </div>
  );
}
