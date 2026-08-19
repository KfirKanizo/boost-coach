import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface WeeklyGoalWidgetProps {
  /** Allow external override (e.g. optimistic update after completing a workout). */
  sessionsThisWeek?: number;
}

const RING_SIZE = 80;
const STROKE = 6;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WeeklyGoalWidget({ sessionsThisWeek: externalCount }: WeeklyGoalWidgetProps) {
  const [data, setData] = useState<{ sessions: number; goal: number }>({ sessions: 0, goal: 4 });

  useEffect(() => {
    if (externalCount !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const stats = await api.getWeeklyStats();
        if (!cancelled) {
          setData({ sessions: stats.sessions_this_week, goal: stats.weekly_goal });
        }
      } catch {
        // Silent — widget degrades gracefully
      }
    })();
    return () => { cancelled = true; };
  }, [externalCount]);

  const sessions = externalCount ?? data.sessions;
  const goal = data.goal;
  const progress = Math.min(1, sessions / goal);
  const dashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex items-center gap-5 rounded-card bg-surface px-5 py-4">
      {/* SVG progress ring */}
      <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-white/[0.06]"
          />
          {/* Progress */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            className="text-neon transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-timer text-lg font-bold leading-none text-paper">
            {sessions}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-ash">
            /{goal}
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="min-w-0">
        <p className="text-sm font-bold text-paper">Weekly Goal</p>
        <p className="mt-0.5 text-xs text-ash">
          {sessions >= goal
            ? 'Goal reached! Keep it up'
            : `${goal - sessions} more ${goal - sessions === 1 ? 'workout' : 'workouts'} this week`}
        </p>
      </div>
    </div>
  );
}
