import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAuthToken } from '../../services/tokenStorage';

type AuthStatus = 'checking' | 'authed' | 'unauthed';

/**
 * Route guard for the authenticated app shell.
 *
 * Reads the stored JWT from tokenStorage; while that check is pending it
 * renders a full-screen loading state, and when no token exists it redirects
 * to the login screen. Authenticated users render the nested routes via the
 * router Outlet.
 */
export function AuthGuard() {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    void getAuthToken().then((token) => {
      if (cancelled) return;
      setStatus(token ? 'authed' : 'unauthed');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div
        role="status"
        aria-label="Checking session"
        className="flex min-h-screen items-center justify-center bg-ink"
      >
        <Loader2 size={28} className="animate-spin text-neon" />
      </div>
    );
  }

  if (status === 'unauthed') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
