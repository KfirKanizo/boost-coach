import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders the three navigation tabs', () => {
    render(<BottomNav activeTab="flow" onTabChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /The Flow/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /The Coach/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Profile/ })).toBeInTheDocument();
  });

  it('marks the active tab', () => {
    render(<BottomNav activeTab="coach" onTabChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /The Coach/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('fires onTabChange with the clicked tab', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<BottomNav activeTab="flow" onTabChange={onTabChange} />);

    await user.click(screen.getByRole('button', { name: /Profile/ }));

    expect(onTabChange).toHaveBeenCalledWith('profile');
  });
});
