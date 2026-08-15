import { useEffect, useState } from 'react';
import { AlertTriangle, Send, Sparkles } from 'lucide-react';
import type { CoachFeedback, UserProfile } from '../api/client';
import { api } from '../api/client';

type CoachState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; feedback: CoachFeedback }
  | { phase: 'error'; message: string };

/** Animated 3-dot typing indicator shown while the coach "is thinking". */
function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="Coach is typing"
      className="flex items-center gap-1.5 py-1"
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-2.5 w-2.5 animate-bounce rounded-full bg-neon"
          style={{ animationDelay: `${dot * 140}ms` }}
        />
      ))}
    </div>
  );
}

/** Left-aligned coach bubble (dark surface, white text per the design system). */
function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] self-start rounded-card rounded-bl-sm bg-surface px-5 py-4">
      {children}
    </div>
  );
}

function ThankYouBubble() {
  return (
    <CoachBubble>
      <p className="text-sm font-semibold text-paper">Thank you!</p>
    </CoachBubble>
  );
}

interface ProfilePromptProps {
  message: string;
  value: string;
  inputLabel: string;
  placeholder: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

/** Coach chat bubble containing a numerical input + neon Save button. */
function ProfilePrompt({
  message,
  value,
  inputLabel,
  placeholder,
  saving,
  onChange,
  onSave,
}: ProfilePromptProps) {
  const valid = value.trim() !== '' && Number(value) > 0;

  return (
    <CoachBubble>
      <p className="text-sm leading-relaxed text-paper">{message}</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={inputLabel}
          className="w-24 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-paper placeholder:text-ash focus:border-neon focus:outline-none"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!valid || saving}
          className="rounded-full bg-neon px-5 py-2 text-sm font-bold uppercase tracking-widest text-ink transition-transform active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </CoachBubble>
  );
}

export function CoachPage() {
  const [state, setState] = useState<CoachState>({ phase: 'idle' });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [savingHeight, setSavingHeight] = useState(false);
  const [savedWeight, setSavedWeight] = useState(false);
  const [savedHeight, setSavedHeight] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getUserProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        // Offline/transient failure — stay silent; the prompt returns next visit.
      });
    return () => {
      active = false;
    };
  }, []);

  const requestFeedback = async () => {
    setState({ phase: 'loading' });
    try {
      const feedback = await api.getCoachFeedback();
      setState({ phase: 'done', feedback });
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof Error ? err.message : 'The Coach is unavailable',
      });
    }
  };

  const saveMetric = async (key: 'weight' | 'height', raw: string) => {
    const numeric = Number(raw);
    if (!(numeric > 0)) return;
    if (key === 'weight') setSavingWeight(true);
    else setSavingHeight(true);
    try {
      const updated = await api.updateUserProfile(
        key === 'weight' ? { weight: numeric } : { height: numeric },
      );
      setProfile(updated);
      if (key === 'weight') {
        setWeightInput('');
        setSavedWeight(true);
      } else {
        setHeightInput('');
        setSavedHeight(true);
      }
    } catch {
      // Keep the prompt visible; a retry is harmless.
    } finally {
      if (key === 'weight') setSavingWeight(false);
      else setSavingHeight(false);
    }
  };

  const weightMissing = profile != null && profile.weight == null;
  const heightMissing =
    profile != null && profile.weight != null && profile.height == null;

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <header className="px-4 pb-4 pt-6">
        <h1 className="font-display text-2xl font-bold">The Coach</h1>
        <p className="text-sm text-ash">
          Personalized feedback after every Boost.
        </p>
      </header>

      <div className="flex flex-1 flex-col justify-end gap-6 px-4">
        <div className="flex flex-col items-end gap-3">
          {profile != null && savedWeight && <ThankYouBubble />}
          {weightMissing && (
            <ProfilePrompt
              message="To accurately calculate your calorie burn, what is your current weight in kg?"
              value={weightInput}
              inputLabel="Weight in kg"
              placeholder="e.g. 70"
              saving={savingWeight}
              onChange={setWeightInput}
              onSave={() => void saveMetric('weight', weightInput)}
            />
          )}
          {profile != null && savedHeight && <ThankYouBubble />}
          {heightMissing && (
            <ProfilePrompt
              message="To fine-tune your training plan, what is your height in cm?"
              value={heightInput}
              inputLabel="Height in cm"
              placeholder="e.g. 175"
              saving={savingHeight}
              onChange={setHeightInput}
              onSave={() => void saveMetric('height', heightInput)}
            />
          )}

          {state.phase === 'idle' && (
            <div className="mx-auto flex max-w-[280px] flex-col items-center gap-3 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-neon/10">
                <div className="absolute inset-0 animate-pulse rounded-full bg-neon/10" />
                <Sparkles size={26} className="relative text-neon" />
              </div>
              <p className="text-sm leading-relaxed text-ash">
                Complete a Boost, then ask The Coach to break down your
                session and celebrate your streak.
              </p>
            </div>
          )}

          {state.phase === 'loading' && (
            <div className="max-w-[85%] self-end rounded-card bg-surface px-5 py-4 shadow-neon-glow">
              <TypingIndicator />
            </div>
          )}

          {state.phase === 'done' && (
            <div className="max-w-[85%] self-end rounded-card rounded-br-sm bg-surface px-5 py-4">
              <p className="font-display text-base font-semibold leading-relaxed text-paper">
                {state.feedback.llm_feedback}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {state.feedback.is_fallback ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ash">
                    Local response
                  </span>
                ) : (
                  <span className="rounded-full bg-neon/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neon">
                    BoostCoach AI
                  </span>
                )}
                <span className="rounded-full bg-ember/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ember">
                  Streak {state.feedback.new_streak}
                </span>
              </div>
            </div>
          )}

          {state.phase === 'error' && (
            <div
              role="alert"
              className="flex w-full items-center gap-2 rounded-card bg-crimson/10 px-4 py-3 text-sm text-crimson"
            >
              <AlertTriangle size={16} className="flex-shrink-0" />
              {state.message}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void requestFeedback()}
          disabled={state.phase === 'loading'}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-neon py-4 text-lg font-black uppercase tracking-widest text-ink shadow-neon-glow transition-all hover:shadow-neon-glow-strong active:scale-95 disabled:opacity-60"
        >
          <Send size={20} />
          {state.phase === 'loading' ? 'Thinking…' : 'Ask The Coach'}
        </button>
      </div>
    </div>
  );
}
