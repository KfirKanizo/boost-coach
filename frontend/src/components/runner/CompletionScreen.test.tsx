import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CompletionScreen } from './CompletionScreen';

const defaultExercises = [
  { name: 'Plank', sets: 3, repsPerSet: 1 },
  { name: 'Crunches', sets: 3, repsPerSet: 15 },
];

describe('CompletionScreen', () => {
  it('shows the Workout Complete heading', () => {
    render(
      <CompletionScreen exercises={defaultExercises} onReturn={vi.fn()} />,
    );
    expect(screen.getByText('Workout Complete')).toBeInTheDocument();
  });

  it('displays the correct total summary', () => {
    render(
      <CompletionScreen exercises={defaultExercises} onReturn={vi.fn()} />,
    );
    expect(
      screen.getByText('2 exercises · 6 sets · 48 total reps'),
    ).toBeInTheDocument();
  });

  it('lists each exercise with its set×rep breakdown', () => {
    render(
      <CompletionScreen exercises={defaultExercises} onReturn={vi.fn()} />,
    );
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText('Crunches')).toBeInTheDocument();
    expect(screen.getByText('3×1')).toBeInTheDocument();
    expect(screen.getByText('3×15')).toBeInTheDocument();
  });

  it('shows a Return to Dashboard button', () => {
    render(
      <CompletionScreen exercises={defaultExercises} onReturn={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /return to dashboard/i }),
    ).toBeInTheDocument();
  });

  it('calls onReturn when the button is clicked', async () => {
    const onReturn = vi.fn();
    const user = userEvent.setup();
    render(<CompletionScreen exercises={defaultExercises} onReturn={onReturn} />);

    await user.click(screen.getByRole('button', { name: /return to dashboard/i }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('handles a single exercise', () => {
    render(
      <CompletionScreen
        exercises={[{ name: 'Squats', sets: 5, repsPerSet: 10 }]}
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
      <CompletionScreen exercises={defaultExercises} onReturn={vi.fn()} />,
    );
    // Trophy icon is an SVG with lucide class
    const trophy = container.querySelector('.lucide-trophy');
    expect(trophy).toBeInTheDocument();
  });
});
