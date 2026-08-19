import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dumbbell, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';

import { api } from '../api/client';
import type { Exercise } from '../types/boost';
import type { RoutineExercise } from '../components/builder/RoutineEditor';
import { RoutineRow } from '../components/builder/RoutineEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Persisted custom routine stored in Capacitor Preferences. */
export interface CustomRoutine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'custom_routines';

export async function loadRoutines(): Promise<CustomRoutine[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  if (!value) return [];
  try {
    return JSON.parse(value) as CustomRoutine[];
  } catch {
    return [];
  }
}

export async function saveRoutines(routines: CustomRoutine[]): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(routines) });
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;
const DEFAULT_REST = 60;

// ---------------------------------------------------------------------------
// Exercise Picker Bottom Sheet
// ---------------------------------------------------------------------------

interface ExercisePickerSheetProps {
  exercises: Exercise[];
  alreadySelected: Set<string>;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

function ExercisePickerSheet({
  exercises,
  alreadySelected,
  onSelect,
  onClose,
}: ExercisePickerSheetProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the search input when the sheet opens.
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return exercises;
    const q = search.toLowerCase();
    return exercises.filter((ex) => {
      const name = (ex.name_translations.en ?? ex.id).toLowerCase();
      return name.includes(q);
    });
  }, [exercises, search]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add exercise"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-card bg-surface p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-paper">
            Add Exercise
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:text-paper"
          >
            <X size={18} />
          </button>
        </header>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ash"
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-card border border-white/10 bg-ink py-3 pl-10 pr-4 text-sm text-paper placeholder-ash/50 outline-none transition-colors focus:border-neon/40"
          />
        </div>

        {/* List */}
        <div className="max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-ash">
              No exercises found
            </p>
          )}
          {filtered.map((ex) => {
            const name = ex.name_translations.en ?? ex.id;
            const isAlreadySelected = alreadySelected.has(ex.id);
            return (
              <button
                key={ex.id}
                type="button"
                disabled={isAlreadySelected}
                onClick={() => onSelect(ex)}
                className="flex w-full items-center gap-3 rounded-card px-4 py-3 text-left transition-colors hover:bg-white/[0.07] disabled:opacity-40"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-neon">
                  <Dumbbell size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-paper">
                    {name}
                  </span>
                  <span className="block text-xs text-ash">
                    {ex.movement_pattern} &middot; {ex.equipment_required}
                  </span>
                </div>
                {isAlreadySelected && (
                  <span className="text-xs font-bold text-neon">Added</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function WorkoutBuilderPage() {
  const navigate = useNavigate();

  // Routine metadata
  const [routineName, setRoutineName] = useState('My Custom Flow');

  // Routine exercises
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>(
    [],
  );

  // Exercise catalogue
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(true);

  // Exercise picker sheet
  const [pickerOpen, setPickerOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const selectedIds = useMemo(
    () => new Set(routineExercises.map((r) => r.exerciseId)),
    [routineExercises],
  );

  // Load exercises on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getExercises();
        if (!cancelled) setAllExercises(data);
      } catch {
        // Silent — picker degrades gracefully.
      } finally {
        if (!cancelled) setExercisesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Handlers ---

  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const addExercise = useCallback(
    (exercise: Exercise) => {
      setRoutineExercises((prev) => [
        ...prev,
        {
          exerciseId: exercise.id,
          exerciseName: exercise.name_translations.en ?? exercise.id,
          movementPattern: exercise.movement_pattern,
          sets: DEFAULT_SETS,
          reps: DEFAULT_REPS,
          restSeconds: DEFAULT_REST,
        },
      ]);
      setPickerOpen(false);
    },
    [],
  );

  const updateExercise = useCallback(
    (
      index: number,
      patch: Partial<Omit<RoutineExercise, 'exerciseId' | 'exerciseName' | 'movementPattern'>>,
    ) => {
      setRoutineExercises((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const moveExercise = useCallback((fromIndex: number, direction: -1 | 1) => {
    setRoutineExercises((prev) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const removeExercise = useCallback((index: number) => {
    setRoutineExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    if (routineExercises.length === 0) {
      showToast('Add at least one exercise');
      return;
    }

    const existing = await loadRoutines();
    if (existing.length >= 4) {
      showToast('Maximum of 4 custom flows reached');
      return;
    }

    const routine: CustomRoutine = {
      id: `routine_${Date.now()}`,
      name: routineName.trim() || 'My Custom Flow',
      exercises: routineExercises,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveRoutines([...existing, routine]);
      showToast('Routine saved!');
      setTimeout(() => navigate('/'), 800);
    } catch {
      showToast('Failed to save — try again');
    }
  }, [routineName, routineExercises, navigate, showToast]);

  return (
    <div className="flex min-h-screen flex-col bg-ink pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-ink/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-semibold text-ash transition-colors hover:text-paper"
          >
            <X size={18} />
            Cancel
          </button>
          <h1 className="font-display text-base font-bold text-paper">
            Custom Builder
          </h1>
          <div className="w-16" />
        </div>
      </div>

      {/* Routine Name */}
      <div className="px-4 pt-2">
        <label
          htmlFor="routine-name"
          className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-ash"
        >
          Routine Name
        </label>
        <input
          id="routine-name"
          type="text"
          value={routineName}
          onChange={(e) => setRoutineName(e.target.value)}
          placeholder="My Custom Flow"
          className="w-full rounded-card border border-white/10 bg-surface px-4 py-3 text-sm font-semibold text-paper placeholder-ash/40 outline-none transition-colors focus:border-neon/40"
        />
      </div>

      {/* Routine exercises list */}
      <div className="mt-6 flex-1 px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ash">
            Exercises
          </h2>
          {routineExercises.length > 0 && (
            <span className="text-xs text-ash">
              {routineExercises.length}{' '}
              {routineExercises.length === 1 ? 'exercise' : 'exercises'}
            </span>
          )}
        </div>

        {routineExercises.length === 0 && (
          <div className="rounded-card border border-dashed border-white/10 py-12 text-center">
            <Dumbbell size={28} className="mx-auto mb-3 text-ash/40" />
            <p className="text-sm text-ash">
              No exercises yet. Tap below to add your first.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {routineExercises.map((item, index) => (
            <RoutineRow
              key={`${item.exerciseId}-${index}`}
              item={item}
              index={index}
              total={routineExercises.length}
              onSetsChange={(sets) => updateExercise(index, { sets })}
              onRepsChange={(reps) => updateExercise(index, { reps })}
              onRestChange={(restSeconds) =>
                updateExercise(index, { restSeconds })
              }
              onMoveUp={() => moveExercise(index, -1)}
              onMoveDown={() => moveExercise(index, 1)}
              onRemove={() => removeExercise(index)}
            />
          ))}
        </div>

        {/* Add Exercise button */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-neon/30 bg-neon/5 py-4 text-sm font-bold text-neon transition-all hover:bg-neon/10 hover:border-neon/50 active:scale-[0.98]"
        >
          <Plus size={18} />
          Add Exercise
        </button>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-ink/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={exercisesLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-neon py-4 text-base font-black uppercase tracking-widest text-ink shadow-neon-glow transition-all hover:shadow-neon-glow-strong active:scale-[0.97]"
          >
            Save Routine
          </button>
        </div>
      </div>

      {/* Exercise picker sheet */}
      {pickerOpen && (
        <ExercisePickerSheet
          exercises={allExercises}
          alreadySelected={selectedIds}
          onSelect={addExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-neon px-5 py-2.5 text-sm font-bold text-ink shadow-neon-glow"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
