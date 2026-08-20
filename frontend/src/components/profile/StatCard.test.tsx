import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Zap } from 'lucide-react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('displays label and numeric value', () => {
    render(<StatCard icon={Zap} label="Total XP" value={1234} />);
    expect(screen.getByText('Total XP')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('displays string values', () => {
    render(<StatCard icon={Zap} label="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies accent styling when accent prop is true', () => {
    const { container } = render(
      <StatCard icon={Zap} label="XP" value={100} accent />,
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('border-neon');
  });

  it('applies default styling without accent', () => {
    const { container } = render(
      <StatCard icon={Zap} label="XP" value={100} />,
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('bg-white');
  });
});
