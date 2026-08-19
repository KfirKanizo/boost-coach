import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { StudioFactory } from './StudioFactory';
import type { StudioFactoryProps } from './StudioFactory';

type RenderFactoryProps = Pick<StudioFactoryProps, 'boostType'> &
  Partial<Omit<StudioFactoryProps, 'boostType'>>;

function renderFactory(props: RenderFactoryProps) {
  return render(
    <MemoryRouter>
      <StudioFactory {...props} />
    </MemoryRouter>,
  );
}

describe('StudioFactory', () => {
  it('renders the MediaPipe camera tracker for VISION_REP', async () => {
    renderFactory({ boostType: 'VISION_REP' });

    expect(
      await screen.findByRole('heading', { name: 'Vision Boost' }),
    ).toBeInTheDocument();
    expect(screen.getByText('VISION_REP')).toBeInTheDocument();
  });

  it('renders the timer tracker for DURATION', () => {
    renderFactory({ boostType: 'DURATION' });

    expect(screen.getByText('Duration Boost')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start/i }),
    ).toBeInTheDocument();
  });

  it('renders the unsupported fallback for DISTANCE_GPS', () => {
    renderFactory({ boostType: 'DISTANCE_GPS' });

    expect(screen.getByText('Unsupported boost type')).toBeInTheDocument();
    expect(screen.getByText('DISTANCE_GPS')).toBeInTheDocument();
  });
});
