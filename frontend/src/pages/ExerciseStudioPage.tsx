import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { StudioFactory } from '../components/studio/StudioFactory';
import type { Exercise } from '../types/boost';

/**
 * Entry point for exercises clicked from THE FLOW picker.
 *
 * Receives the Exercise object via route state (fast path) and renders
 * the matching StudioFactory directly — no config modal, no extra steps.
 * The tracker component loads persisted config and shows ⚙️ on the HUD.
 */
export function ExerciseStudioPage() {
  const { exercise_id: exerciseId = '' } = useParams<{ exercise_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const exercise = (location.state as { exercise?: Exercise } | null)?.exercise;

  if (!exercise || exercise.id !== exerciseId) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
        <p className="text-sm text-ash">Exercise not found</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 text-sm font-bold text-neon"
        >
          Back to The Flow
        </button>
      </div>
    );
  }

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
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold tracking-tight">
            {exercise.name_translations.en ?? 'Exercise'}
          </h1>
          <p className="text-xs uppercase tracking-widest text-ash">
            {exercise.movement_pattern}
          </p>
        </div>
      </div>

      <div className="flex-1">
        <StudioFactory
          boostType={exercise.boost_type}
          exerciseId={exercise.id}
          exerciseName={exercise.name_translations.en ?? 'Exercise'}
          movementPattern={exercise.movement_pattern as 'squat' | 'push'}
        />
      </div>
    </div>
  );
}
