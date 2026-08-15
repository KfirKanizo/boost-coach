import { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import type { SwapReason } from '../../types/swap';

interface SwapSheetProps {
  /** Exercise name shown in the sheet header. */
  exerciseName: string;
  /** Runs the swap; must reject on failure so the sheet can surface it. */
  onConfirm: (reason: SwapReason) => Promise<void>;
  onClose: () => void;
}

const REASONS: { value: SwapReason; label: string; hint: string }[] = [
  {
    value: 'no_equipment',
    label: 'No Equipment',
    hint: 'Swap to a bodyweight alternative',
  },
  {
    value: 'muscle_sore',
    label: 'Muscle Soreness',
    hint: 'Swap to a gentler variation',
  },
];

/** Bottom-sheet swap picker: choose a reason, then POST /engine/swap. */
export function SwapSheet({ exerciseName, onConfirm, onClose }: SwapSheetProps) {
  const [pendingReason, setPendingReason] = useState<SwapReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (reason: SwapReason) => {
    setPendingReason(reason);
    setError(null);
    try {
      await onConfirm(reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setPendingReason(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Swap ${exerciseName}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-card bg-surface p-6 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/15 text-neon">
              <RefreshCw size={18} />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-paper">
                Swap Boost
              </h3>
              <p className="text-sm text-ash">{exerciseName}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:text-paper"
          >
            <X size={18} />
          </button>
        </header>

        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ash">
          Why are you swapping?
        </p>

        <div className="flex flex-col gap-3">
          {REASONS.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              disabled={pendingReason !== null}
              onClick={() => void handleSelect(value)}
              className="flex items-center justify-between rounded-card bg-white/5 px-5 py-4 text-left transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              <span>
                <span className="block font-semibold text-paper">{label}</span>
                <span className="block text-xs text-ash">{hint}</span>
              </span>
              {pendingReason === value && (
                <Loader2 size={18} className="animate-spin text-neon" />
              )}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-card bg-ember/15 px-4 py-3 text-sm text-ember"
          >
            <AlertTriangle size={16} />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
