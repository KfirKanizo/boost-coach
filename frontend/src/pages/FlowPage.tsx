import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Play, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { BoostCard } from '../components/flow/BoostCard';
import { EnergyMap } from '../components/flow/EnergyMap';
import { SwapSheet } from '../components/flow/SwapSheet';
import { StudioFactory } from '../components/studio/StudioFactory';
import type { Boost, BoostType } from '../types/boost';
import type { SwapReason } from '../types/swap';

const DEMO_TYPES: { label: string; value: BoostType }[] = [
  { label: 'Vision Rep', value: 'VISION_REP' },
  { label: 'Duration', value: 'DURATION' },
];

export function FlowPage() {
  const navigate = useNavigate();
  const [environment, setEnvironment] = useState<'Home' | 'Gym'>('Home');
  const [demoType, setDemoType] = useState<BoostType>('DURATION');

  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapBoostId, setSwapBoostId] = useState<string | null>(null);

  const loadBoosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTodayBoosts();
      setBoosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load today\u2019s flow');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoosts();
  }, [loadBoosts]);

  // Re-fetch whenever the window regains focus (e.g. returning from the
  // studio or from the background) so the Energy Map and cards reflect the
  // just-completed status immediately.
  useEffect(() => {
    const handleFocus = () => {
      void loadBoosts();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadBoosts]);

  const handleSwapConfirm = useCallback(
    async (reason: SwapReason) => {
      if (swapBoostId === null) return;
      const updated = await api.swapBoost(swapBoostId, reason);
      setBoosts((prev) =>
        prev.map((boost) => (boost.id === updated.id ? updated : boost)),
      );
      setSwapBoostId(null);
    },
    [swapBoostId],
  );

  const swapBoost = boosts.find((boost) => boost.id === swapBoostId);
  const completedToday = boosts.filter((boost) => boost.status === 'completed').length;

  const firstPending = boosts.find((boost) => boost.status === 'pending');
  const hasPending = firstPending !== undefined;
  const executeDisabled = loading || error !== null || !hasPending;
  const executeLabel =
    !loading && error === null && !hasPending ? 'DONE' : 'Execute';

  const handleExecute = () => {
    if (!firstPending) return;
    navigate(`/studio/${firstPending.id}`, {
      state: { boost: firstPending },
    });
  };

  return (
    <div className="pb-28 pt-4">
      {/* Environment toggle */}
      <div className="mb-8 flex justify-center px-4">
        <div className="relative flex w-full max-w-[240px] rounded-full bg-surface p-1">
          <div
            className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-neon transition-transform duration-300 ${
              environment === 'Gym' ? 'translate-x-full' : ''
            }`}
          />
          {(['Home', 'Gym'] as const).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setEnvironment(env)}
              className={`relative z-10 flex-1 py-2 text-sm font-medium transition-colors ${
                environment === env ? 'text-ink' : 'text-ash'
              }`}
            >
              {env}
            </button>
          ))}
        </div>
      </div>

      <EnergyMap completedDays={completedToday} />

      <div className="mt-8 flex flex-col gap-4 px-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ash">
          Today&apos;s Flow
        </h2>

        {loading && (
          <div
            role="status"
            className="flex items-center justify-center gap-3 rounded-card bg-surface py-10 text-sm text-ash"
          >
            <Loader2 size={18} className="animate-spin text-neon" />
            Loading today&apos;s flow…
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="flex flex-col items-center gap-4 rounded-card bg-surface px-6 py-10 text-center"
          >
            <p className="text-sm text-ash">{error}</p>
            <button
              type="button"
              onClick={() => void loadBoosts()}
              className="flex items-center gap-2 rounded-full bg-neon px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-ink"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {!loading && !error &&
          (boosts.length === 0 ? (
            <p className="rounded-card bg-surface px-6 py-10 text-center text-sm text-ash">
              No boosts scheduled today. Time to rest or recover.
            </p>
          ) : (
            boosts.map((boost) => (
              <BoostCard
                key={boost.id}
                boost={boost}
                onSwap={setSwapBoostId}
              />
            ))
          ))}
      </div>

      {/* Studio Factory preview */}
      <div className="mt-10 px-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
          Studio Factory Preview
        </h2>
        <div className="mb-3 flex gap-2">
          {DEMO_TYPES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setDemoType(value)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                demoType === value
                  ? 'bg-neon text-ink'
                  : 'bg-surface text-ash hover:text-paper'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <StudioFactory boostType={demoType} />
      </div>

      {/* Execute FAB */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
        <button
          type="button"
          onClick={handleExecute}
          disabled={executeDisabled}
          className={`pointer-events-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-full py-4 text-xl font-black uppercase tracking-widest transition-all ${
            executeDisabled
              ? 'bg-white/10 text-ash'
              : 'bg-neon text-ink shadow-neon-glow hover:shadow-neon-glow-strong active:scale-95'
          }`}
        >
          {executeDisabled ? (
            <Check size={24} />
          ) : (
            <Play size={24} fill="currentColor" />
          )}
          {executeLabel}
        </button>
      </div>

      {swapBoost && (
        <SwapSheet
          exerciseName={swapBoost.exercise.name_translations.en ?? 'Exercise'}
          onClose={() => setSwapBoostId(null)}
          onConfirm={handleSwapConfirm}
        />
      )}
    </div>
  );
}
