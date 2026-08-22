import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Dumbbell,
  Loader2,
  Shield,
  Users,
  Activity,
  LayoutGrid,
  Send,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { AdminStats } from '../api/client';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-4">
      <Icon size={18} className="text-neon" />
      <span className="font-display text-2xl font-bold text-paper">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wider text-ash">
        {label}
      </span>
    </div>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Broadcast Push state ──────────────────────────────────────────
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastLink, setBroadcastLink] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statsData = await api.getAdminStats();
      setStats(statsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load admin data',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBroadcast = useCallback(async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setBroadcastConfirmOpen(true);
  }, [broadcastTitle, broadcastBody]);

  const confirmBroadcast = useCallback(async () => {
    setBroadcastConfirmOpen(false);
    setBroadcastSending(true);
    setBroadcastResult(null);
    try {
      const result = await api.sendPush({
        send_to_all: true,
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        data: broadcastLink.trim() ? { link: broadcastLink.trim() } : undefined,
      });
      setBroadcastResult(`Sent to ${result.sent} devices (${result.failed} failed, ${result.removed} stale removed)`);
      setBroadcastTitle('');
      setBroadcastBody('');
      setBroadcastLink('');
    } catch (err) {
      setBroadcastResult(err instanceof Error ? err.message : 'Broadcast failed');
    } finally {
      setBroadcastSending(false);
    }
  }, [broadcastTitle, broadcastBody, broadcastLink]);

  return (
    <div className="px-4 pb-28 pt-6">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/15">
          <Shield size={20} className="text-neon" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-ash">System management</p>
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-card bg-surface py-10 text-sm text-ash"
        >
          <Loader2 size={18} className="animate-spin text-neon" />
          Loading admin data…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          role="alert"
          className="flex flex-col items-center gap-4 rounded-card bg-surface px-6 py-10 text-center"
        >
          <AlertTriangle size={24} className="text-crimson" />
          <p className="text-sm text-ash">{error}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-2 rounded-full bg-neon px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-ink"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* System overview */}
          {stats && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
                System Overview
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Users"
                  value={stats.total_users}
                  icon={Users}
                />
                <StatCard
                  label="Workouts"
                  value={stats.total_workouts}
                  icon={Activity}
                />
                <StatCard
                  label="Exercises"
                  value={stats.total_exercises}
                  icon={Dumbbell}
                />
              </div>
            </section>
          )}

          {/* Action cards */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
              Management
            </h2>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/exercises')}
                className="group flex items-center gap-4 rounded-card bg-surface p-5 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon transition-colors group-hover:bg-neon/15">
                  <Dumbbell size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-paper">
                    Manage Exercises
                  </span>
                  <span className="text-xs text-ash">
                    View, filter, and edit exercise details
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/programs')}
                className="group flex items-center gap-4 rounded-card bg-surface p-5 text-left transition-all hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon transition-colors group-hover:bg-neon/15">
                  <LayoutGrid size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-paper">
                    Manage Pre-Built Programs
                  </span>
                  <span className="text-xs text-ash">
                    Create and edit curated workout programs
                  </span>
                </div>
              </button>
            </div>
          </section>

          {/* Broadcast Push */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ash">
              Broadcast Push
            </h2>
            <div className="rounded-card border border-white/[0.06] bg-surface p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">Title</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Notification title"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-paper placeholder-ash/50 outline-none focus:border-neon/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">Body</label>
                  <textarea
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    placeholder="Notification message..."
                    rows={2}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-paper placeholder-ash/50 outline-none focus:border-neon/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ash">Link (optional)</label>
                  <input
                    type="text"
                    value={broadcastLink}
                    onChange={(e) => setBroadcastLink(e.target.value)}
                    placeholder="/profile"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-paper placeholder-ash/50 outline-none focus:border-neon/40"
                  />
                </div>
                <button
                  type="button"
                  disabled={broadcastSending || !broadcastTitle.trim() || !broadcastBody.trim()}
                  onClick={() => void handleBroadcast()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-ink transition-colors hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50"
                >
                  {broadcastSending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {broadcastSending ? 'Sending...' : 'Send to All Users'}
                </button>
                {broadcastResult && (
                  <p className={`text-xs font-semibold ${broadcastResult.includes('failed') ? 'text-crimson' : 'text-emerald-400'}`}>
                    {broadcastResult}
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Broadcast confirmation modal */}
      {broadcastConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm broadcast"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm"
          onClick={() => setBroadcastConfirmOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-white/10 bg-surface/90 p-6 text-center backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <Send size={20} className="text-amber-400" />
            </div>
            <h3 className="font-display text-lg font-bold text-paper">
              Broadcast to all users?
            </h3>
            <div className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-ash">Title</p>
              <p className="mt-0.5 text-sm text-paper">{broadcastTitle.trim()}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ash">Body</p>
              <p className="mt-0.5 text-sm text-paper">{broadcastBody.trim()}</p>
              {broadcastLink.trim() && (
                <>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ash">Link</p>
                  <p className="mt-0.5 text-sm text-neon">{broadcastLink.trim()}</p>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-ash">
              This will send a push notification to every subscribed device.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void confirmBroadcast()}
                className="w-full rounded-xl border border-amber-500/40 bg-amber-500/15 py-3 text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500/25 active:scale-[0.98]"
              >
                Send Broadcast
              </button>
              <button
                type="button"
                onClick={() => setBroadcastConfirmOpen(false)}
                className="w-full rounded-xl bg-white/5 py-3 text-sm font-bold text-paper transition-colors hover:bg-white/10 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
