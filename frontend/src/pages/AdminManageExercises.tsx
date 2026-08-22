import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, Pencil, Save, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { AdminExercise } from '../api/client';

type EquipmentFilter = 'all' | 'bodyweight' | 'weights';

const MUSCLE_CHIPS = [
  { label: 'All', value: '' },
  { label: 'Squat', value: 'squat' },
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Hinge', value: 'hinge' },
  { label: 'Core', value: 'core' },
] as const;

const MUSCLE_GROUP_CHIPS = [
  { label: 'ALL', muscles: [] },
  { label: 'CHEST', muscles: ['chest'] },
  { label: 'BACK', muscles: ['back'] },
  { label: 'LEGS', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves'] },
  { label: 'SHOULDERS', muscles: ['shoulders'] },
  { label: 'ARMS', muscles: ['biceps', 'triceps'] },
  { label: 'CORE', muscles: ['core'] },
] as const;

const MOVEMENT_PATTERNS = ['squat', 'push', 'pull', 'core', 'hinge'];

function matchesEquipment(ex: AdminExercise, filter: EquipmentFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'bodyweight') return ex.equipment_required === 'bodyweight';
  return ex.equipment_required !== 'bodyweight';
}

function matchesMuscleGroup(ex: AdminExercise, groupMuscles: readonly string[]): boolean {
  if (groupMuscles.length === 0) return true;
  return groupMuscles.includes(ex.primary_muscle);
}

function ExerciseRow({ exercise, onSaved }: { exercise: AdminExercise; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pattern, setPattern] = useState(exercise.movement_pattern);
  const [active, setActive] = useState(exercise.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const name = exercise.name_translations['en'] ?? Object.values(exercise.name_translations)[0] ?? 'Unknown';

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateAdminExercise(exercise.id, { movement_pattern: pattern, is_active: active });
      setSaved(true);
      setEditing(false);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch { /* retry */ } finally { setSaving(false); }
  }, [exercise.id, pattern, active, onSaved]);

  const handleCancel = useCallback(() => {
    setPattern(exercise.movement_pattern);
    setActive(exercise.is_active);
    setEditing(false);
  }, [exercise.movement_pattern, exercise.is_active]);

  return (
    <div className={`rounded-card border p-4 transition-colors ${
      !active ? 'border-crimson/20 bg-crimson/5' : saved ? 'border-neon/30 bg-neon/5' : 'border-white/5 bg-surface'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-paper">{name}</p>
          <p className="mt-0.5 text-xs text-ash">{exercise.primary_muscle} · {exercise.equipment_required}</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-neon/15 hover:text-neon"
            aria-label={`Edit ${name}`}>
            <Pencil size={14} />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">Movement pattern</label>
            <div className="flex flex-wrap gap-1.5">
              {MOVEMENT_PATTERNS.map((mp) => (
                <button key={mp} type="button" onClick={() => setPattern(mp)}
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-all ${pattern === mp ? 'bg-neon text-ink' : 'bg-white/5 text-ash hover:bg-white/10'}`}>
                  {mp}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ash">Active</span>
            <button type="button" role="switch" aria-checked={active} onClick={() => setActive(!active)}
              className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-neon' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper transition-transform ${active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleCancel}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/5 py-2 text-xs font-bold text-ash">
              <X size={14} />Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-neon py-2 text-xs font-bold text-ink disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ember">{exercise.primary_muscle}</span>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neon">{exercise.movement_pattern}</span>
          {!active && <span className="rounded-full bg-crimson/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-crimson">Inactive</span>}
          {saved && <span className="flex items-center gap-1 rounded-full bg-neon/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neon"><Check size={10} />Saved</span>}
        </div>
      )}
    </div>
  );
}

export function AdminManageExercises() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<AdminExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all');
  const [muscleFilter, setMuscleFilter] = useState('');
  const [muscleGroupFilter, setMuscleGroupFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setExercises(await api.getAdminExercises()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load exercises'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filtered = exercises.filter((ex) => {
    if (!matchesEquipment(ex, equipmentFilter)) return false;
    if (muscleFilter && ex.movement_pattern !== muscleFilter) return false;
    const activeGroup = MUSCLE_GROUP_CHIPS.find((g) => g.label === muscleGroupFilter);
    if (activeGroup && !matchesMuscleGroup(ex, activeGroup.muscles)) return false;
    if (search) {
      const name = (ex.name_translations.en ?? ex.id).toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="pb-28 pt-4">
      <div className="flex items-center gap-3 px-4 pt-2">
        <button type="button" onClick={() => navigate('/')} aria-label="Back to Admin"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-paper transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-paper">Manage Exercises</h1>
          <p className="text-xs text-ash">{exercises.length} exercises total</p>
        </div>
      </div>

      <div className="mt-5 px-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ash" />
          <input type="text" placeholder="Search exercises..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-card border border-white/10 bg-surface py-3 pl-10 pr-4 text-sm text-paper placeholder-ash/50 outline-none transition-colors focus:border-neon/40" />
        </div>
      </div>

      <div className="mt-4 px-4">
        <div className="flex gap-2">
          {([{ label: 'All', value: 'all' }, { label: 'Home', value: 'bodyweight' }, { label: 'Gym', value: 'weights' }] as const).map(({ label, value }) => (
            <button key={value} type="button" aria-label={`Equipment: ${label}`} onClick={() => setEquipmentFilter(value)}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${equipmentFilter === value ? 'bg-neon text-ink shadow-neon-glow' : 'bg-surface text-ash hover:bg-white/[0.07]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 px-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {MUSCLE_CHIPS.map(({ label, value }) => (
            <button key={value} type="button" aria-label={`Pattern: ${label}`} onClick={() => setMuscleFilter(value)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${muscleFilter === value ? 'border-neon/40 bg-neon/10 text-neon' : 'border-white/10 bg-white/5 text-ash hover:bg-white/[0.07]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 px-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {MUSCLE_GROUP_CHIPS.map(({ label }) => (
            <button key={label} type="button" aria-label={`Muscle group: ${label}`}
              onClick={() => setMuscleGroupFilter(label === muscleGroupFilter ? '' : label)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${muscleGroupFilter === label ? 'border-ember/40 bg-ember/10 text-ember' : 'border-white/10 bg-white/5 text-ash hover:bg-white/[0.07]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between px-4">
        <span className="text-xs font-semibold text-ash">{filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}</span>
      </div>

      <div className="mt-3 px-4">
        {loading && <div className="flex items-center justify-center py-16 text-sm text-ash">Loading exercises...</div>}
        {!loading && error && <div className="rounded-card bg-surface px-6 py-10 text-center text-sm text-ash">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-card bg-surface px-6 py-16 text-center">
            <p className="text-sm font-semibold text-paper">No exercises found</p>
            <p className="mt-1 text-xs text-ash">Try adjusting your filters or search</p>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-2">
            {filtered.map((ex) => <ExerciseRow key={ex.id} exercise={ex} onSaved={() => void loadData()} />)}
          </div>
        )}
      </div>
    </div>
  );
}
