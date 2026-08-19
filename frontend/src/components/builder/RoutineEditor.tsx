import { ArrowDown, ArrowUp, Dumbbell, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single exercise inside a custom routine, with configuration. */
export interface RoutineExercise {
  exerciseId: string;
  exerciseName: string;
  movementPattern: string;
  sets: number;
  reps: number;
  restSeconds: number;
  animationUrl?: string;
}

// ---------------------------------------------------------------------------
// Stepper (inline + / - controls)
// ---------------------------------------------------------------------------

interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export function Stepper({
  label,
  value,
  min = 1,
  max = 99,
  step = 1,
  suffix = '',
  onChange,
}: StepperProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ash">
        {label}
      </span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
      >
        &minus;
      </button>
      <span className="min-w-[2ch] text-center text-xs font-bold text-paper">
        {value}
        {suffix}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Routine Exercise Row
// ---------------------------------------------------------------------------

interface RoutineRowProps {
  item: RoutineExercise;
  index: number;
  total: number;
  onSetsChange: (sets: number) => void;
  onRepsChange: (reps: number) => void;
  onRestChange: (rest: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function RoutineRow({
  item,
  index,
  total,
  onSetsChange,
  onRepsChange,
  onRestChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: RoutineRowProps) {
  return (
    <div className="rounded-card bg-white/[0.04] p-4">
      {/* Header row: name + reorder + trash */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neon/10 text-neon">
          <Dumbbell size={14} />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-paper">
          {item.exerciseName}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Move ${item.exerciseName} up`}
            disabled={index === 0}
            onClick={onMoveUp}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-25"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            aria-label={`Move ${item.exerciseName} down`}
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ash transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-25"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            aria-label={`Remove ${item.exerciseName}`}
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ash transition-colors hover:bg-crimson/15 hover:text-crimson"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Config steppers */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Stepper
          label="Sets"
          value={item.sets}
          min={1}
          max={10}
          onChange={onSetsChange}
        />
        <Stepper
          label="Reps"
          value={item.reps}
          min={1}
          max={50}
          onChange={onRepsChange}
        />
        <Stepper
          label="Rest"
          value={item.restSeconds}
          min={0}
          max={300}
          step={15}
          suffix="s"
          onChange={onRestChange}
        />
      </div>
    </div>
  );
}
