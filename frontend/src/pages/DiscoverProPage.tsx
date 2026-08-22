import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock, Dumbbell, Home as HomeIcon, Loader2, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { PreBuiltProgram } from '../api/client';

type FilterCategory = 'all' | 'home' | 'gym';

const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  quadriceps: 'Legs',
  calves: 'Calves',
  biceps: 'Arms',
  core: 'Core',
  full_body: 'Full Body',
};

export function DiscoverProPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<PreBuiltProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [clonedId, setClonedId] = useState<string | null>(null);
  const [previewProgram, setPreviewProgram] = useState<PreBuiltProgram | null>(null);
  const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getPublicPrograms()
      .then(setPrograms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch exercise catalogue once to resolve exercise_id → name
  useEffect(() => {
    api.getExercises()
      .then((exercises) => {
        const map: Record<string, string> = {};
        for (const ex of exercises) {
          map[ex.id] = ex.name_translations.en ?? ex.id;
        }
        setExerciseNames(map);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return programs;
    return programs.filter((p) => p.equipment_category === filter);
  }, [programs, filter]);

  const handleClone = useCallback(async (programId: string) => {
    setCloningId(programId);
    try {
      const routine = await api.cloneProgram(programId);
      setClonedId(programId);
      setPreviewProgram(null);
      setTimeout(() => navigate(`/builder/${routine.id}`), 600);
    } catch {
      // Silent
    } finally {
      setCloningId(null);
    }
  }, [navigate]);

  return (
    <div className="pb-28 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-paper">Discover Pro Programs</h1>
          <p className="text-[11px] text-ash">Expert-built routines you can add to your flows</p>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex gap-2 px-4 pb-4">
        {(['all', 'home', 'gym'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
              filter === cat
                ? 'bg-neon/15 text-neon border border-neon/30'
                : 'bg-white/5 text-ash border border-transparent hover:bg-white/10'
            }`}
          >
            {cat === 'home' && <HomeIcon size={12} />}
            {cat === 'gym' && <Dumbbell size={12} />}
            {cat === 'all' ? 'All' : cat === 'home' ? 'Home' : 'Gym'}
          </button>
        ))}
      </div>

      {/* Programs grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neon" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-white/10 py-12 text-center mx-4">
          <Dumbbell size={28} className="mx-auto mb-3 text-ash/40" />
          <p className="text-sm font-semibold text-paper">No programs found</p>
          <p className="mt-1 text-xs text-ash">
            {filter === 'all' ? 'Check back later for new routines' : `No ${filter} programs available`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
          {filtered.map((program) => (
            <button
              key={program.id}
              type="button"
              onClick={() => setPreviewProgram(program)}
              className="group rounded-card border border-white/[0.06] bg-surface p-4 text-left transition-all hover:border-white/10 active:scale-[0.98]"
            >
              {/* Category badge */}
              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  'bg-neon/10 text-neon'
                }`}>
                  {program.equipment_category === 'home' ? (
                    <HomeIcon size={9} />
                  ) : (
                    <Dumbbell size={9} />
                  )}
                  {program.equipment_category}
                </span>
                <span className="text-[10px] text-ash/50">
                  {program.exercises.length} exercises
                </span>
              </div>

              {/* Title + description */}
              <h3 className="text-sm font-bold text-paper">{program.title}</h3>
              {program.description && (
                <p className="mt-1 text-xs text-ash line-clamp-2">{program.description}</p>
              )}

              {/* Muscle tags */}
              {program.muscle_tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {program.muscle_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-semibold text-ember"
                    >
                      {CATEGORY_LABELS[tag] || tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Preview Modal ────────────────────────────────────────── */}
      {previewProgram && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewProgram.title}`}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setPreviewProgram(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-surface/95 p-6 backdrop-blur-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  'bg-neon/10 text-neon'
                }`}>
                  {previewProgram.equipment_category === 'home' ? (
                    <HomeIcon size={9} />
                  ) : (
                    <Dumbbell size={9} />
                  )}
                  {previewProgram.equipment_category}
                </span>
                <h2 className="mt-2 font-display text-lg font-bold text-paper">
                  {previewProgram.title}
                </h2>
                {previewProgram.description && (
                  <p className="mt-1 text-sm text-ash">{previewProgram.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewProgram(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-ash transition-colors hover:bg-white/10 hover:text-paper"
              >
                <X size={16} />
              </button>
            </div>

            {/* Muscle tags */}
            {previewProgram.muscle_tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {previewProgram.muscle_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-semibold text-ember"
                  >
                    {CATEGORY_LABELS[tag] || tag}
                  </span>
                ))}
              </div>
            )}

            {/* Exercise list */}
            <div className="mb-5">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ash">
                Exercises ({previewProgram.exercises.length})
              </h3>
              <div className="flex flex-col gap-2">
                {previewProgram.exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neon/10 text-[10px] font-bold text-neon">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-paper">
                        {exerciseNames[ex.exercise_id] || 'Unknown Exercise'}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ash">
                        <span>{ex.sets} sets</span>
                        <span className="text-white/10">·</span>
                        <span>{ex.target_reps_or_duration} reps</span>
                        {ex.rest_time_after_sec > 0 && (
                          <>
                            <span className="text-white/10">·</span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {ex.rest_time_after_sec}s rest
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add to My Flows button */}
            <button
              type="button"
              disabled={cloningId === previewProgram.id || clonedId === previewProgram.id}
              onClick={() => void handleClone(previewProgram.id)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 ${
                clonedId === previewProgram.id
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-neon/10 text-neon border border-neon/20 hover:bg-neon/15 hover:border-neon/30'
              }`}
            >
              {cloningId === previewProgram.id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : clonedId === previewProgram.id ? (
                'Added!'
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.5} />
                  Add to My Flows
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
