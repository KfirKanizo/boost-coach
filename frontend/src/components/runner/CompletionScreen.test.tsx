import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionScreen } from './CompletionScreen';

const defaultExercises = [
  { name: 'Plank', sets: 3, repsPerSet: 1 },
  { name: 'Crunches', sets: 3, repsPerSet: 15 },
];

const defaultExtras = { verifiedReps: 48, targetReps: 50, xpEarned: 480 };

describe('CompletionScreen', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('shows the Workout Complete heading', () => {
    render(
      <CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={vi.fn()} />,
    );
    expect(screen.getByText('Workout Complete')).toBeInTheDocument();
  });

  it('displays the correct total summary', () => {
    render(
      <CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={vi.fn()} />,
    );
    expect(
      screen.getByText('2 exercises · 6 sets · 48 total reps'),
    ).toBeInTheDocument();
  });

  it('lists each exercise with its set×rep breakdown', () => {
    render(
      <CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={vi.fn()} />,
    );
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText('Crunches')).toBeInTheDocument();
    expect(screen.getByText('3×1')).toBeInTheDocument();
    expect(screen.getByText('3×15')).toBeInTheDocument();
  });

  it('shows a Return to Dashboard button', () => {
    render(
      <CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /return to dashboard/i }),
    ).toBeInTheDocument();
  });

  it('calls onReturn when the button is clicked', () => {
    const onReturn = vi.fn();
    render(<CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={onReturn} />);

    fireEvent.click(screen.getByRole('button', { name: /return to dashboard/i }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('handles a single exercise', () => {
    render(
      <CompletionScreen
        exercises={[{ name: 'Squats', sets: 5, repsPerSet: 10 }]}
        verifiedReps={50}
        targetReps={50}
        xpEarned={550}
        onReturn={vi.fn()}
      />,
    );
    expect(
      screen.getByText('1 exercise · 5 sets · 50 total reps'),
    ).toBeInTheDocument();
    expect(screen.getByText('Squats')).toBeInTheDocument();
    expect(screen.getByText('5×10')).toBeInTheDocument();
  });

  it('renders the trophy icon', () => {
    const { container } = render(
      <CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={vi.fn()} />,
    );
    // Trophy icon is an SVG with lucide class
    const trophy = container.querySelector('.lucide-trophy');
    expect(trophy).toBeInTheDocument();
  });

  it('displays XP earned', async () => {
    render(
      <CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={vi.fn()} />,
    );
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText('480')).toBeInTheDocument();
    expect(screen.getByText('XP')).toBeInTheDocument();
  });

  it('shows verified reps vs target', () => {
    render(
      <CompletionScreen exercises={defaultExercises} {...defaultExtras} onReturn={vi.fn()} />,
    );
    expect(screen.getByText('48 / 50 verified reps')).toBeInTheDocument();
  });

  it('shows target bonus when target is met', () => {
    render(
      <CompletionScreen
        exercises={defaultExercises}
        verifiedReps={50}
        targetReps={50}
        xpEarned={550}
        onReturn={vi.fn()}
      />,
    );
    expect(screen.getByText(/\+50 target bonus!/)).toBeInTheDocument();
  });

  it('shows zero XP message when no reps completed', () => {
    render(
      <CompletionScreen
        exercises={defaultExercises}
        verifiedReps={0}
        targetReps={50}
        xpEarned={0}
        onReturn={vi.fn()}
      />,
    );
    expect(screen.getByText(/complete reps to earn xp/i)).toBeInTheDocument();
  });

  it('shows Level Up celebration when newLevel > previousLevel', () => {
    render(
      <CompletionScreen
        exercises={defaultExercises}
        verifiedReps={50}
        targetReps={50}
        xpEarned={550}
        newLevel={2}
        previousLevel={1}
        onReturn={vi.fn()}
      />,
    );
    expect(screen.getByText('Level Up!')).toBeInTheDocument();
    expect(screen.getByText('You reached Level 2')).toBeInTheDocument();
    expect(screen.getByText('1 → 2')).toBeInTheDocument();
  });

  it('does not show Level Up when level unchanged', () => {
    render(
      <CompletionScreen
        exercises={defaultExercises}
        verifiedReps={50}
        targetReps={50}
        xpEarned={550}
        newLevel={2}
        previousLevel={2}
        onReturn={vi.fn()}
      />,
    );
    expect(screen.queryByText('Level Up!')).not.toBeInTheDocument();
  });

  it('does not show Level Up when level props are omitted', () => {
    render(
      <CompletionScreen
        exercises={defaultExercises}
        verifiedReps={50}
        targetReps={50}
        xpEarned={550}
        onReturn={vi.fn()}
      />,
    );
    expect(screen.queryByText('Level Up!')).not.toBeInTheDocument();
  });
});
