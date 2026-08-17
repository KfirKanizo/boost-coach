import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createRoutesFromChildren,
  HashRouter,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

import App from './App';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import './index.css';

/**
 * Initialize Sentry error tracking — only when a DSN is configured.
 *
 * Opt-in: without `VITE_SENTRY_DSN` (local dev, tests, preview) nothing is
 * initialized and the app runs identically. When enabled we still follow
 * privacy by design:
 *   * `sendDefaultPii: false` — no emails, names, or addresses are sent;
 *   * a `beforeSend` hook strips any user context from events;
 *   * camera frames / video data are never captured (the vision worker only
 *     reports anonymous FPS numbers via `services/telemetry`).
 */
function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) {
        event.user = {};
      }
      return event;
    },
  });
}

initSentry();

const GOOGLE_WEB_CLIENT_ID =
  '408983234494-j55u6qlk8d476pfn75ur9m5f5annefjm.apps.googleusercontent.com';

async function initGoogleAuth(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await SocialLogin.initialize({
      google: { webClientId: GOOGLE_WEB_CLIENT_ID },
    });
  }
}

initGoogleAuth().catch(() => {
  // Non-fatal: Google Sign-In will not be available on this platform.
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);
