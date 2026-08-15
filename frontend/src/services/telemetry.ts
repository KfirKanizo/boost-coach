import * as Sentry from '@sentry/react';

/**
 * Privacy-first telemetry facade.
 *
 * All telemetry flows through this module so the rest of the app never talks
 * to the Sentry SDK directly. When `VITE_SENTRY_DSN` is unset (local dev,
 * tests, preview) every call is a no-op and the app behaves identically.
 *
 * PRIVACY BY DESIGN: only anonymous, aggregate performance numbers are ever
 * reported (rolling FPS, frame counts). No camera frames, video buffers, or
 * user identifiers are attached — ever. Sentry itself is initialized in
 * `main.tsx` with `sendDefaultPii: false` and a `beforeSend` scrubber.
 */

function isEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN);
}

/** Report the vision worker's rolling FPS as an anonymized breadcrumb. */
export function reportVisionFps(fps: number): void {
  if (!isEnabled()) return;
  Sentry.addBreadcrumb({
    category: 'vision.performance',
    message: 'vision.worker.fps',
    level: 'info',
    data: { fps: Math.round(fps * 10) / 10 },
  });
}

/** Report the session-wide average FPS once a set completes. */
export function reportVisionSessionFps(avgFps: number): void {
  if (!isEnabled()) return;
  Sentry.addBreadcrumb({
    category: 'vision.performance',
    message: 'vision.session.avg_fps',
    level: 'info',
    data: { avgFps: Math.round(avgFps * 10) / 10 },
  });
}
