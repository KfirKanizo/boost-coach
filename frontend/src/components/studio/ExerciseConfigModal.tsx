import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { ExerciseConfig } from '../../services/exerciseConfig';

interface ExerciseConfigModalProps {
  exerciseName: string;
  boostType: string;
  config: ExerciseConfig;
  onSave: (config: ExerciseConfig) => void;
  onClose: () => void;
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-paper/80">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-paper transition-transform active:scale-90 disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} />
        </button>
        <span className="min-w-[3rem] text-center font-timer text-lg font-bold tabular-nums text-paper">
          {value}
          <span className="ml-0.5 text-xs font-normal text-ash">{unit}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-paper transition-transform active:scale-90 disabled:opacity-30"
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Glassmorphism modal for editing per-exercise config (Sets, Reps/Duration,
 * Rest). The primary action is "Save" — it persists config and returns
 * the user to the Ready state.
 */
export function ExerciseConfigModal({
  exerciseName,
  boostType,
  config,
  onSave,
  onClose,
}: ExerciseConfigModalProps) {
  const [sets, setSets] = useState(config.sets);
  const [reps, setReps] = useState(config.reps);
  const [duration, setDuration] = useState(config.duration);
  const [restDuration, setRestDuration] = useState(config.restDuration);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isDuration = boostType === 'DURATION';

  const handleSave = useCallback(() => {
    onSave({ sets, reps, duration, restDuration });
  }, [sets, reps, duration, restDuration, onSave]);

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-xs rounded-2xl border border-white/10 bg-ink/80 p-5 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neon">
              Settings
            </p>
            <p className="mt-0.5 text-sm font-semibold text-paper truncate max-w-[200px]">
              {exerciseName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:text-paper"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <Stepper
            label="Sets"
            value={sets}
            min={1}
            max={10}
            step={1}
            unit=""
            onChange={setSets}
          />

          {!isDuration && (
            <Stepper
              label="Reps"
              value={reps}
              min={1}
              max={50}
              step={1}
              unit=""
              onChange={setReps}
            />
          )}

          {isDuration && (
            <Stepper
              label="Duration"
              value={duration}
              min={10}
              max={300}
              step={5}
              unit="s"
              onChange={setDuration}
            />
          )}

          <Stepper
            label="Rest"
            value={restDuration}
            min={0}
            max={180}
            step={5}
            unit="s"
            onChange={setRestDuration}
          />
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          className="mt-6 w-full rounded-full bg-neon py-3 text-sm font-bold uppercase tracking-widest text-ink shadow-neon-glow transition-all active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  );
}
