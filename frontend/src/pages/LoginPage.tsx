import { useState } from 'react';
import { Apple, Chrome, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

type Provider = 'google' | 'apple';

/**
 * Mock OAuth identity until the real Google/Apple provider configuration
 * lands. Both buttons sign in as the seeded developer user.
 */
const MOCK_LOGIN_EMAIL = 'test@boostcoach.fit';

interface ProviderButton {
  id: Provider;
  label: string;
  icon: typeof Chrome;
}

const PROVIDERS: ProviderButton[] = [
  { id: 'google', label: 'Continue with Google', icon: Chrome },
  { id: 'apple', label: 'Continue with Apple', icon: Apple },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = pendingProvider !== null;

  const signIn = async (provider: Provider) => {
    if (busy) return;
    setPendingProvider(provider);
    setError(null);
    try {
      await api.login(MOCK_LOGIN_EMAIL);
      navigate('/', { replace: true });
    } catch {
      setError('Sign-in failed. Please try again.');
      setPendingProvider(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-ink px-6 pb-12 pt-20">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="text-6xl font-black tracking-tight text-paper">
          Boost<span className="text-neon">Coach</span>
        </span>
        <p className="text-sm text-ash">Own your daily boost.</p>
      </header>

      <div className="flex w-full flex-col gap-3">
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-crimson/10 px-4 py-3 text-center text-sm font-semibold text-crimson"
          >
            {error}
          </div>
        )}

        {PROVIDERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => void signIn(id)}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-paper py-4 text-base font-bold text-ink transition-opacity disabled:opacity-60 active:scale-[0.98]"
          >
            {pendingProvider === id ? (
              <Loader2
                size={20}
                className="animate-spin"
                role="status"
                aria-label="Signing in"
              />
            ) : (
              <Icon size={20} aria-hidden="true" />
            )}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
