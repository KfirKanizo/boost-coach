import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import type { UserProfile, GamificationStats } from '../api/client';
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
} from '../services/chatStorage';
import type { ChatMessage } from '../services/chatStorage';
import { buildSystemPrompt } from '../services/systemPrompt';
import type { PromptProfile, PromptStats } from '../services/systemPrompt';

type CoachState =
  | { phase: 'idle' }
  | { phase: 'loading'; userMessage: string }
  | { phase: 'done' }
  | { phase: 'error'; message: string };

/* ------------------------------------------------------------------ */
/*  Tiny presentational components                                     */
/* ------------------------------------------------------------------ */

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

function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] self-start rounded-card rounded-bl-sm bg-surface px-5 py-4">
      {children}
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] self-end rounded-card rounded-br-sm bg-neon/15 px-5 py-4">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progressive profiling helpers                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  CoachPage                                                          */
/* ------------------------------------------------------------------ */

export function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<CoachState>({ phase: 'idle' });
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);

  // Progressive profiling
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [savingHeight, setSavingHeight] = useState(false);
  const [savedWeight, setSavedWeight] = useState(false);
  const [savedHeight, setSavedHeight] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* -------------------------------------------------------------- */
  /*  Load profile + gamification stats + localStorage history on   */
  /*  mount. Build the dynamic system prompt once data arrives.      */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const [profileData, statsData] = await Promise.all([
          api.getUserProfile(),
          api.getGamificationStats(),
        ]);

        if (!active) return;

        setProfile(profileData);
        setStats(statsData);

        // Build the dynamic system prompt.
        const pp: PromptProfile = {
          email: profileData.email,
          gender: profileData.gender,
          age: profileData.age,
          weight: profileData.weight,
          height: profileData.height,
          fitness_goals: profileData.fitness_goals,
          fitness_styles: profileData.fitness_styles,
        };
        const ps: PromptStats = {
          level: statsData.level,
          total_xp: statsData.total_xp,
          full_routines: statsData.full_routines,
          single_exercises: statsData.single_exercises,
          total_verified_reps: statsData.total_verified_reps,
          sessions_this_week: statsData.sessions_this_week,
          weekly_goal: statsData.weekly_goal,
          current_streak: statsData.current_streak,
        };
        const prompt = buildSystemPrompt(pp, ps);
        setSystemPrompt(prompt);

        // Load persisted chat history from localStorage.
        const history = loadChatHistory(profileData.email);
        if (history.length > 0) setMessages(history);
      } catch {
        // Offline / transient — the prompt is rebuilt on next visit.
      }
    }

    void init();
    return () => {
      active = false;
    };
  }, []);

  /* -------------------------------------------------------------- */
  /*  Persist every new message to localStorage.                    */
  /* -------------------------------------------------------------- */

  const persistHistory = useCallback(
    (updated: ChatMessage[]) => {
      if (profile) saveChatHistory(profile.email, updated);
    },
    [profile],
  );

  /* -------------------------------------------------------------- */
  /*  Auto-scroll to the latest message.                            */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, state.phase]);

  /* -------------------------------------------------------------- */
  /*  Clear conversation history                                    */
  /* -------------------------------------------------------------- */

  const handleClearHistory = useCallback(() => {
    setMessages([]);
    if (profile) clearChatHistory(profile.email);
  }, [profile]);

  /* -------------------------------------------------------------- */
  /*  Send a message to the real LLM via the backend.               */
  /* -------------------------------------------------------------- */

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || state.phase === 'loading') return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    persistHistory(updated);
    setInput('');
    setState({ phase: 'loading', userMessage: text });

    // Build conversation history for the LLM (last 20 turns to stay within context).
    const historyForApi = messages.slice(-20).map((m) => ({
      role: m.role === 'coach' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));

    try {
      const response = await api.sendCoachChat(text, {
        system_prompt: systemPrompt ?? undefined,
        history: historyForApi,
      });

      const coachMsg: ChatMessage = {
        id: `c-${Date.now()}`,
        role: 'coach',
        content: response.reply,
        isFallback: response.is_fallback,
        timestamp: Date.now(),
      };

      const withCoach = [...updated, coachMsg];
      setMessages(withCoach);
      persistHistory(withCoach);
      setState({ phase: 'done' });
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof Error ? err.message : 'The Coach is unavailable',
      });
    }
  }, [
    input,
    state.phase,
    messages,
    systemPrompt,
    persistHistory,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  /* -------------------------------------------------------------- */
  /*  Progressive profiling (weight / height)                       */
  /* -------------------------------------------------------------- */

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

  /* -------------------------------------------------------------- */
  /*  Render                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <header className="flex items-start justify-between px-4 pb-4 pt-6">
        <div>
          <h1 className="font-display text-2xl font-bold">The Coach</h1>
          <p className="text-sm text-ash">
            Personalized feedback powered by AI.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            aria-label="Clear chat history"
            className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-ash transition-colors hover:bg-crimson/15 hover:text-crimson"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </header>

      {/* Chat history */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
      >
        {/* Progressive profiling prompts */}
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

        {/* Empty state */}
        {messages.length === 0 && state.phase === 'idle' && (
          <div className="mx-auto flex max-w-[280px] flex-col items-center gap-3 py-12 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-neon/10">
              <div className="absolute inset-0 animate-pulse rounded-full bg-neon/10" />
              <Sparkles size={26} className="relative text-neon" />
            </div>
            <p className="text-sm leading-relaxed text-ash">
              Ask me anything about fitness, nutrition, or your training plan.
            </p>
          </div>
        )}

        {/* Rendered messages */}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            {msg.role === 'user' ? (
              <UserBubble>
                <p className="text-sm leading-relaxed text-paper">{msg.content}</p>
              </UserBubble>
            ) : (
              <CoachBubble>
                <p className="text-sm leading-relaxed text-paper">{msg.content}</p>
                {msg.isFallback != null && (
                  <div className="mt-2 flex items-center gap-2">
                    {msg.isFallback ? (
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ash">
                        Local response
                      </span>
                    ) : (
                      <span className="rounded-full bg-neon/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neon">
                        BoostCoach AI
                      </span>
                    )}
                  </div>
                )}
              </CoachBubble>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {state.phase === 'loading' && (
          <div className="max-w-[85%] self-start rounded-card rounded-bl-sm bg-surface px-5 py-4">
            <TypingIndicator />
          </div>
        )}

        {/* Error banner */}
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

      {/* Input bar */}
      <div className="fixed inset-x-0 bottom-28 z-30 border-t border-white/10 bg-ink/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask The Coach…"
            aria-label="Message the coach"
            disabled={state.phase === 'loading'}
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-paper placeholder:text-ash focus:border-neon focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={input.trim() === '' || state.phase === 'loading'}
            aria-label="Send message"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-neon text-ink transition-all hover:shadow-neon-glow active:scale-95 disabled:opacity-40"
          >
            {state.phase === 'loading' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
