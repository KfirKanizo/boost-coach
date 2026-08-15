/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Sentry DSN for error tracking. Optional — when unset (local dev,
   * tests, preview) every telemetry call is a no-op and the app runs
   * exactly as before.
   */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
