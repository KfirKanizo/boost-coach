import { Flame } from 'lucide-react';

interface WeeklyActivityTrackerProps {
  activityDays: string[];
  sessionsThisWeek: number;
  weeklyGoal: number;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getWeekDays(): { label: string; dateStr: string; isToday: boolean }[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);

  return DAY_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return { label, dateStr, isToday };
  });
}

export function WeeklyActivityTracker({
  activityDays,
  sessionsThisWeek,
  weeklyGoal,
}: WeeklyActivityTrackerProps) {
  const days = getWeekDays();
  const crushed = sessionsThisWeek >= weeklyGoal * 2;
  const onTrack = sessionsThisWeek >= weeklyGoal;

  return (
    <section className="rounded-card bg-surface p-5">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-ember" fill="currentColor" />
          <span className="text-sm font-bold text-paper">This Week</span>
        </div>

        {crushed ? (
          <span className="flex items-center gap-1 rounded-full bg-neon/15 px-3 py-1 text-xs font-black text-neon">
            🎯 Target Crushed!
            <span className="ml-1 rounded bg-neon/20 px-1.5 py-0.5 text-[10px]">
              ×{Math.floor(sessionsThisWeek / weeklyGoal)}
            </span>
          </span>
        ) : onTrack ? (
          <span className="rounded-full bg-neon/15 px-3 py-1 text-xs font-bold text-neon">
            ✓ Goal Met
          </span>
        ) : (
          <span className="text-xs text-ash">
            {sessionsThisWeek}/{weeklyGoal} workouts
          </span>
        )}
      </div>

      {/* Day dots */}
      <div className="flex items-center justify-between">
        {days.map(({ label, dateStr, isToday }) => {
          const active = activityDays.includes(dateStr);
          return (
            <div key={dateStr} className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  active
                    ? 'bg-neon text-ink shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                    : isToday
                      ? 'border-2 border-neon/50 bg-neon/10 text-neon'
                      : 'bg-white/5 text-ash/60'
                }`}
              >
                <span className="text-xs font-bold">
                  {active ? '✓' : label}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold ${
                  isToday ? 'text-neon' : 'text-ash/50'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Subtle progress bar */}
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            crushed ? 'bg-neon' : onTrack ? 'bg-neon' : 'bg-ember'
          }`}
          style={{
            width: `${Math.min(100, (sessionsThisWeek / weeklyGoal) * 100)}%`,
          }}
        />
      </div>
    </section>
  );
}
