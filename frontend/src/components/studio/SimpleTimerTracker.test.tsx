import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api/client';
import { SimpleTimerTracker } from './SimpleTimerTracker';

vi.mock('../../api/client', () => ({
  api: { completeBoost: vi.fn() },
}));

function renderTimer(
  props: { initialSeconds?: number; boostId?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <Routes>
        <Route path="/session" element={<SimpleTimerTracker {...props} />} />
        <Route path="/" element={<div>The Flow</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SimpleTimerTracker', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('counts down, completes the set, and navigates home', async () => {
    vi.useFakeTimers();
    vi.mocked(api.completeBoost).mockResolvedValue({
      queued: true,
      boost: null,
    });

    renderTimer({ initialSeconds: 2, boostId: 'b-1' });

    expect(screen.getByText('2')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('1')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});

    expect(screen.getByText('Set complete')).toBeInTheDocument();
    expect(api.completeBoost).toHaveBeenCalledWith('b-1', { duration_sec: 2 });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {});

    expect(screen.getByText('The Flow')).toBeInTheDocument();
  });

  it('finishes the set early via the Finish Set button', async () => {
    vi.mocked(api.completeBoost).mockResolvedValue({
      queued: true,
      boost: null,
    });

    renderTimer({ initialSeconds: 120, boostId: 'b-1' });

    await userEvent.click(screen.getByRole('button', { name: /finish set/i }));

    expect(await screen.findByText('Set complete')).toBeInTheDocument();
    expect(api.completeBoost).toHaveBeenCalledWith('b-1', { duration_sec: 120 });
  });

  it('does not report completion in preview mode without a boost id', async () => {
    vi.useFakeTimers();

    renderTimer({ initialSeconds: 1 });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});

    expect(screen.getByText('Set complete')).toBeInTheDocument();
    expect(api.completeBoost).not.toHaveBeenCalled();
    expect(screen.queryByText('The Flow')).not.toBeInTheDocument();
  });

  it('pauses and resumes the countdown', async () => {
    vi.useFakeTimers();

    renderTimer({ initialSeconds: 10 });

    expect(screen.getByText('10')).toBeInTheDocument();

    // Pause — use fireEvent to avoid userEvent fake-timer conflict
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(screen.getByText('Paused')).toBeInTheDocument();

    // Time passes but countdown should not move
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('10')).toBeInTheDocument();

    // Resume
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
