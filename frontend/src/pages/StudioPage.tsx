import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { StudioFactory } from '../components/studio/StudioFactory';
import type { Boost } from '../types/boost';

/**
 * The execution environment for a single boost, reached at /studio/:boost_id.
 *
 * Prefers the boost object handed over via route state (fast path from The
 * Flow); falls back to fetching today's boosts and locating the matching id
 * when the route was entered directly (deep link / share).
 */
export function StudioPage() {
  const { boost_id: boostId = '' } = useParams<{ boost_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const stateBoost = (location.state as { boost?: Boost } | null)?.boost;
  const initialBoost =
    stateBoost && stateBoost.id === boostId ? stateBoost : null;

  const [boost, setBoost] = useState<Boost | null>(initialBoost);
  const [loading, setLoading] = useState(initialBoost === null);
  const [error, setError] = useState<string | null>(null);

  const loadBoost = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const boosts = await api.getTodayBoosts();
      const found = boosts.find((item) => item.id === boostId) ?? null;
      if (!found) {
        throw new Error('Boost not found');
      }
      setBoost(found);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load this boost',
      );
    } finally {
      setLoading(false);
    }
  }, [boostId]);

  useEffect(() => {
    if (initialBoost === null) void loadBoost();
  }, [initialBoost, loadBoost]);

  const durationSec =
    boost && typeof boost.target_metrics.duration_sec === 'number'
      ? boost.target_metrics.duration_sec
      : undefined;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back to The Flow"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-paper transition-transform active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        {boost && (
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold tracking-tight">
              {boost.exercise.name_translations.en ?? 'Exercise'}
            </h1>
            <p className="text-xs uppercase tracking-widest text-ash">
              {boost.exercise.movement_pattern}
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div
          role="status"
          className="flex flex-1 items-center justify-center gap-3 text-sm text-ash"
        >
          <Loader2 size={20} className="animate-spin text-neon" />
          Loading boost…
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-4 rounded-card bg-surface px-6 py-10 text-center"
        >
          <p className="text-sm text-ash">{error}</p>
          <button
            type="button"
            onClick={() => void loadBoost()}
            className="flex items-center gap-2 rounded-full bg-neon px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-ink"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {!loading && !error && boost && (
        <StudioFactory
          boostType={boost.exercise.boost_type}
          durationSec={durationSec}
          boostId={boost.id}
          exerciseName={boost.exercise.name_translations.en ?? 'Exercise'}
          movementPattern={boost.exercise.movement_pattern as 'squat' | 'push'}
        />
      )}
    </div>
  );
}
