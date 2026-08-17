import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Dumbbell,
  Heart,
  Home,
  Loader2,
  Scale,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { UserProfile, UserProfileUpdateRequest } from '../api/client';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const TOTAL_STEPS = 4;

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

function bmiGaugeColor(bmi: number): string {
  if (bmi < 18.5) return 'bg-sky-400';
  if (bmi < 25) return 'bg-neon';
  if (bmi < 30) return 'bg-ember';
  return 'bg-crimson';
}

/* ------------------------------------------------------------------ */
/*  Shared tiny components                                             */
/* ------------------------------------------------------------------ */

function Progress({ step }: { step: number }) {
  const pct = (step / TOTAL_STEPS) * 100;
  return (
    <div className="h-1 w-full bg-white/10">
      <div
        className="h-full bg-neon transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
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

/* ------------------------------------------------------------------ */
/*  Step: Gender                                                       */
/* ------------------------------------------------------------------ */

function GenderStep({
  gender,
  setGender,
}: {
  gender: string | null;
  setGender: (g: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-6 pt-8">
      <h2 className="font-display text-2xl font-bold text-paper">
        What's your gender?
      </h2>
      <p className="text-center text-sm text-ash">
        This helps us tailor your training plan.
      </p>
      <div className="flex w-full flex-col gap-4 pt-4">
        {GENDER_OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setGender(id)}
            className={`flex items-center gap-4 rounded-card p-5 transition-all active:scale-[0.98] ${
              gender === id
                ? 'border-2 border-neon bg-neon/10 shadow-neon-glow'
                : 'border-2 border-white/10 bg-surface'
            }`}
          >
            <Icon
              size={28}
              className={gender === id ? 'text-neon' : 'text-ash'}
            />
            <span
              className={`text-lg font-bold ${gender === id ? 'text-neon' : 'text-paper'}`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step: Metrics                                                      */
/* ------------------------------------------------------------------ */

function MetricsStep({
  age,
  setAge,
  weight,
  setWeight,
  height,
  setHeight,
}: {
  age: number;
  setAge: (v: number) => void;
  weight: number;
  setWeight: (v: number) => void;
  height: number;
  setHeight: (v: number) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8 px-6 pt-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-paper">
          Your metrics
        </h2>
        <p className="mt-1 text-sm text-ash">
          Drag the sliders to set your values.
        </p>
      </div>
      <Slider
        label="Age"
        unit="yrs"
        value={age}
        min={10}
        max={100}
        step={1}
        onChange={setAge}
      />
      <Slider
        label="Weight"
        unit="kg"
        value={weight}
        min={30}
        max={200}
        step={0.5}
        onChange={setWeight}
      />
      <Slider
        label="Height"
        unit="cm"
        value={height}
        min={100}
        max={220}
        step={1}
        onChange={setHeight}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step: Goals & Styles                                               */
/* ------------------------------------------------------------------ */

function GoalsStep({
  goals,
  toggleGoal,
  styles,
  toggleStyle,
}: {
  goals: string[];
  toggleGoal: (id: string) => void;
  styles: string[];
  toggleStyle: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8 px-6 pt-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-paper">
          Your goals
        </h2>
        <p className="mt-1 text-sm text-ash">
          Pick as many as you like.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {FITNESS_GOALS.map(({ id, label, icon }) => (
          <Chip
            key={id}
            label={label}
            icon={icon}
            active={goals.includes(id)}
            onClick={() => toggleGoal(id)}
          />
        ))}
      </div>
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-paper">
          Workout style
        </h2>
        <div className="flex flex-wrap gap-3">
          {FITNESS_STYLES.map(({ id, label, icon }) => (
            <Chip
              key={id}
              label={label}
              icon={icon}
              active={styles.includes(id)}
              onClick={() => toggleStyle(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step: Summary                                                      */
/* ------------------------------------------------------------------ */

function SummaryStep({
  weight,
  height,
  gender,
  age,
  goals,
  styles,
}: {
  weight: number;
  height: number;
  gender: string | null;
  age: number;
  goals: string[];
  styles: string[];
}) {
  const bmi = useMemo(() => calcBmi(weight, height), [weight, height]);
  const cat = useMemo(() => bmiCategory(bmi), [bmi]);
  const barColor = useMemo(() => bmiGaugeColor(bmi), [bmi]);
  const gaugePct = Math.min(100, Math.max(0, ((bmi - 14) / 26) * 100));

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-6 pt-8">
      <h2 className="font-display text-2xl font-bold text-paper">
        Your summary
      </h2>

      {/* BMI gauge card */}
      <div className="w-full rounded-card bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider text-ash">
            BMI
          </span>
          <span className="font-display text-3xl font-bold text-paper">
            {bmi.toFixed(1)}
          </span>
        </div>

        {/* Gauge bar */}
        <div className="relative mb-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-0 flex">
            <div className="h-full w-[35.7%] bg-sky-400/40" />
            <div className="h-full w-[23.1%] bg-neon/40" />
            <div className="h-full w-[19.2%] bg-ember/40" />
            <div className="h-full flex-1 bg-crimson/40" />
          </div>
          <div
            className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full ${barColor} ring-2 ring-ink`}
            style={{ left: `${gaugePct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-ash">
          <span>Under</span>
          <span>Normal</span>
          <span>Over</span>
          <span>Obese</span>
        </div>
        <p className={`mt-4 text-center text-sm font-bold ${cat.color}`}>
          {cat.label}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid w-full grid-cols-2 gap-3">
        <div className="rounded-card bg-surface p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-ash">Gender</p>
          <p className="mt-1 font-display text-lg font-bold capitalize text-paper">
            {gender ?? '—'}
          </p>
        </div>
        <div className="rounded-card bg-surface p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-ash">Age</p>
          <p className="mt-1 font-display text-lg font-bold text-paper">
            {age}
          </p>
        </div>
        <div className="rounded-card bg-surface p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-ash">Weight</p>
          <p className="mt-1 font-display text-lg font-bold text-paper">
            {weight} kg
          </p>
        </div>
        <div className="rounded-card bg-surface p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-ash">Height</p>
          <p className="mt-1 font-display text-lg font-bold text-paper">
            {height} cm
          </p>
        </div>
      </div>

      {goals.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-xs uppercase tracking-wider text-ash">
            Goals
          </p>
          <div className="flex flex-wrap gap-2">
            {goals.map((g) => (
              <span
                key={g}
                className="rounded-full bg-neon/15 px-3 py-1 text-xs font-bold text-neon"
              >
                {g.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {styles.length > 0 && (
        <div className="w-full">
          <p className="mb-2 text-xs uppercase tracking-wider text-ash">
            Styles
          </p>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <span
                key={s}
                className="rounded-full bg-neon/15 px-3 py-1 text-xs font-bold text-neon"
              >
                {s.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main wizard                                                        */
/* ------------------------------------------------------------------ */

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState(25);
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  const [goals, setGoals] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);

  // Load existing profile to pre-fill
  useEffect(() => {
    let cancelled = false;
    void api.getUserProfile().then((profile) => {
      if (cancelled) return;
      if (profile.gender) setGender(profile.gender);
      if (profile.age) setAge(profile.age);
      if (profile.weight) setWeight(profile.weight);
      if (profile.height) setHeight(profile.height);
      if (profile.fitness_goals) setGoals(profile.fitness_goals);
      if (profile.fitness_styles) setStyles(profile.fitness_styles);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

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

  const canNext = useMemo(() => {
    if (step === 0) return gender !== null;
    return true;
  }, [step, gender]);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const patch: UserProfileUpdateRequest = { gender: gender ?? undefined, age, weight, height };
      if (goals.length > 0) patch.fitness_goals = goals;
      if (styles.length > 0) patch.fitness_styles = styles;
      await api.updateUserProfile(patch);
      navigate('/', { replace: true });
    } catch {
      setError('Could not save your profile. Please try again.');
      setSaving(false);
    }
  }, [gender, age, weight, height, goals, styles, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <Loader2 size={28} className="animate-spin text-neon" />
      </div>
    );
  }

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      {/* Progress bar */}
      <Progress step={step} />

      {/* Step content — only the current step is rendered */}
      <div className="flex-1 animate-in fade-in duration-300">
        {step === 0 && (
          <GenderStep gender={gender} setGender={setGender} />
        )}
        {step === 1 && (
          <MetricsStep
            age={age}
            setAge={setAge}
            weight={weight}
            setWeight={setWeight}
            height={height}
            setHeight={setHeight}
          />
        )}
        {step === 2 && (
          <GoalsStep
            goals={goals}
            toggleGoal={toggleGoal}
            styles={styles}
            toggleStyle={toggleStyle}
          />
        )}
        {step === 3 && (
          <SummaryStep
            weight={weight}
            height={height}
            gender={gender}
            age={age}
            goals={goals}
            styles={styles}
          />
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 rounded-2xl bg-crimson/10 px-4 py-3 text-center text-sm font-semibold text-crimson">
          {error}
        </div>
      )}

      {/* Bottom buttons */}
      <div className="flex items-center gap-3 px-6 pb-8 pt-4">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={saving}
            aria-label="Back"
            className="flex h-14 items-center justify-center rounded-2xl border-2 border-white/10 bg-surface px-5 text-ash transition-opacity disabled:opacity-60 active:scale-[0.98]"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <button
          type="button"
          onClick={isLast ? () => void handleFinish() : () => setStep((s) => s + 1)}
          disabled={!canNext || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neon py-4 text-base font-bold uppercase tracking-widest text-ink transition-opacity disabled:opacity-40 active:scale-[0.98]"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isLast ? (
            "Let's Go"
          ) : (
            'Next'
          )}
        </button>
      </div>
    </div>
  );
}
