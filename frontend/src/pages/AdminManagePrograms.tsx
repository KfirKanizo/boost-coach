import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { PreBuiltProgram, ProgramExerciseEntry, AdminExercise } from '../api/client';

const PREDEFINED_TAGS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'core', 'full_body',
] as const;

const TAG_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', quadriceps: 'Quadriceps', hamstrings: 'Hamstrings',
  glutes: 'Glutes', calves: 'Calves', core: 'Core', full_body: 'Full Body',
};

function ProgramForm({
  initial,
  exercises,
  onSaved,
  onCancel,
}: {
  initial?: PreBuiltProgram;
  exercises: AdminExercise[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [muscleTags, setMuscleTags] = useState<string[]>(initial?.muscle_tags ?? []);
  const [entries, setEntries] = useState<ProgramExerciseEntry[]>(initial?.exercises ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const toggleTag = (t: string) => {
    setMuscleTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };
  const addEntry = () => setEntries([...entries, { exercise_id: '', sets: 3, target_reps_or_duration: 10, rest_time_after_sec: 60 }]);
  const updateEntry = (i: number, patch: Partial<ProgramExerciseEntry>) => setEntries(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { title: title.trim(), description, muscle_tags: muscleTags, exercises: entries };
      if (initial) { await api.updateAdminProgram(initial.id, payload); }
      else { await api.createAdminProgram(payload); }
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }, [title, description, muscleTags, entries, initial, onSaved]);

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="rounded-card border border-crimson/30 bg-crimson/10 px-4 py-3 text-xs text-crimson">{error}</div>}
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Program title"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-paper placeholder-ash/50 outline-none focus:border-neon/40" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-paper placeholder-ash/50 outline-none focus:border-neon/40" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">Muscle Tags</label>
        {/* Selected tags */}
        <div className="flex flex-wrap gap-1.5">
          {muscleTags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-neon/15 px-2.5 py-1 text-[11px] font-bold text-neon">
              {TAG_LABELS[t] || t}
              <button type="button" onClick={() => toggleTag(t)} className="text-neon/60 hover:text-neon"><X size={12} /></button>
            </span>
          ))}
        </div>
        {/* Dropdown selector */}
        <div className="relative mt-2">
          <button
            type="button"
            onClick={() => setShowTagDropdown(!showTagDropdown)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-ash transition-colors hover:border-neon/30"
          >
            <span>{muscleTags.length > 0 ? `${muscleTags.length} selected` : 'Select tags...'}</span>
            <ChevronDown size={14} className={`transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showTagDropdown && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-surface shadow-lg">
              <div className="max-h-48 overflow-y-auto p-1">
                {PREDEFINED_TAGS.map((tag) => {
                  const selected = muscleTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selected ? 'bg-neon/10 text-neon' : 'text-paper hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selected ? 'border-neon bg-neon' : 'border-white/20'
                      }`}>
                        {selected && <Check size={10} className="text-ink" />}
                      </div>
                      {TAG_LABELS[tag] || tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-ash">Exercises ({entries.length})</label>
          <button type="button" onClick={addEntry} className="flex items-center gap-1 rounded-full bg-neon/10 px-3 py-1 text-[11px] font-bold text-neon hover:bg-neon/20">
            <Plus size={12} />Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-ash">#{i + 1}</span>
                <select value={entry.exercise_id} onChange={(e) => updateEntry(i, { exercise_id: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface px-2 py-1.5 text-xs text-paper outline-none focus:border-neon/40">
                  <option value="">Select exercise</option>
                  {exercises.filter((e) => e.is_active).map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name_translations.en ?? ex.id}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeEntry(i)} className="text-ash/40 hover:text-crimson"><Trash2 size={14} /></button>
              </div>
              <div className="flex gap-3 pl-6">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold uppercase text-ash">Sets</span>
                  <input type="number" min={1} max={20} value={entry.sets}
                    onChange={(e) => updateEntry(i, { sets: Number(e.target.value) })}
                    className="w-12 rounded-lg border border-white/10 bg-surface px-1 py-1 text-center text-xs text-paper outline-none focus:border-neon/40" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold uppercase text-ash">Reps</span>
                  <input type="number" min={1} value={entry.target_reps_or_duration}
                    onChange={(e) => updateEntry(i, { target_reps_or_duration: Number(e.target.value) })}
                    className="w-12 rounded-lg border border-white/10 bg-surface px-1 py-1 text-center text-xs text-paper outline-none focus:border-neon/40" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold uppercase text-ash">Rest(s)</span>
                  <input type="number" min={0} step={15} value={entry.rest_time_after_sec}
                    onChange={(e) => updateEntry(i, { rest_time_after_sec: Number(e.target.value) })}
                    className="w-14 rounded-lg border border-white/10 bg-surface px-1 py-1 text-center text-xs text-paper outline-none focus:border-neon/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/5 py-3 text-xs font-bold text-ash">
          <X size={14} />Cancel
        </button>
        <button type="button" onClick={() => void handleSubmit()} disabled={saving || !title.trim()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-neon py-3 text-xs font-bold text-ink disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}{initial ? 'Update' : 'Create'} Program
        </button>
      </div>
    </div>
  );
}

export function AdminManagePrograms() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<PreBuiltProgram[]>([]);
  const [exercises, setExercises] = useState<AdminExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<PreBuiltProgram | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pData, eData] = await Promise.all([api.getAdminPrograms(), api.getAdminExercises()]);
      setPrograms(pData);
      setExercises(eData);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleDelete = useCallback(async (id: string) => {
    try { await api.deleteAdminProgram(id); setDeletingId(null); void loadData(); }
    catch { /* best-effort */ }
  }, [loadData]);

  const handleSaved = () => { setShowForm(false); setEditingProgram(null); void loadData(); };

  return (
    <div className="pb-28 pt-4">
      <div className="flex items-center gap-3 px-4 pt-2">
        <button type="button" onClick={() => navigate('/')} aria-label="Back to Admin"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-paper transition-transform active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold text-paper">Pre-Built Programs</h1>
          <p className="text-xs text-ash">{programs.length} programs</p>
        </div>
        {!showForm && !editingProgram && (
          <button type="button" onClick={() => { setShowForm(true); setEditingProgram(null); }}
            className="flex items-center gap-1.5 rounded-full bg-neon px-4 py-2 text-xs font-bold text-ink">
            <Plus size={14} />New
          </button>
        )}
      </div>

      <div className="px-4 mt-4">
        {loading && <div className="flex items-center justify-center py-16 text-sm text-ash"><Loader2 size={18} className="animate-spin text-neon mr-2" />Loading...</div>}
        {!loading && error && <div className="rounded-card bg-surface px-6 py-10 text-center text-sm text-ash">{error}</div>}

        {(showForm || editingProgram) && !loading && (
          <div className="rounded-card border border-neon/20 bg-surface p-4">
            <h2 className="mb-3 text-sm font-bold text-paper">{editingProgram ? 'Edit Program' : 'New Program'}</h2>
            <ProgramForm initial={editingProgram ?? undefined} exercises={exercises} onSaved={handleSaved}
              onCancel={() => { setShowForm(false); setEditingProgram(null); }} />
          </div>
        )}

        {!loading && !error && !showForm && !editingProgram && (
          <div className="flex flex-col gap-2">
            {programs.map((p) => (
              <div key={p.id} className={`rounded-card border p-4 transition-colors ${p.is_active ? 'border-white/5 bg-surface' : 'border-crimson/20 bg-crimson/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-paper">{p.title}</p>
                    {p.description && <p className="mt-0.5 text-xs text-ash line-clamp-1">{p.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.muscle_tags.map((t) => (
                        <span key={t} className="rounded-full bg-neon/10 px-2 py-0.5 text-[10px] font-bold text-neon">{t}</span>
                      ))}
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-ash">{p.exercises.length} exercises</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!p.is_active && <span className="rounded-full bg-crimson/15 px-2 py-0.5 text-[10px] font-bold text-crimson">Off</span>}
                    <button type="button" onClick={() => { setEditingProgram(p); setShowForm(false); }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-neon/15 hover:text-neon"
                      aria-label={`Edit ${p.title}`}>
                      <Pencil size={14} />
                    </button>
                    {deletingId === p.id ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void handleDelete(p.id)}
                          className="rounded-full bg-crimson/20 px-2.5 py-1 text-[10px] font-bold text-crimson">Yes</button>
                        <button type="button" onClick={() => setDeletingId(null)}
                          className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-ash">No</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDeletingId(p.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-crimson/15 hover:text-crimson"
                        aria-label={`Delete ${p.title}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {programs.length === 0 && (
              <div className="rounded-card bg-surface px-6 py-16 text-center">
                <p className="text-sm font-semibold text-paper">No programs yet</p>
                <p className="mt-1 text-xs text-ash">Create your first pre-built program</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
