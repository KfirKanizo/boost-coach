import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Save,
  Shield,
  Users,
  Dumbbell,
  Activity,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type { AdminStats, AdminExercise } from '../api/client';

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-4">
      <Icon size={18} className="text-neon" />
      <span className="font-display text-2xl font-bold text-paper">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wider text-ash">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exercise row                                                       */
/* ------------------------------------------------------------------ */

const MOVEMENT_PATTERNS = ['squat', 'push', 'pull', 'core', 'hinge'];

function ExerciseRow({
  exercise,
  onSaved,
}: {
  exercise: AdminExercise;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pattern, setPattern] = useState(exercise.movement_pattern);
  const [active, setActive] = useState(exercise.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const name =
    exercise.name_translations['en'] ??
    Object.values(exercise.name_translations)[0] ??
    'Unknown';

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateAdminExercise(exercise.id, {
        movement_pattern: pattern,
        is_active: active,
      });
      setSaved(true);
      setEditing(false);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Keep editing state so user can retry.
    } finally {
      setSaving(false);
    }
  }, [exercise.id, pattern, active, onSaved]);

  const handleCancel = useCallback(() => {
    setPattern(exercise.movement_pattern);
    setActive(exercise.is_active);
    setEditing(false);
  }, [exercise.movement_pattern, exercise.is_active]);

  return (
    <div
      className={`rounded-card border p-4 transition-colors ${
        !active
          ? 'border-crimson/20 bg-crimson/5'
          : saved
            ? 'border-neon/30 bg-neon/5'
            : 'border-white/5 bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-paper">{name}</p>
          <p className="mt-0.5 text-xs text-ash">
            {exercise.primary_muscle} · {exercise.equipment_required}
          </p>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-neon/15 hover:text-neon"
            aria-label={`Edit ${name}`}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          {/* Movement pattern */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">
              Movement pattern
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOVEMENT_PATTERNS.map((mp) => (
                <button
                  key={mp}
                  type="button"
                  onClick={() => setPattern(mp)}
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-all ${
                    pattern === mp
                      ? 'bg-neon text-ink'
                      : 'bg-white/5 text-ash hover:bg-white/10'
                  }`}
                >
                  {mp}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ash">Active</span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => setActive(!active)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                active ? 'bg-neon' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper transition-transform ${
                  active ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/5 py-2 text-xs font-bold text-ash"
            >
              <X size={14} />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-neon py-2 text-xs font-bold text-ink disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ash">
            {exercise.movement_pattern}
          </span>
          {!active && (
            <span className="rounded-full bg-crimson/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-crimson">
              Inactive
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1 rounded-full bg-neon/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neon">
              <Check size={10} />
              Saved
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AdminPage                                                          */
/* ------------------------------------------------------------------ */

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [exercises, setExercises] = useState<AdminExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, exercisesData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminExercises(),
      ]);
      setStats(statsData);
      setExercises(exercisesData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load admin data',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="px-4 pb-28 pt-6">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/15">
          <Shield size={20} className="text-neon" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-ash">System management</p>
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-card bg-surface py-10 text-sm text-ash"
        >
          <Loader2 size={18} className="animate-spin text-neon" />
          Loading admin data…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          role="alert"
          className="flex flex-col items-center gap-4 rounded-card bg-surface px-6 py-10 text-center"
        >
          <AlertTriangle size={24} className="text-crimson" />
          <p className="text-sm text-ash">{error}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-2 rounded-full bg-neon px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-ink"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* System overview */}
          {stats && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
                System Overview
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Users"
                  value={stats.total_users}
                  icon={Users}
                />
                <StatCard
                  label="Workouts"
                  value={stats.total_workouts}
                  icon={Activity}
                />
                <StatCard
                  label="Exercises"
                  value={stats.total_exercises}
                  icon={Dumbbell}
                />
              </div>
            </section>
          )}

          {/* Exercise management */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
              Exercise Management
            </h2>
            <div className="flex flex-col gap-2">
              {exercises.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  onSaved={() => void loadData()}
                />
              ))}
              {exercises.length === 0 && (
                <p className="rounded-card bg-surface py-8 text-center text-sm text-ash">
                  No exercises found.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
