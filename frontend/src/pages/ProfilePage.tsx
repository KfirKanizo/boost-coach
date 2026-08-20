import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Dumbbell,
  Heart,
  Home,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  Save,
  Scale,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { UserProfile, UserProfileUpdateRequest } from '../api/client';
import { clearAuthToken } from '../services/tokenStorage';
import { GamificationDashboard } from '../components/profile/GamificationDashboard';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', icon: User },
  { id: 'female', label: 'Female', icon: User },
  { id: 'other', label: 'Other', icon: User },
] as const;

const FITNESS_GOALS = [
  { id: 'weight_loss', label: 'Weight Loss', icon: Scale },
  { id: 'muscle_gain', label: 'Muscle Gain', icon: Dumbbell },
  { id: 'endurance', label: 'Endurance', icon: Heart },
  { id: 'flexibility', label: 'Flexibility', icon: Sparkles },
  { id: 'general_fitness', label: 'General Fitness', icon: Zap },
] as const;

const FITNESS_STYLES = [
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'running', label: 'Running', icon: Activity },
  { id: 'yoga', label: 'Yoga', icon: Sparkles },
  { id: 'hiit', label: 'HIIT', icon: Zap },
] as const;

/* ------------------------------------------------------------------ */
/*  BMI helpers                                                       */
/* ------------------------------------------------------------------ */

function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-sky-400' };
  if (bmi < 25) return { label: 'Normal', color: 'text-neon' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-ember' };
  return { label: 'Obese', color: 'text-crimson' };
}

/* ------------------------------------------------------------------ */
/*  Shared tiny components                                             */
/* ------------------------------------------------------------------ */

function Slider({
  label,
  unit,
  value,
  min,
  max,
  step: stepSize,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ash">{label}</span>
        <span className="font-display text-2xl font-bold text-paper">
          {value}
          <span className="ml-1 text-sm font-normal text-ash">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={stepSize}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider w-full"
      />
    </div>
  );
}

