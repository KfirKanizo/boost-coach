import { RefreshCw, Timer } from 'lucide-react';
import type { Boost } from '../../types/boost';

interface BoostCardProps {
  boost: Boost;
  onSwap: (boostId: string) => void;
}

function formatTarget(boost: Boost): string {
  const metrics = boost.target_metrics;
  if ('reps' in metrics) return `${metrics.sets ?? 4} sets • ${metrics.reps} reps`;
  if ('duration_sec' in metrics) return `${metrics.sets ?? 3} sets • ${metrics.duration_sec} sec`;
  return 'Daily Boost';
}

export function BoostCard({ boost, onSwap }: BoostCardProps) {
  const name = boost.exercise.name_translations.en ?? 'Exercise';
  const completed = boost.status === 'completed';

  return (
    <article
      className={`relative flex items-center justify-between overflow-hidden rounded-card bg-surface p-6 ${
        completed ? 'opacity-60' : ''
      }`}
    >
      <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-neon/15 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-1">
        <span className="font-display text-xl font-bold text-paper">{name}</span>
        <span className="flex items-center gap-1.5 text-sm text-ash">
          <Timer size={14} />
          {formatTarget(boost)}
        </span>
        {completed && (
          <span className="mt-1 w-max rounded-full bg-neon/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neon">
            Completed
          </span>
        )}
      </div>

      <button
        type="button"
        aria-label={`Swap ${name}`}
        onClick={() => onSwap(boost.id)}
        className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-neon transition-colors hover:bg-white/10 active:scale-95"
      >
        <RefreshCw size={20} />
      </button>
    </article>
  );
}
