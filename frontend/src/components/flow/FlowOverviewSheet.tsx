import { useCallback, useState } from 'react';
import { Play, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RoutineExercise } from '../builder/RoutineEditor';
import { RoutineRow } from '../builder/RoutineEditor';
import type { CustomRoutine } from '../../pages/WorkoutBuilderPage';

interface FlowOverviewSheetProps {
  routine: CustomRoutine;
  onStart: (exercises: RoutineExercise[]) => void;
  onClose: () => void;
}

/**
 * Pre-flight bottom sheet: lets the user tweak a saved routine for the
 * upcoming session without altering the stored template.
 */
export function FlowOverviewSheet({
  routine,
  onStart,
  onClose,
}: FlowOverviewSheetProps) {
  const navigate = useNavigate();
  // Deep-clone the exercises array so edits are session-only.
  const [exercises, setExercises] = useState<RoutineExercise[]>(() =>
    routine.exercises.map((ex) => ({ ...ex })),
  );

  const updateExercise = useCallback(
    (
      index: number,
      patch: Partial<Omit<RoutineExercise, 'exerciseId' | 'exerciseName'>>,
    ) => {
      setExercises((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const moveExercise = useCallback((fromIndex: number, direction: -1 | 1) => {
    setExercises((prev) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const removeExercise = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStart = useCallback(() => {
    onStart(exercises);
    navigate('/workout', {
      state: { sessionExercises: exercises, routineId: routine.id },
    });
  }, [exercises, onStart, navigate, routine.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Overview: ${routine.name}`}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-t-card bg-surface"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-display text-lg font-bold text-paper">
            {routine.name}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:text-paper"
          >
            <X size={18} />
          </button>
        </header>

        {/* Exercise list — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ash">
            Session overrides
          </p>

          {exercises.length === 0 && (
            <div className="rounded-card border border-dashed border-white/10 py-10 text-center">
              <p className="text-sm text-ash">
                No exercises. Go back and add some.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {exercises.map((item, index) => (
              <RoutineRow
                key={`${item.exerciseId}-${index}`}
                item={item}
                index={index}
                total={exercises.length}
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
        </div>

        {/* Sticky CTA */}
        <div className="border-t border-white/5 px-6 pt-4 pb-32">
          <button
            type="button"
            onClick={handleStart}
            disabled={exercises.length === 0}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neon py-4 text-base font-black uppercase tracking-widest text-ink shadow-neon-glow transition-all hover:shadow-neon-glow-strong active:scale-[0.97] disabled:opacity-40 disabled:shadow-none"
          >
            <Play size={20} fill="currentColor" />
            Start Workout
          </button>
        </div>
      </div>
    </div>
  );
}
