import { Check, Zap } from 'lucide-react';

interface EnergyMapProps {
  /** Total bubbles rendered (defaults to the last 14 days). */
  days?: number;
  /** How many of the preceding days are completed. */
  completedDays?: number;
}

/** Horizontal streak mosaic: completed days glow warm, today pulses. */
export function EnergyMap({ days = 14, completedDays = 0 }: EnergyMapProps) {
  const bubbles = Array.from({ length: days }, (_, index) => {
    const isToday = index === days - 1;
    const isCompleted = index < completedDays;
    return { isToday, isCompleted };
  });

  return (
    <div className="pl-4">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-ash">
        Energy Map
      </h2>
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-4 pr-4">
        {bubbles.map(({ isToday, isCompleted }, index) => (
          <div
            key={index}
            className={`relative flex h-12 w-12 flex-shrink-0 snap-start items-center justify-center rounded-full ${
              isCompleted
                ? 'bg-ember text-ink shadow-sm'
                : 'border-2 border-ash/40 text-transparent'
            } ${isToday ? 'border-[3px] border-ember' : ''}`}
          >
            {isToday && (
              <div className="absolute inset-0 animate-ping rounded-full bg-ember opacity-20" />
            )}
            {isCompleted && <Check size={16} strokeWidth={3} />}
            {isToday && <Zap size={20} className="text-ink" fill="currentColor" />}
          </div>
        ))}
      </div>
    </div>
  );
}
