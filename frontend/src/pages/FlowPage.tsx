import { useCallback, useEffect, useState } from 'react';
import { Dumbbell, Loader2, Plus, RefreshCw, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { UserProfile } from '../api/client';
import { BoostCard } from '../components/flow/BoostCard';
import { EnergyMap } from '../components/flow/EnergyMap';
import { FlowOverviewSheet } from '../components/flow/FlowOverviewSheet';
import { SwapSheet } from '../components/flow/SwapSheet';
import type { Boost } from '../types/boost';
import type { SwapReason } from '../types/swap';
import type { RoutineExercise } from '../components/builder/RoutineEditor';
import type { CustomRoutine } from './WorkoutBuilderPage';
import { loadRoutines } from './WorkoutBuilderPage';

const MAX_ROUTINES = 4;

export function FlowPage() {
  const navigate = useNavigate();
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapBoostId, setSwapBoostId] = useState<string | null>(null);

  // Custom routines from Preferences
  const [routines, setRoutines] = useState<CustomRoutine[]>([]);

  // Pre-flight sheet
  const [selectedRoutine, setSelectedRoutine] = useState<CustomRoutine | null>(null);

  // User profile (streak for EnergyMap)
  const [profile, setProfile] = useState<UserProfile | null>(null);

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

  const loadProfile = useCallback(async () => {
    try {
      const data = await api.getUserProfile();
      setProfile(data);
    } catch {
      // Silent — EnergyMap degrades gracefully without streak data.
    }
  }, []);

  const loadCustomRoutines = useCallback(async () => {
    try {
      const data = await loadRoutines();
      setRoutines(data);
    } catch {
      // Silent — custom flows section degrades gracefully.
    }
  }, []);

  useEffect(() => {
    void loadBoosts();
    void loadProfile();
    void loadCustomRoutines();
  }, [loadBoosts, loadProfile, loadCustomRoutines]);

  // Re-fetch routines + boosts whenever the window regains focus
  // (e.g. returning from the builder or studio).
  useEffect(() => {
    const handleFocus = () => {
      void loadBoosts();
      void loadCustomRoutines();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadBoosts, loadCustomRoutines]);

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

  const canCreateMore = routines.length < MAX_ROUTINES;

  const handleStartWorkout = useCallback(
    (exercises: RoutineExercise[]) => {
      console.log('Initiating Runner with session data: ', exercises);
      setSelectedRoutine(null);
    },
    [],
  );

  return (
    <div className="pb-28 pt-4">
      <EnergyMap completedDays={profile?.current_streak ?? 0} />

      {/* Custom Flows section */}
      <div className="mt-8 px-4">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-ash">
          My Custom Flows
        </h2>

        {/* Empty state */}
        {routines.length === 0 && (
          <div className="rounded-card border border-dashed border-white/10 py-10 text-center">
            <Dumbbell size={28} className="mx-auto mb-3 text-ash/40" />
            <p className="text-sm font-semibold text-paper">
              You haven&apos;t built any flows yet
            </p>
            <p className="mt-1 text-xs text-ash">
              Create a custom routine to get started
            </p>
          </div>
        )}

        {/* Routine cards */}
        <div className="flex flex-col gap-3">
          {routines.map((routine) => (
            <button
              key={routine.id}
              type="button"
              onClick={() => setSelectedRoutine(routine)}
              className="group flex items-center gap-4 rounded-card bg-surface p-4 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon transition-colors group-hover:bg-neon/15">
                <Play size={20} fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-paper">
                  {routine.name}
                </span>
                <span className="text-xs text-ash">
                  {routine.exercises.length}{' '}
                  {routine.exercises.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Create Custom Flow CTA — hidden when at max */}
        {canCreateMore && (
          <button
            type="button"
            onClick={() => navigate('/builder')}
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-card border border-dashed border-neon/40 bg-neon/5 py-4 text-neon transition-all hover:bg-neon/10 hover:border-neon/60 active:scale-[0.98]"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span className="text-sm font-bold uppercase tracking-wider">
              Create Custom Flow
            </span>
          </button>
        )}
      </div>

      {/* Today's Flow */}
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

      {swapBoost && (
        <SwapSheet
          exerciseName={swapBoost.exercise.name_translations.en ?? 'Exercise'}
          onClose={() => setSwapBoostId(null)}
          onConfirm={handleSwapConfirm}
        />
      )}

      {selectedRoutine && (
        <FlowOverviewSheet
          routine={selectedRoutine}
          onStart={handleStartWorkout}
          onClose={() => setSelectedRoutine(null)}
        />
      )}
    </div>
  );
}
