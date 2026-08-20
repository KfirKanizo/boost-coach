import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeeklyActivityTracker } from './WeeklyActivityTracker';

describe('WeeklyActivityTracker', () => {
  it('shows workout count when under goal', () => {
    render(
      <WeeklyActivityTracker
        activityDays={[]}
        sessionsThisWeek={1}
        weeklyGoal={4}
      />,
    );
    expect(screen.getByText('1/4 workouts')).toBeInTheDocument();
  });

  it('shows Goal Met badge when goal is reached', () => {
    render(
      <WeeklyActivityTracker
        activityDays={['2026-08-18']}
        sessionsThisWeek={4}
        weeklyGoal={4}
      />,
    );
    expect(screen.getByText('✓ Goal Met')).toBeInTheDocument();
  });

  it('shows Target Crushed! when over 2x goal', () => {
    render(
      <WeeklyActivityTracker
        activityDays={['2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19']}
        sessionsThisWeek={9}
        weeklyGoal={4}
      />,
    );
    expect(screen.getByText(/Target Crushed!/)).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
  });

  it('renders all 7 day labels', () => {
    render(
      <WeeklyActivityTracker
        activityDays={[]}
        sessionsThisWeek={0}
        weeklyGoal={4}
      />,
    );
    // S M T W T F S — all rendered as day labels
    const dayLabels = screen.getAllByText(/[SMTWF]/);
    expect(dayLabels.length).toBeGreaterThanOrEqual(7);
  });

  it('shows checkmarks for active days', () => {
    // Get today's date string
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    render(
      <WeeklyActivityTracker
        activityDays={[today]}
        sessionsThisWeek={1}
        weeklyGoal={4}
      />,
    );
    // Active day gets a checkmark
    const checks = screen.getAllByText('✓');
    expect(checks.length).toBeGreaterThanOrEqual(1);
  });
});
