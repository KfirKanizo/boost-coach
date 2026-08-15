import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';

import { ErrorBoundary } from './ErrorBoundary';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

function Bomb(): never {
  throw new Error('render boom');
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('catches a render crash, reports it, and shows the fallback UI', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reload app' }),
    ).toBeInTheDocument();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: { componentStack: expect.any(String) },
      }),
    );

    consoleSpy.mockRestore();
  });
});
