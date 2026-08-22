import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Dumbbell, Home as HomeIcon, Loader2, Plus } from 'lucide-react';
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

  useEffect(() => {
    api.getPublicPrograms()
      .then(setPrograms)
      .catch(() => {})
      .finally(() => setLoading(false));
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
            <div
              key={program.id}
              className="group rounded-card border border-white/[0.06] bg-surface p-4 transition-all hover:border-white/10"
            >
              {/* Category badge */}
              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  program.equipment_category === 'home'
                    ? 'bg-neon/10 text-neon'
                    : 'bg-amber-500/10 text-amber-400'
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
                      className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-ash"
                    >
                      {CATEGORY_LABELS[tag] || tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Add to My Flows button */}
              <button
                type="button"
                disabled={cloningId === program.id || clonedId === program.id}
                onClick={() => void handleClone(program.id)}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 ${
                  clonedId === program.id
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-neon/10 text-neon border border-neon/20 hover:bg-neon/15 hover:border-neon/30'
                }`}
              >
                {cloningId === program.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : clonedId === program.id ? (
                  'Added!'
                ) : (
                  <>
                    <Plus size={14} strokeWidth={2.5} />
                    Add to My Flows
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
