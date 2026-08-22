import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StatisticsPage } from './StatisticsPage';

vi.mock('../api/client', () => ({
  api: {
    getGamificationStats: vi.fn().mockResolvedValue({
      total_xp: 650,
      level: 3,
      xp_current_level: 400,
      xp_next_level: 900,
      full_routines: 8,
      single_exercises: 16,
      total_reps: 888,
      total_verified_reps: 684,
      current_streak: 5,
      weekly_goal: 4,
      sessions_this_week: 3,
      activity_days: ['2026-08-18', '2026-08-20', '2026-08-22'],
    }),
  },
}));

function renderStats() {
  return render(
    <MemoryRouter>
      <StatisticsPage />
    </MemoryRouter>,
  );
}

describe('StatisticsPage', () => {
  it('renders all four widget headings', async () => {
    renderStats();

    expect(await screen.findByText('AI Accuracy Score')).toBeInTheDocument();
    expect(screen.getByText('Workout Volume')).toBeInTheDocument();
    expect(screen.getByText('Muscle Distribution')).toBeInTheDocument();
    expect(screen.getByText('Personal Records')).toBeInTheDocument();
  });

  it('displays the accuracy percentage', async () => {
    renderStats();

    expect(await screen.findByText('77%')).toBeInTheDocument();
    expect(screen.getByText('684 verified')).toBeInTheDocument();
    expect(screen.getByText('888 total reps')).toBeInTheDocument();
  });

  it('displays workout volume stats', async () => {
    renderStats();

    expect(await screen.findByText('312')).toBeInTheDocument();
    expect(screen.getByText('Active Minutes')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('Sessions Done')).toBeInTheDocument();
    expect(screen.getByText('Avg. 13 min per session')).toBeInTheDocument();
  });

  it('displays muscle distribution bars', async () => {
    renderStats();

    expect(await screen.findByText('Legs')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getAllByText('30%')).toHaveLength(2);
    expect(screen.getByText('Core')).toBeInTheDocument();
  });

  it('displays personal records list', async () => {
    renderStats();

    expect(await screen.findByText('Push-Up')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText('Sit-Up')).toBeInTheDocument();
    expect(screen.getByText('Lunge')).toBeInTheDocument();
  });

  it('displays PR max reps', async () => {
    renderStats();

    await screen.findByText('Push-Up');
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  it('renders Coach\'s Insight with dynamic text', async () => {
    renderStats();

    expect(await screen.findByText("Coach's Insight")).toBeInTheDocument();
    expect(screen.getByText(/solid 77% AI verification rate/)).toBeInTheDocument();
    expect(screen.getByText(/strong focus on legs/)).toBeInTheDocument();
  });

  it('shows info tooltips on click', async () => {
    const user = userEvent.setup();
    renderStats();

    await screen.findByText('AI Accuracy Score');

    const infoButtons = screen.getAllByRole('button', { name: /more info/i });
    await user.click(infoButtons[0]);

    expect(
      screen.getByText(/percentage of your reps that were fully validated/),
    ).toBeInTheDocument();
  });

  it('closes tooltip when clicking outside', async () => {
    const user = userEvent.setup();
    renderStats();

    await screen.findByText('AI Accuracy Score');

    const infoButtons = screen.getAllByRole('button', { name: /more info/i });
    await user.click(infoButtons[0]);
    expect(screen.getByText(/percentage of your reps/)).toBeInTheDocument();

    await user.click(screen.getByText('AI Accuracy Score'));
    expect(screen.queryByText(/percentage of your reps/)).not.toBeInTheDocument();
  });
});
