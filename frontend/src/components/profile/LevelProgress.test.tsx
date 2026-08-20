import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelProgress } from './LevelProgress';

const defaultProps = {
  level: 3,
  currentXp: 450,
  xpForCurrentLevel: 400,
  xpForNextLevel: 900,
  totalXp: 450,
};

describe('LevelProgress', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('displays the current level', () => {
    render(<LevelProgress {...defaultProps} />);
    expect(screen.getByText('Level 3')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows XP progress text after animation', async () => {
    render(<LevelProgress {...defaultProps} />);
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.getByText(/450 \/ 500 XP/)).toBeInTheDocument();
  });

  it('shows XP remaining to next level', async () => {
    render(<LevelProgress {...defaultProps} />);
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.getByText(/XP to Level 4/)).toBeInTheDocument();
  });

  it('shows MAX LEVEL when level is 50', () => {
    render(
      <LevelProgress
        level={50}
        currentXp={250000}
        xpForCurrentLevel={240100}
        xpForNextLevel={240100}
        totalXp={250000}
      />,
    );
    expect(screen.getByText('MAX LEVEL REACHED')).toBeInTheDocument();
    expect(screen.queryByText(/XP to Level/)).not.toBeInTheDocument();
  });

  it('shows zero progress when at level start', async () => {
    render(
      <LevelProgress
        level={2}
        currentXp={100}
        xpForCurrentLevel={100}
        xpForNextLevel={400}
        totalXp={100}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.getByText(/100 \/ 300 XP/)).toBeInTheDocument();
  });
});