function Chip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Dumbbell;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.97] ${
        active
          ? 'border-2 border-neon bg-neon/15 text-neon'
          : 'border-2 border-white/10 bg-surface text-ash'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  ProfilePage                                                        */
/* ------------------------------------------------------------------ */

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState(25);
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  const [goals, setGoals] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserProfile();
      setProfile(data);
      setGender(data.gender);
      setAge(data.age ?? 25);
      setWeight(data.weight ?? 70);
      setHeight(data.height ?? 170);
      setGoals(data.fitness_goals ?? []);
      setStyles(data.fitness_styles ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load your profile',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await clearAuthToken();
    navigate('/login', { replace: true });
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const patch: UserProfileUpdateRequest = { gender: gender ?? undefined, age, weight, height };
      if (goals.length > 0) patch.fitness_goals = goals;
      if (styles.length > 0) patch.fitness_styles = styles;
      const updated = await api.updateUserProfile(patch);
      setProfile(updated);
      setEditing(false);
    } catch {
      setError('Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }, [gender, age, weight, height, goals, styles]);

  const toggleGoal = useCallback((id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }, []);

  const toggleStyle = useCallback((id: string) => {
    setStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  const bmi = useMemo(() => calcBmi(weight, height), [weight, height]);
  const cat = useMemo(() => bmiCategory(bmi), [bmi]);

  return (
    <div className="px-4 pb-28 pt-6">
      {/* Header */}
      <header className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neon/15">
          <span className="font-display text-xl font-bold text-neon">BC</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          {profile ? (
            <p className="truncate text-sm text-ash">{profile.email}</p>
          ) : (
            <p className="text-sm text-ash">Your profile</p>
          )}
        </div>
        {!loading && !error && profile && (
          <button
            type="button"
            onClick={() => (editing ? void handleSave() : setEditing(true))}
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded-full bg-neon px-4 text-sm font-bold text-ink transition-opacity disabled:opacity-60 active:scale-[0.97]"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : editing ? (
              <Save size={16} />
            ) : (
              <Pencil size={16} />
            )}
            {saving ? 'Saving' : editing ? 'Save' : 'Edit'}
          </button>
        )}
      </header>

      {/* Loading */}
      {loading && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-card bg-surface py-10 text-sm text-ash"
        >
          <Loader2 size={18} className="animate-spin text-neon" />
          Loading your profile…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          role="alert"
          className="flex flex-col items-center gap-4 rounded-card bg-surface px-6 py-10 text-center"
        >
          <p className="text-sm text-ash">{error}</p>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="flex items-center gap-2 rounded-full bg-neon px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-ink"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {/* Profile content */}
      {!loading && !error && profile && (
        <>
          {/* Gamification Dashboard */}
          <GamificationDashboard />

          {editing ? (
            /* ---- Edit mode ---- */
            <div className="flex flex-col gap-6">
              {/* Gender */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
                  Gender
                </h2>
                <div className="flex gap-3">
                  {GENDER_OPTIONS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setGender(id)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-card p-4 transition-all active:scale-[0.98] ${
                        gender === id
                          ? 'border-2 border-neon bg-neon/10 text-neon'
                          : 'border-2 border-white/10 bg-surface text-ash'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-sm font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Metrics */}
              <section className="flex flex-col gap-5 rounded-card bg-surface p-5">
                <Slider label="Age" unit="yrs" value={age} min={10} max={100} step={1} onChange={setAge} />
                <Slider label="Weight" unit="kg" value={weight} min={30} max={200} step={0.5} onChange={setWeight} />
                <Slider label="Height" unit="cm" value={height} min={100} max={220} step={1} onChange={setHeight} />
              </section>

              {/* BMI live */}
              <section className="rounded-card bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider text-ash">BMI</span>
                  <span className="font-display text-2xl font-bold text-paper">{bmi.toFixed(1)}</span>
                </div>
                <p className={`mt-1 text-right text-xs font-bold ${cat.color}`}>{cat.label}</p>
              </section>

              {/* Goals */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
                  Goals
                </h2>
                <div className="flex flex-wrap gap-2">
                  {FITNESS_GOALS.map(({ id, label, icon }) => (
                    <Chip key={id} label={label} icon={icon} active={goals.includes(id)} onClick={() => toggleGoal(id)} />
                  ))}
                </div>
              </section>

              {/* Styles */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
                  Workout style
                </h2>
                <div className="flex flex-wrap gap-2">
                  {FITNESS_STYLES.map(({ id, label, icon }) => (
                    <Chip key={id} label={label} icon={icon} active={styles.includes(id)} onClick={() => toggleStyle(id)} />
                  ))}
                </div>
              </section>
            </div>
          ) : (
            /* ---- View mode ---- */
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ash">
                Your details
              </h2>

              {[
                { label: 'Gender', value: gender?.replace(/_/g, ' ') ?? '—', capitalize: true },
                { label: 'Age', value: profile.age != null ? `${profile.age} yrs` : '—' },
                { label: 'Weight', value: profile.weight != null ? `${profile.weight} kg` : '—' },
                { label: 'Height', value: profile.height != null ? `${profile.height} cm` : '—' },
                { label: 'BMI', value: profile.weight && profile.height ? `${bmi.toFixed(1)} ${cat.label}` : '—', valueClass: profile.weight && profile.height ? cat.color : undefined },
              ].map(({ label, value, capitalize, valueClass }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-card bg-surface p-5"
                >
                  <span className="text-ash">{label}</span>
                  <span className={`font-display text-xl font-bold text-paper ${valueClass ?? ''} ${capitalize ? 'capitalize' : ''}`}>
                    {value}
                  </span>
                </div>
              ))}

              {goals.length > 0 && (
                <div className="mt-2">
                  <p className="mb-2 text-xs uppercase tracking-wider text-ash">Goals</p>
                  <div className="flex flex-wrap gap-2">
                    {goals.map((g) => (
                      <span key={g} className="rounded-full bg-neon/15 px-3 py-1 text-xs font-bold text-neon capitalize">
                        {g.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {styles.length > 0 && (
                <div className="mt-2">
                  <p className="mb-2 text-xs uppercase tracking-wider text-ash">Styles</p>
                  <div className="flex flex-wrap gap-2">
                    {styles.map((s) => (
                      <span key={s} className="rounded-full bg-neon/15 px-3 py-1 text-xs font-bold text-neon capitalize">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-crimson py-4 text-base font-bold text-paper transition-opacity disabled:opacity-60 active:scale-[0.98]"
          >
            {loggingOut ? (
              <Loader2 size={18} className="animate-spin" role="status" aria-label="Signing out" />
            ) : (
              <LogOut size={18} aria-hidden="true" />
            )}
            Log out
          </button>
        </>
      )}
    </div>
  );
}
