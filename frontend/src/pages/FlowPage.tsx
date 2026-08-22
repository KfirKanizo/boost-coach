import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dumbbell, MoreVertical, Pencil, Play, Plus, Trash2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { FlowOverviewSheet } from '../components/flow/FlowOverviewSheet';
import { LevelProgress } from '../components/profile/LevelProgress';
import { WeeklyActivityTracker } from '../components/profile/WeeklyActivityTracker';
import type { GamificationStats } from '../api/client';
import type { RoutineExercise } from '../components/builder/RoutineEditor';
import type { CustomRoutine } from './WorkoutBuilderPage';
import { toFrontendRoutine } from './WorkoutBuilderPage';

const MAX_ROUTINES = 4;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function FlowPage() {
  const navigate = useNavigate();

  const [routines, setRoutines] = useState<CustomRoutine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<CustomRoutine | null>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);

  // ── 3-dot menu state ──────────────────────────────────────────────
  const [menuRoutineId, setMenuRoutineId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuRoutineId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuRoutineId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuRoutineId]);

  const todayDayIndex = new Date().getDay();

  const loadRoutines = useCallback(async () => {
    try {
      const items = await api.getRoutines();
      setRoutines(items.map(toFrontendRoutine));
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  useEffect(() => {
    const handleFocus = () => {
      void loadRoutines();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadRoutines]);

  useEffect(() => {
    api.getGamificationStats().then(setStats).catch(() => {});
  }, []);

  const canCreateMore = routines.length < MAX_ROUTINES;

  // ── Edit routine: navigate to builder with routine ID ──────────────
  const handleEditRoutine = useCallback(
    (routineId: string) => {
      setMenuRoutineId(null);
      navigate(`/builder/${routineId}`);
    },
    [navigate],
  );

  // ── Delete routine ────────────────────────────────────────────────
  const handleDeleteRoutine = useCallback(async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await api.deleteRoutine(deleteConfirmId);
      setRoutines((prev) => prev.filter((r) => r.id !== deleteConfirmId));
    } catch {
      // Silent — best-effort
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
      setMenuRoutineId(null);
    }
  }, [deleteConfirmId]);

  // Routines scheduled for today
  const todaysRoutines = useMemo(
    () => routines.filter((r) => r.scheduleDays?.includes(todayDayIndex)),
    [routines, todayDayIndex],
  );

  const hasScheduledToday = todaysRoutines.length > 0;

  const handleStartWorkout = useCallback(
    (exercises: RoutineExercise[]) => {
      console.log('Initiating Runner with session data: ', exercises);
      setSelectedRoutine(null);
    },
    [],
  );

  return (
    <div className="pb-28 pt-4">
      {/* ── Gamification header ──────────────────────────────────── */}
      {stats && (
        <div className="flex flex-col gap-4 px-4">
          <LevelProgress
            level={stats.level}
            currentXp={stats.total_xp}
            xpForCurrentLevel={stats.xp_current_level}
            xpForNextLevel={stats.xp_next_level}
            totalXp={stats.total_xp}
          />
          <WeeklyActivityTracker
            activityDays={stats.activity_days}
            sessionsThisWeek={stats.sessions_this_week}
            weeklyGoal={stats.weekly_goal}
          />
        </div>
      )}

      {/* ── TODAY'S FLOW (scheduled routines) ─────────────────────── */}
      <div className="px-4 pt-2">
        <div className="mb-5 flex items-center gap-2">
          <Zap size={18} className="text-neon" fill="currentColor" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ash">
            Today&apos;s Flow
          </h2>
        </div>

        {hasScheduledToday ? (
          <div className="flex flex-col gap-3">
            {todaysRoutines.map((routine) => (
              <button
                key={routine.id}
                type="button"
                onClick={() => setSelectedRoutine(routine)}
                className="group flex items-center gap-4 rounded-card bg-surface p-4 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon transition-colors group-hover:bg-neon/15">
                  <Play size={20} fill="currentColor" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-paper">
                    {routine.name}
                  </span>
                  <span className="text-xs text-ash">
                    {routine.exercises.length}{' '}
                    {routine.exercises.length === 1 ? 'exercise' : 'exercises'}
                    {' \u00b7 '}
                    Scheduled for today
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-white/10 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-paper">Rest Day!</p>
            <p className="mt-1 text-xs text-ash">
              Or pick a flow below
            </p>
          </div>
        )}
      </div>

      {/* ── All Custom Flows ──────────────────────────────────────── */}
      <div className="mt-8 px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ash">
            My Custom Flows
          </h2>
          <span className="text-xs text-ash/60">
            {routines.length}/{MAX_ROUTINES}
          </span>
        </div>

        {routines.length === 0 && (
          <div className="rounded-card border border-dashed border-white/10 py-10 text-center">
            <Dumbbell size={28} className="mx-auto mb-3 text-ash/40" />
            <p className="text-sm font-semibold text-paper">
              You haven&apos;t built any flows yet
            </p>
            <p className="mt-1 text-xs text-ash">
              Create a custom routine to get started
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {routines.map((routine) => {
            const isToday = routine.scheduleDays?.includes(todayDayIndex);
            return (
              <div key={routine.id} className="relative">
                <button
                  type="button"
                  onClick={() => setSelectedRoutine(routine)}
                  className="group flex w-full items-center gap-4 rounded-card bg-surface p-4 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon transition-colors group-hover:bg-neon/15">
                    <Play size={20} fill="currentColor" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-paper">
                      {routine.name}
                    </span>
                    <span className="text-xs text-ash">
                      {routine.exercises.length}{' '}
                      {routine.exercises.length === 1 ? 'exercise' : 'exercises'}
                      {routine.scheduleDays && routine.scheduleDays.length > 0 && (
                        <>
                          {' \u00b7 '}
                          {routine.scheduleDays.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')}
                        </>
                      )}
                    </span>
                  </div>
                  {isToday && (
                    <span className="flex-shrink-0 rounded-full bg-neon/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon">
                      Today
                    </span>
                  )}
                </button>

                {/* 3-dot menu */}
                <div className="absolute right-3 top-3" ref={menuRoutineId === routine.id ? menuRef : undefined}>
                  <button
                    type="button"
                    aria-label={`Options for ${routine.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuRoutineId(menuRoutineId === routine.id ? null : routine.id);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ash transition-colors hover:bg-white/10 hover:text-paper"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {menuRoutineId === routine.id && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-lg">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRoutine(routine.id);
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-white/[0.07]"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuRoutineId(null);
                          setDeleteConfirmId(routine.id);
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-crimson transition-colors hover:bg-crimson/10"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {canCreateMore && (
          <button
            type="button"
            onClick={() => navigate('/builder')}
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-card border border-dashed border-neon/40 bg-neon/5 py-4 text-neon transition-all hover:bg-neon/10 hover:border-neon/60 active:scale-[0.98]"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span className="text-sm font-bold uppercase tracking-wider">
              Create Custom Flow
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate('/discover')}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-card bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-ink transition-all hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] shadow-lg shadow-amber-500/20"
        >
          <Dumbbell size={18} strokeWidth={2.5} />
          <span className="text-sm font-bold uppercase tracking-wider">
            Discover Pro Programs
          </span>
        </button>
      </div>

      {selectedRoutine && (
        <FlowOverviewSheet
          routine={selectedRoutine}
          onStart={handleStartWorkout}
          onClose={() => setSelectedRoutine(null)}
        />
      )}

      {/* ── Delete confirmation dialog ─────────────────────────────── */}
      {deleteConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete routine"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-white/10 bg-surface/90 p-6 text-center backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-paper">
              Delete routine?
            </h3>
            <p className="mt-2 text-sm text-ash">
              This can&apos;t be undone. The routine and all its exercises will be removed.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteRoutine()}
                className="w-full rounded-xl border border-crimson/40 bg-crimson/15 py-3 text-sm font-bold text-crimson transition-colors hover:bg-crimson/25 active:scale-[0.98] disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="w-full rounded-xl bg-white/5 py-3 text-sm font-bold text-paper transition-colors hover:bg-white/10 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
