import { useCallback, useEffect, useState } from 'react';
import { Dumbbell, Play, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/client';
import type { Exercise } from '../types/boost';
import type { RoutineExercise } from '../components/builder/RoutineEditor';

type EquipmentFilter = 'all' | 'bodyweight' | 'weights';

const MUSCLE_CHIPS = [
  { label: 'All', value: '' },
  { label: 'Squat', value: 'squat' },
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Hinge', value: 'hinge' },
  { label: 'Core', value: 'core' },
] as const;

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;
const DEFAULT_REST = 60;

function matchesEquipment(ex: Exercise, filter: EquipmentFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'bodyweight') return ex.equipment_required === 'bodyweight';
  return ex.equipment_required !== 'bodyweight';
}

// ---------------------------------------------------------------------------
// Quick Start Bottom Sheet
// ---------------------------------------------------------------------------

interface QuickStartSheetProps {
  exercise: Exercise;
  onClose: () => void;
}

function QuickStartSheet({ exercise, onClose }: QuickStartSheetProps) {
  const navigate = useNavigate();
  const [sets, setSets] = useState(DEFAULT_SETS);
  const [reps, setReps] = useState(DEFAULT_REPS);
  const [rest, setRest] = useState(DEFAULT_REST);

  const name = exercise.name_translations.en ?? exercise.id;
  const isDuration = exercise.boost_type === 'DURATION';

  const handleStart = useCallback(() => {
    const sessionExercise: RoutineExercise = {
      exerciseId: exercise.id,
      exerciseName: name,
      movementPattern: exercise.movement_pattern,
      sets,
      reps,
      restSeconds: rest,
      animationUrl: exercise.animation_url,
      instructions: exercise.instructions,
    };
    navigate('/workout', { state: { sessionExercises: [sessionExercise] } });
  }, [exercise, name, sets, reps, rest, navigate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Quick start: ${name}`}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-card bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-paper">{name}</h2>
            <p className="mt-0.5 text-xs text-ash">
              {isDuration ? 'Duration exercise' : 'Rep-counted exercise'} &middot;{' '}
              {exercise.movement_pattern}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:text-paper"
          >
            <X size={18} />
          </button>
        </header>

        {/* Config */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex flex-wrap items-center justify-center gap-5">
            {/* Sets */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ash">Sets</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={sets <= 1}
                  onClick={() => setSets((s) => Math.max(1, s - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
                >
                  &minus;
                </button>
                <span className="min-w-[2ch] text-center text-lg font-bold text-paper">{sets}</span>
                <button
                  type="button"
                  disabled={sets >= 10}
                  onClick={() => setSets((s) => Math.min(10, s + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>

            {/* Reps / Duration */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ash">
                {isDuration ? 'Secs' : 'Reps'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reps <= 1}
                  onClick={() => setReps((r) => Math.max(1, r - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
                >
                  &minus;
                </button>
                <span className="min-w-[2ch] text-center text-lg font-bold text-paper">{reps}</span>
                <button
                  type="button"
                  disabled={reps >= 60}
                  onClick={() => setReps((r) => Math.min(60, r + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>

            {/* Rest */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ash">Rest</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={rest <= 0}
                  onClick={() => setRest((r) => Math.max(0, r - 15))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
                >
                  &minus;
                </button>
                <span className="min-w-[3ch] text-center text-lg font-bold text-paper">{rest}s</span>
                <button
                  type="button"
                  disabled={rest >= 300}
                  onClick={() => setRest((r) => Math.min(300, r + 15))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pt-4 pb-8">
          <button
            type="button"
            onClick={handleStart}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neon py-4 text-base font-black uppercase tracking-widest text-ink shadow-neon-glow transition-all hover:shadow-neon-glow-strong active:scale-[0.97]"
          >
            <Play size={20} fill="currentColor" />
            Start Exercise
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all');
  const [muscleFilter, setMuscleFilter] = useState('');
  const [search, setSearch] = useState('');

  // Quick start sheet state
  const [quickStartExercise, setQuickStartExercise] = useState<Exercise | null>(null);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getExercises();
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load exercises');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  const filtered = exercises.filter((ex) => {
    if (!matchesEquipment(ex, equipmentFilter)) return false;
    if (muscleFilter && ex.movement_pattern !== muscleFilter) return false;
    if (search) {
      const name = (ex.name_translations.en ?? ex.id).toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="pb-28 pt-4">
      {/* Header */}
      <div className="px-4 pt-2">
        <h1 className="font-display text-2xl font-bold text-paper">
          Exercise Library
        </h1>
        <p className="mt-1 text-sm text-ash">
          Browse and filter {exercises.length} exercises
        </p>
      </div>

      {/* Search */}
      <div className="mt-5 px-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ash"
          />
          <input
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-card border border-white/10 bg-surface py-3 pl-10 pr-4 text-sm text-paper placeholder-ash/50 outline-none transition-colors focus:border-neon/40"
          />
        </div>
      </div>

      {/* Equipment toggle */}
      <div className="mt-4 px-4">
        <div className="flex gap-2">
          {(
            [
              { label: 'All', value: 'all' },
              { label: 'Bodyweight', value: 'bodyweight' },
              { label: 'Weights', value: 'weights' },
            ] as const
          ).map(({ label, value }) => (
            <button
              key={value}
              type="button"
              aria-label={`Equipment: ${label}`}
              onClick={() => setEquipmentFilter(value)}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                equipmentFilter === value
                  ? 'bg-neon text-ink shadow-neon-glow'
                  : 'bg-surface text-ash hover:bg-white/[0.07]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Muscle / pattern chips */}
      <div className="mt-3 px-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {MUSCLE_CHIPS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              aria-label={`Pattern: ${label}`}
              onClick={() => setMuscleFilter(value)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                muscleFilter === value
                  ? 'border-neon/40 bg-neon/10 text-neon'
                  : 'border-white/10 bg-white/5 text-ash hover:bg-white/[0.07]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="mt-5 flex items-center justify-between px-4">
        <span className="text-xs font-semibold text-ash">
          {filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}
        </span>
      </div>

      {/* Exercise grid */}
      <div className="mt-3 px-4">
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-ash">
            Loading exercises…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-card bg-surface px-6 py-10 text-center text-sm text-ash">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-card bg-surface px-6 py-16 text-center">
            <p className="text-sm font-semibold text-paper">
              No exercises found
            </p>
            <p className="mt-1 text-xs text-ash">
              Try adjusting your filters or search
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((ex) => {
              const name = ex.name_translations.en ?? ex.id;
              const isBodyweight = ex.equipment_required === 'bodyweight';
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setQuickStartExercise(ex)}
                  className="group relative flex flex-col items-start gap-2 rounded-card bg-surface p-4 text-left transition-all hover:bg-white/[0.07] active:scale-[0.97]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-neon transition-colors group-hover:bg-neon/10">
                    <Dumbbell size={18} />
                  </div>

                  <span className="text-sm font-semibold leading-tight text-paper">
                    {name}
                  </span>

                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isBodyweight
                          ? 'bg-neon/10 text-neon'
                          : 'bg-ember/10 text-ember'
                      }`}
                    >
                      {isBodyweight ? 'Bodyweight' : 'Weights'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ash">
                      {ex.movement_pattern}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Start sheet */}
      {quickStartExercise && (
        <QuickStartSheet
          exercise={quickStartExercise}
          onClose={() => setQuickStartExercise(null)}
        />
      )}
    </div>
  );
}
