import { useEffect, useState } from 'react';
import { Zap, Dumbbell, Timer, Target } from 'lucide-react';
import { api } from '../../api/client';
import type { GamificationStats } from '../../api/client';
import { LevelProgress } from './LevelProgress';
import { WeeklyActivityTracker } from './WeeklyActivityTracker';
import { StatCard } from './StatCard';

export function GamificationDashboard() {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGamificationStats()
      .then(setStats)
      .catch(() => setError('Could not load stats'));
  }, []);

  if (error) return null;
  if (!stats) {
    return (
      <div className="mb-6 flex items-center justify-center rounded-card bg-surface py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* Level & XP */}
      <LevelProgress
        level={stats.level}
        currentXp={stats.total_xp}
        xpForCurrentLevel={stats.xp_current_level}
        xpForNextLevel={stats.xp_next_level}
        totalXp={stats.total_xp}
      />

      {/* Weekly Activity */}
      <WeeklyActivityTracker
        activityDays={stats.activity_days}
        sessionsThisWeek={stats.sessions_this_week}
        weeklyGoal={stats.weekly_goal}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Dumbbell}
          label="Full Routines"
          value={stats.full_routines}
        />
        <StatCard
          icon={Timer}
          label="Single Exercises"
          value={stats.single_exercises}
        />
        <StatCard
          icon={Target}
          label="Verified Reps"
          value={stats.total_verified_reps}
        />
        <StatCard
          icon={Zap}
          label="Total Reps"
          value={stats.total_reps}
        />
      </div>

      {/* Streak highlight */}
      {stats.current_streak > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-card border border-ember/20 bg-ember/5 py-3">
          <Zap size={16} className="text-ember" fill="currentColor" />
          <span className="text-sm font-bold text-ember">
            {stats.current_streak} Day Streak
          </span>
          <span className="text-xs text-ash">— keep it going!</span>
        </div>
      )}
    </div>
  );
}
