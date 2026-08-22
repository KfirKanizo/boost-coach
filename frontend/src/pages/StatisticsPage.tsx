import { useState, useEffect } from 'react';
import { Brain, Clock, Dumbbell, Trophy } from 'lucide-react';
import { api } from '../api/client';
import type { GamificationStats } from '../api/client';
import { InfoTooltip } from '../components/stats/InfoTooltip';

// ── Mock data ──────────────────────────────────────────────────────
interface MuscleDistribution {
  muscle: string;
  percentage: number;
}

interface PersonalRecord {
  exercise: string;
  maxReps: number;
  date: string;
}

interface WidgetData {
  accuracy: { percent: number; verified: number; total: number };
  volume: { activeMinutes: number; sessionsCompleted: number; avgDuration: number };
  muscleDistribution: MuscleDistribution[];
  personalRecords: PersonalRecord[];
}

const MOCK_DATA: WidgetData = {
  accuracy: { percent: 77, verified: 684, total: 888 },
  volume: { activeMinutes: 312, sessionsCompleted: 24, avgDuration: 13 },
  muscleDistribution: [
    { muscle: 'Legs', percentage: 40 },
    { muscle: 'Chest', percentage: 30 },
    { muscle: 'Core', percentage: 30 },
  ],
  personalRecords: [
    { exercise: 'Push-Up', maxReps: 42, date: '2026-08-10' },
    { exercise: 'Squat', maxReps: 38, date: '2026-08-15' },
    { exercise: 'Plank', maxReps: 30, date: '2026-08-18' },
    { exercise: 'Sit-Up', maxReps: 35, date: '2026-08-20' },
    { exercise: 'Lunge', maxReps: 28, date: '2026-08-12' },
  ],
};

const MUSCLE_COLORS: Record<string, string> = {
  Legs: 'from-emerald-400 to-neon',
  Chest: 'from-sky-400 to-blue-500',
  Core: 'from-amber-400 to-orange-500',
  Back: 'from-purple-400 to-violet-500',
  Shoulders: 'from-pink-400 to-rose-500',
  Arms: 'from-teal-400 to-cyan-500',
};

const TOOLTIPS = {
  accuracy:
    'The percentage of your reps that were fully validated by the kinematic AI\'s strict range of motion versus total attempted movements.',
  volume:
    'Total active workout time (excluding rest periods) and the number of sessions you\'ve completed this period.',
  muscleDistribution:
    'Breakdown of which muscle groups you\'ve trained most, based on the primary target of each exercise you\'ve performed.',
  personalRecords:
    'Your highest number of continuous reps completed in a single verified set for each foundational exercise.',
};

// ── Coach's Insight generator ─────────────────────────────────────
function generateInsight(data: WidgetData, stats: GamificationStats | null): string {
  const topMuscle = data.muscleDistribution[0];
  const accuracy = data.accuracy.percent;
  const sessions = stats?.sessions_this_week ?? 0;
  const streak = stats?.current_streak ?? 0;

  const parts: string[] = [];

  if (sessions >= 3) {
    parts.push(`You've crushed ${sessions} sessions this week`);
  } else if (sessions > 0) {
    parts.push(`You've logged ${sessions} session${sessions === 1 ? '' : 's'} this week`);
  } else {
    parts.push('Ready to start a new streak');
  }

  if (topMuscle && topMuscle.percentage >= 30) {
    parts.push(`with a strong focus on ${topMuscle.muscle.toLowerCase()} (${topMuscle.percentage}%)`);
  }

  if (accuracy >= 70) {
    parts.push(`maintaining a solid ${accuracy}% AI verification rate`);
  } else if (accuracy >= 50) {
    parts.push(`with room to improve your ${accuracy}% verification rate`);
  }

  if (streak >= 3) {
    parts.push(`and a ${streak}-day streak going strong`);
  }

  return parts.length > 0
    ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ', ' + parts.slice(1).join(', ') + '.'
    : 'Start training to see your personalized insights here.';
}

// ── Main page ─────────────────────────────────────────────────────
export function StatisticsPage() {
  const [data] = useState<WidgetData>(MOCK_DATA);
  const [stats, setStats] = useState<GamificationStats | null>(null);

  useEffect(() => {
    api
      .getGamificationStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const insight = generateInsight(data, stats);

  return (
    <div className="pb-28 pt-4">
      {/* Coach's Insight */}
      <div className="mx-4 mb-6 rounded-card border border-neon/20 bg-neon/5 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-neon/70">Coach&apos;s Insight</p>
        <p className="mt-1.5 text-sm leading-relaxed text-paper">{insight}</p>
      </div>

      <div className="flex flex-col gap-4 px-4">
        {/* ── AI Accuracy Score ─────────────────────────────────── */}
        <section className="rounded-card bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-neon" />
              <h3 className="text-sm font-bold text-paper">AI Accuracy Score</h3>
            </div>
            <InfoTooltip text={TOOLTIPS.accuracy} />
          </div>

          <div className="flex items-end gap-4">
            <span className="font-display text-4xl font-black text-neon">
              {data.accuracy.percent}%
            </span>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon to-neon/70 transition-all duration-700"
                  style={{ width: `${data.accuracy.percent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-ash">
                <span>{data.accuracy.verified.toLocaleString()} verified</span>
                <span>{data.accuracy.total.toLocaleString()} total reps</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Workout Volume ───────────────────────────────────── */}
        <section className="rounded-card bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-sky-400" />
              <h3 className="text-sm font-bold text-paper">Workout Volume</h3>
            </div>
            <InfoTooltip text={TOOLTIPS.volume} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/[0.03] p-4 text-center">
              <span className="font-display text-2xl font-black text-paper">
                {data.volume.activeMinutes}
              </span>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-ash">
                Active Minutes
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-4 text-center">
              <span className="font-display text-2xl font-black text-paper">
                {data.volume.sessionsCompleted}
              </span>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-ash">
                Sessions Done
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-xs text-ash">
            Avg. {data.volume.avgDuration} min per session
          </p>
        </section>

        {/* ── Muscle Distribution ──────────────────────────────── */}
        <section className="rounded-card bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell size={18} className="text-purple-400" />
              <h3 className="text-sm font-bold text-paper">Muscle Distribution</h3>
            </div>
            <InfoTooltip text={TOOLTIPS.muscleDistribution} />
          </div>

          <div className="flex flex-col gap-3">
            {data.muscleDistribution.map((item) => {
              const color = MUSCLE_COLORS[item.muscle] ?? 'from-gray-400 to-gray-500';
              return (
                <div key={item.muscle}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-paper">{item.muscle}</span>
                    <span className="text-xs font-bold text-ash">{item.percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Personal Records ─────────────────────────────────── */}
        <section className="rounded-card bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" />
              <h3 className="text-sm font-bold text-paper">Personal Records</h3>
            </div>
            <InfoTooltip text={TOOLTIPS.personalRecords} />
          </div>

          <div className="flex flex-col gap-2">
            {data.personalRecords.map((pr, i) => (
              <div
                key={pr.exercise}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[10px] font-bold text-amber-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-paper">
                    {pr.exercise}
                  </span>
                  <span className="text-[11px] text-ash">
                    {new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <span className="font-display text-lg font-black text-amber-400">
                  {pr.maxReps}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ash">
                  reps
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
