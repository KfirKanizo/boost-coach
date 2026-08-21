import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';

interface LevelProgressProps {
  level: number;
  currentXp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  totalXp: number;
}

/**
 * Animated count-up hook using setInterval (jsdom-compatible).
 * Increments from 0 → target over `duration` ms with ease-out cubic.
 */
function useCountUp(target: number, duration = 1000): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    const STEP = 16;
    const steps = Math.ceil(duration / STEP);
    let step = 0;

    const id = setInterval(() => {
      step += 1;
      const progress = Math.min(step / steps, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress >= 1) clearInterval(id);
    }, STEP);

    return () => clearInterval(id);
  }, [target, duration]);

  return display;
}

export function LevelProgress({
  level,
  xpForCurrentLevel,
  xpForNextLevel,
  totalXp,
}: LevelProgressProps) {
  const xpIntoLevel = totalXp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const isMaxLevel = level >= 50;
  const isFull = !isMaxLevel && xpNeeded > 0 && xpIntoLevel >= xpNeeded;
  const pct = isMaxLevel ? 100 : xpNeeded > 0 ? Math.min(100, (xpIntoLevel / xpNeeded) * 100) : 100;
  const displayXp = useCountUp(totalXp);

  return (
    <section className="rounded-card bg-surface p-5">
      <div className="flex items-center gap-4">
        {/* Level badge */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          {/* Glow ring — pulses when bar is full */}
          <div className={`absolute inset-0 rounded-full border-2 bg-neon/10 ${isFull ? 'border-neon/60 animate-pulse' : 'border-neon/30'}`} />
          <div className="relative flex flex-col items-center">
            <Shield size={20} className="text-neon" />
            <span className="font-display text-lg font-black leading-none text-neon">
              {level}
            </span>
          </div>
        </div>

        {/* Progress info */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-bold text-paper">Level {level}</span>
            <span className="font-timer text-xs text-ash">
              {isMaxLevel ? (
                <span className="font-bold text-neon">MAX</span>
              ) : (
                <>{(xpIntoLevel).toLocaleString()} / {xpNeeded.toLocaleString()} XP</>
              )}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-neon to-neon/70 transition-all duration-500 ${isFull ? 'shadow-[0_0_8px_rgba(0,230,118,0.5)]' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {!isMaxLevel && (
            <p className="mt-1.5 text-[11px] text-ash">
              {isFull ? (
                <span className="font-bold text-neon">Ready to level up!</span>
              ) : (
                <>{(xpNeeded - xpIntoLevel).toLocaleString()} XP to Level {level + 1}</>
              )}
            </p>
          )}
          {isMaxLevel && (
            <p className="mt-1.5 text-[11px] font-bold text-neon">
              MAX LEVEL REACHED
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
