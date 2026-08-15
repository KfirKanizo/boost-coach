import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, RefreshCw, Ruler, Weight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { UserProfile } from '../api/client';
import { clearAuthToken } from '../services/tokenStorage';

const METRICS = [
  { key: 'weight', label: 'Weight', unit: 'kg', icon: Weight },
  { key: 'height', label: 'Height', unit: 'cm', icon: Ruler },
] as const;

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserProfile();
      setProfile(data);
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

  const streak = profile?.current_streak ?? 0;
  const streakPct = Math.min(100, streak * 10);

  return (
    <div className="px-4 pb-28 pt-6">
      <header className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neon/15">
          <span className="font-display text-xl font-bold text-neon">BC</span>
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          {profile ? (
            <p className="truncate text-sm text-ash">{profile.email}</p>
          ) : (
            <p className="text-sm text-ash">Your profile</p>
          )}
        </div>
      </header>

      {loading && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-card bg-surface py-10 text-sm text-ash"
        >
          <Loader2 size={18} className="animate-spin text-neon" />
          Loading your profile…
        </div>
      )}

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

      {!loading && !error && profile && (
        <>
          {/* Streak card */}
          <section className="mb-6 flex items-center justify-between rounded-card bg-surface p-6">
            <div className="flex items-center gap-3">
              <Zap size={24} className="text-ember" fill="currentColor" />
              <div>
                <p className="font-display text-3xl font-bold">{streak}</p>
                <p className="text-xs uppercase tracking-widest text-ash">
                  Day streak
                </p>
              </div>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-ember transition-all"
                style={{ width: `${streakPct}%` }}
              />
            </div>
          </section>

          {/* Body metrics (collected conversationally) */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ash">
              Body metrics
            </h2>
            {METRICS.map(({ key, label, unit, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-card bg-surface p-5"
              >
                <span className="flex items-center gap-3 text-ash">
                  <Icon size={18} />
                  {label}
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="font-display text-2xl font-bold text-paper">
                    {profile[key] ?? '—'}
                  </span>
                  <span className="text-sm text-ash">{unit}</span>
                </span>
              </div>
            ))}
          </section>

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
