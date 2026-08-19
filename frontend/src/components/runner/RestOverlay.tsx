import { SkipForward } from 'lucide-react';

interface RestOverlayProps {
  secondsRemaining: number;
  totalSeconds: number;
  nextLabel: string;
  onSkip: () => void;
}

function formatRestTime(sec: number): string {
  return sec <= 0 ? '0' : String(sec);
}

/**
 * Glassmorphism rest overlay shown between sets.
 *
 * Renders a translucent blur layer on top of the (paused / dimmed) camera
 * feed with a large countdown timer, "up next" label, and skip button.
 */
export function RestOverlay({
  secondsRemaining,
  totalSeconds,
  nextLabel,
  onSkip,
}: RestOverlayProps) {
  const progress = totalSeconds > 0
    ? Math.max(0, (secondsRemaining / totalSeconds) * 100)
    : 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md bg-black/40">
      {/* Up next */}
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ash">
        Up Next
      </p>
      <p className="mb-8 max-w-[260px] text-center text-sm font-semibold text-paper/80">
        {nextLabel}
      </p>

      {/* Big countdown */}
      <div className="relative mb-2 flex h-32 w-32 items-center justify-center">
        {/* Ring */}
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 128 128"
          aria-hidden="true"
        >
          <circle
            cx="64"
            cy="64"
            r="58"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="4"
          />
          <circle
            cx="64"
            cy="64"
            r="58"
            fill="none"
            stroke="rgba(109,255,176,0.9)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 58}`}
            strokeDashoffset={`${2 * Math.PI * 58 * (1 - progress / 100)}`}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>

        <span className="font-timer text-6xl font-bold leading-none text-paper drop-shadow-lg">
          {formatRestTime(secondsRemaining)}
        </span>
      </div>

      <p className="mb-8 text-[10px] font-bold uppercase tracking-widest text-ash">
        seconds
      </p>

      {/* Skip rest */}
      <button
        type="button"
        onClick={onSkip}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-bold text-paper backdrop-blur transition-all active:scale-95"
      >
        <SkipForward size={16} />
        Skip Rest
      </button>
    </div>
  );
}
