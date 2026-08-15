import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';

import { reportVisionFps, reportVisionSessionFps } from './telemetry';

vi.mock('@sentry/react', () => ({
  addBreadcrumb: vi.fn(),
}));

const env = import.meta.env as Record<string, unknown>;

describe('telemetry facade', () => {
  afterEach(() => {
    env.VITE_SENTRY_DSN = '';
    vi.clearAllMocks();
  });

  it('is a complete no-op when no DSN is configured', () => {
    env.VITE_SENTRY_DSN = '';

    reportVisionFps(27.3);
    reportVisionSessionFps(24.1);

    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  it('reports anonymized FPS breadcrumbs when enabled', () => {
    env.VITE_SENTRY_DSN = 'https://abc@example.ingest.sentry.io/123';

    reportVisionFps(27.25);
    reportVisionSessionFps(24.14);

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(2);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'vision.performance',
        level: 'info',
        data: { fps: 27.3 },
      }),
    );
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'vision.performance',
        level: 'info',
        data: { avgFps: 24.1 },
      }),
    );
  });
});
