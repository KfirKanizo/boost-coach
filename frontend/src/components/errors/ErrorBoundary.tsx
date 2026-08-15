import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary.
 *
 * Converts any uncaught render/lifecycle crash into a graceful fallback
 * screen instead of a blank app, and reports the error to Sentry (a no-op
 * when telemetry is disabled). Only aggregates anonymous error data — no
 * user or video information is captured.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink p-6 text-center"
        >
          <p className="font-display text-2xl font-bold text-paper">
            Something went wrong
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ash">
            The crash has been reported. Reload the app to get back to your
            workout.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-neon px-6 py-2.5 text-sm font-bold text-ink transition-transform active:scale-95"
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
