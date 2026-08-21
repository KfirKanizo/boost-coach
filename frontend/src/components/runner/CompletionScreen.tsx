import { useEffect, useState } from 'react';
import { Trophy, ArrowLeft, Zap, Shield } from 'lucide-react';
import { playLevelUpSound } from '../../services/audio';

interface ExerciseSummary {
  name: string;
  sets: number;
  repsPerSet: number;
  isDuration?: boolean;
}

interface CompletionScreenProps {
  exercises: ExerciseSummary[];
  verifiedReps: number;
  targetReps: number;
  xpEarned: number;
  newLevel?: number;
  previousLevel?: number;
  onReturn: () => void;
}

/**
 * Count-up animation hook: increments from 0 → target over `duration` ms.
 * Uses setTimeout for test-environment compatibility (rAF doesn't fire in jsdom).
 */
function useCountUp(target: number, duration = 1200): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    const STEP = 16; // ~60fps
    const steps = Math.ceil(duration / STEP);
    let step = 0;

    const id = setInterval(() => {
      step += 1;
      const progress = Math.min(step / steps, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress >= 1) clearInterval(id);
    }, STEP);

    return () => clearInterval(id);
  }, [target, duration]);

  return display;
}

/** Deterministic confetti particles for the level-up celebration. */
const CONFETTI_COLORS = ['#A3FFB0', '#FFD93D', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FF9FF3'];

function ConfettiParticle({ index }: { index: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = (index * 17 + 7) % 100;
  const delay = (index * 0.13) % 1.2;
  const size = 6 + (index % 4) * 2;
  const drift = ((index * 23) % 40) - 20;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '-8px',
        left: `${left}%`,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: index % 3 === 0 ? '50%' : '2px',
        animation: `confetti-fall 1.8s ease-in ${delay}s forwards`,
        transform: `translateX(${drift}px)`,
      }}
    />
  );
}

/**
 * Workout-complete summary shown after the final set of the final exercise.
 *
 * Shows verified reps vs target, a count-up XP animation, an
 * exercise-by-exercise breakdown, and a "Level Up!" celebration when
 * the user's level increases.
 */
export function CompletionScreen({
  exercises,
  verifiedReps,
  targetReps,
  xpEarned,
  newLevel,
  previousLevel,
  onReturn,
}: CompletionScreenProps) {
  const totalSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const totalReps = exercises.reduce((sum, e) => sum + e.sets * e.repsPerSet, 0);
  const hasDuration = exercises.some((e) => e.isDuration);
  const targetHit = targetReps > 0 && verifiedReps >= targetReps;
  const leveledUp = newLevel != null && previousLevel != null && newLevel > previousLevel;

  // Play level-up fanfare when the celebration overlay appears
  useEffect(() => {
    if (leveledUp) playLevelUpSound();
  }, [leveledUp]);

  const animatedXp = useCountUp(xpEarned);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-8 text-center">
      {/* ── Level Up celebration overlay ─────────────────────────── */}
      {leveledUp && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/90">
          {/* Confetti particles */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => (
              <ConfettiParticle key={i} index={i} />
            ))}
          </div>

          {/* Shield icon with glow */}
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-full border-2 border-neon/50 bg-neon/15" />
            <Shield size={36} className="relative text-neon" fill="currentColor" />
          </div>

          <h2 className="font-display text-3xl font-black tracking-tight text-neon animate-bounce">
            Level Up!
          </h2>
          <p className="mt-2 text-lg font-bold text-paper">
            You reached Level {newLevel}
          </p>
          <p className="mt-1 text-sm text-ash">
            {previousLevel} &rarr; {newLevel}
          </p>
        </div>
      )}

      {/* ── Standard completion content ──────────────────────────── */}
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

      {/* XP Badge */}
      <div className="mt-5 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-5 py-2.5">
          <Zap size={18} className="text-neon" fill="currentColor" />
          <span className="font-timer text-2xl font-black text-neon">
            {animatedXp}
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-neon/70">
            XP
          </span>
        </div>
        {targetReps > 0 && (
          <span className="mt-1 text-xs text-ash">
            {verifiedReps} / {targetReps} verified reps
            {targetHit && (
              <span className="ml-1.5 font-bold text-neon">+50 target bonus!</span>
            )}
          </span>
        )}
        {xpEarned === 0 && (
          <span className="mt-1 text-xs text-ash">
            Complete reps to earn XP
          </span>
        )}
      </div>

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
