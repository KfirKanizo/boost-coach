import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RestOverlay } from './RestOverlay';

describe('RestOverlay', () => {
  it('displays the countdown timer', () => {
    render(
      <RestOverlay
        secondsRemaining={15}
        totalSeconds={30}
        nextLabel="Set 2 of Plank"
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('seconds')).toBeInTheDocument();
  });

  it('shows the up next label', () => {
    render(
      <RestOverlay
        secondsRemaining={10}
        totalSeconds={30}
        nextLabel="Set 2 of Squats"
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(/up next/i)).toBeInTheDocument();
    expect(screen.getByText('Set 2 of Squats')).toBeInTheDocument();
  });

  it('shows Skip Rest button', () => {
    render(
      <RestOverlay
        secondsRemaining={5}
        totalSeconds={30}
        nextLabel="Set 2 of Plank"
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /skip rest/i })).toBeInTheDocument();
  });

  it('calls onSkip when Skip Rest is clicked', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(
      <RestOverlay
        secondsRemaining={10}
        totalSeconds={30}
        nextLabel="Set 2 of Plank"
        onSkip={onSkip}
      />,
    );

    await user.click(screen.getByRole('button', { name: /skip rest/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('displays 0 when seconds remaining is 0', () => {
    render(
      <RestOverlay
        secondsRemaining={0}
        totalSeconds={30}
        nextLabel="Set 2 of Plank"
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('applies glassmorphism classes', () => {
    const { container } = render(
      <RestOverlay
        secondsRemaining={10}
        totalSeconds={30}
        nextLabel="Set 2"
        onSkip={vi.fn()}
      />,
    );
    const root = container.firstElementChild!;
    expect(root.className).toContain('backdrop-blur-md');
    expect(root.className).toContain('bg-black/40');
  });
});
