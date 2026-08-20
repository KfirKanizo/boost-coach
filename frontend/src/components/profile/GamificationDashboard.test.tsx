import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import type { GamificationStats } from '../../api/client';
import { GamificationDashboard } from './GamificationDashboard';

vi.mock('../../api/client', () => ({
  api: {
    getGamificationStats: vi.fn(),
  },
}));

const mockStats: GamificationStats = {
  total_xp: 1500,
  level: 4,
  xp_current_level: 900,
  xp_next_level: 1600,
  full_routines: 8,
  single_exercises: 4,
  total_reps: 480,
  total_verified_reps: 450,
  current_streak: 5,
  weekly_goal: 4,
  sessions_this_week: 3,
  activity_days: ['2026-08-17', '2026-08-18', '2026-08-20'],
};

describe('GamificationDashboard', () => {
  beforeEach(() => {
    vi.mocked(api.getGamificationStats).mockReset();
  });

  it('shows loading spinner while fetching', () => {
    vi.mocked(api.getGamificationStats).mockReturnValue(new Promise(() => {}));
    const { container } = render(<GamificationDashboard />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders stats after loading', async () => {
    vi.mocked(api.getGamificationStats).mockResolvedValue(mockStats);
    render(<GamificationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Level 4')).toBeInTheDocument();
    });

    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Full Routines')).toBeInTheDocument();
    expect(screen.getByText('Single Exercises')).toBeInTheDocument();
    expect(screen.getByText('Verified Reps')).toBeInTheDocument();
  });

  it('shows streak banner when streak > 0', async () => {
    vi.mocked(api.getGamificationStats).mockResolvedValue(mockStats);
    render(<GamificationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('5 Day Streak')).toBeInTheDocument();
    });
    expect(screen.getByText('— keep it going!')).toBeInTheDocument();
  });

  it('hides streak banner when streak is 0', async () => {
    vi.mocked(api.getGamificationStats).mockResolvedValue({
      ...mockStats,
      current_streak: 0,
    });
    render(<GamificationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Level 4')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Day Streak/)).not.toBeInTheDocument();
  });

  it('returns null on error', async () => {
    vi.mocked(api.getGamificationStats).mockRejectedValue(new Error('fail'));
    const { container } = render(<GamificationDashboard />);
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders weekly activity tracker', async () => {
    vi.mocked(api.getGamificationStats).mockResolvedValue(mockStats);
    render(<GamificationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('This Week')).toBeInTheDocument();
    });
    expect(screen.getByText('3/4 workouts')).toBeInTheDocument();
  });
});
