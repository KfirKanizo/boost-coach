import { useState } from 'react';
import { Apple, Chrome, Loader2, Mail } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

type Provider = 'google' | 'apple';

const MOCK_APPLE_EMAIL = 'test@boostcoach.fit';

interface ProviderButton {
  id: Provider;
  label: string;
  icon: typeof Chrome;
}

const PROVIDERS: ProviderButton[] = [
  { id: 'google', label: 'Continue with Google', icon: Chrome },
  { id: 'apple', label: 'Continue with Apple', icon: Apple },
];

/** Check if the user's profile needs onboarding (missing basic data). */
function needsOnboarding(profile: { weight: number | null; height: number | null }): boolean {
  return profile.weight == null || profile.height == null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const busy = pendingProvider !== null || submitting;

  /** After successful login, fetch profile and decide where to go. */
  const postLoginRedirect = async () => {
    try {
      const profile = await api.getUserProfile();
      if (needsOnboarding(profile)) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      // If we can't fetch profile, default to onboarding to be safe
      navigate('/onboarding', { replace: true });
    }
  };

  const signInWithGoogle = async () => {
    if (busy) return;
    setPendingProvider('google');
    setError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await SocialLogin.login({
          provider: 'google',
          options: {},
        });
        if (res.provider !== 'google' || res.result.responseType !== 'online') {
          throw new Error('Unexpected login response');
        }
        const idToken = res.result.idToken;
        if (!idToken) throw new Error('No ID token received');
        await api.googleLogin(idToken);
      } else {
        // Web fallback: use mock flow for development
        await api.login('test@boostcoach.fit');
      }
      await postLoginRedirect();
    } catch {
      setError('Sign-in failed. Please try again.');
      setPendingProvider(null);
    }
  };

  const signInWithApple = async () => {
    if (busy) return;
    setPendingProvider('apple');
    setError(null);
    try {
      // Apple Sign-In placeholder — mock until native plugin lands.
      await api.login(MOCK_APPLE_EMAIL);
      await postLoginRedirect();
    } catch {
      setError('Sign-in failed. Please try again.');
      setPendingProvider(null);
    }
  };

  const handleProviderClick = (provider: Provider) => {
    if (provider === 'google') {
      void signInWithGoogle();
    } else {
      void signInWithApple();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isRegister) {
        await api.register(email.trim(), password);
        await api.login(email.trim());
        navigate('/onboarding', { replace: true });
      } else {
        await api.login(email.trim());
        await postLoginRedirect();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(isRegister ? msg : 'Invalid email or password.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-ink px-6 pb-12 pt-20">
      <header className="flex flex-col items-center gap-3 text-center">
        <img
          src="/logo.png"
          alt="BoostCoach"
          className="h-20 w-auto object-contain"
          width={200}
          height={80}
        />
        <p className="text-sm text-ash">Own your daily boost.</p>
      </header>

      <div className="flex w-full flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-crimson/10 px-4 py-3 text-center text-sm font-semibold text-crimson"
          >
            {error}
          </div>
        )}

        {/* OAuth buttons */}
        {PROVIDERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleProviderClick(id)}
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

        {/* Divider */}
        <div className="flex items-center gap-3 py-2">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-bold uppercase tracking-widest text-ash">
            or
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Email + password form */}
        <form onSubmit={(e) => void handleEmailSubmit(e)} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-2xl border-2 border-white/10 bg-surface px-4 py-4 text-base text-paper placeholder:text-ash/60 focus:border-neon focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            className="w-full rounded-2xl border-2 border-white/10 bg-surface px-4 py-4 text-base text-paper placeholder:text-ash/60 focus:border-neon focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon py-4 text-base font-bold uppercase tracking-widest text-ink transition-opacity disabled:opacity-40 active:scale-[0.98]"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Mail size={18} />
            )}
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError(null); }}
          disabled={busy}
          className="text-center text-sm font-semibold text-neon transition-opacity disabled:opacity-60"
        >
          {isRegister
            ? 'Already have an account? Sign in'
            : "Don't have an account? Create one"}
        </button>
      </div>
    </div>
  );
}
