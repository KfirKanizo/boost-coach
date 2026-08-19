import { Trophy, ArrowLeft } from 'lucide-react';

interface ExerciseSummary {
  name: string;
  sets: number;
  repsPerSet: number;
  isDuration?: boolean;
}

interface CompletionScreenProps {
  exercises: ExerciseSummary[];
  onReturn: () => void;
}

/**
 * Workout-complete summary shown after the final set of the final exercise.
 *
 * Uses the same dark overlay as the other runner phases, with a neon
 * accent on the trophy and a clean exercise-by-exercise breakdown.
 */
export function CompletionScreen({ exercises, onReturn }: CompletionScreenProps) {
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const totalReps = exercises.reduce((sum, e) => sum + e.sets * e.repsPerSet, 0);
  const hasDuration = exercises.some((e) => e.isDuration);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-8 text-center">
      {/* Trophy */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neon/30 bg-neon/10">
        <Trophy size={28} className="text-neon" />
      </div>

      <h2 className="font-display text-2xl font-black tracking-tight text-paper">
        Workout Complete
      </h2>
      <p className="mt-1 text-sm text-ash">
        {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} &middot;{' '}
        {totalSets} sets &middot;{' '}
        {hasDuration ? `${totalReps}s total` : `${totalReps} total reps`}
      </p>

      {/* Exercise breakdown */}
      <div className="mt-6 w-full max-w-xs rounded-card border border-white/[0.06] bg-white/[0.03]">
        {exercises.map((ex, i) => (
          <div
            key={`${ex.name}-${i}`}
            className={`flex items-center justify-between px-4 py-3 text-sm ${
              i > 0 ? 'border-t border-white/[0.06]' : ''
            }`}
          >
            <span className="truncate font-semibold text-paper">{ex.name}</span>
            <span className="ml-2 shrink-0 text-ash">
              {ex.sets}&times;{ex.repsPerSet}{ex.isDuration ? 's' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Return button */}
      <button
        type="button"
        onClick={onReturn}
        className="mt-8 flex items-center gap-2 rounded-full bg-neon px-8 py-3.5 text-sm font-black uppercase tracking-widest text-ink shadow-neon-glow transition-all hover:shadow-neon-glow-strong active:scale-[0.97]"
      >
        <ArrowLeft size={18} />
        Return to Dashboard
      </button>
    </div>
  );
}
