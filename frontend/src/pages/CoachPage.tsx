import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Send, Sparkles } from 'lucide-react';
import type { UserProfile } from '../api/client';
import { api } from '../api/client';

interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  isFallback?: boolean;
}

type CoachState =
  | { phase: 'idle' }
  | { phase: 'loading'; userMessage: string }
  | { phase: 'done' }
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

/** Right-aligned user bubble. */
function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] self-end rounded-card rounded-br-sm bg-neon/15 px-5 py-4">
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<CoachState>({ phase: 'idle' });
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [savingHeight, setSavingHeight] = useState(false);
  const [savedWeight, setSavedWeight] = useState(false);
  const [savedHeight, setSavedHeight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, state.phase]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || state.phase === 'loading') return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setState({ phase: 'loading', userMessage: text });

    try {
      const response = await api.sendCoachChat(text);
      const coachMsg: ChatMessage = {
        id: `c-${Date.now()}`,
        role: 'coach',
        content: response.reply,
        isFallback: response.is_fallback,
      };
      setMessages((prev) => [...prev, coachMsg]);
      setState({ phase: 'done' });
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof Error ? err.message : 'The Coach is unavailable',
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
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
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-white/10 bg-ink/90 px-4 py-3 backdrop-blur">
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
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
