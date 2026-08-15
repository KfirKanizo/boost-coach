import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { Boost } from '../types/boost';
import { StudioPage } from './StudioPage';

vi.mock('../api/client', () => ({
  api: { getTodayBoosts: vi.fn() },
}));

vi.mock('../components/studio/StudioFactory', () => ({
  StudioFactory: (props: {
    boostType: string;
    boostId?: string;
    durationSec?: number;
  }) => (
    <div>{`factory:${props.boostType}:${props.boostId ?? 'none'}:${props.durationSec ?? 'none'}`}</div>
  ),
}));

function makeBoost(overrides: Partial<Boost> = {}): Boost {
  return {
    id: 'b-1',
    status: 'pending',
    target_metrics: { sets: 3, reps: 12, duration_sec: 45 },
    result_metrics: null,
    scheduled_date: '2026-08-15',
    exercise: {
      id: 'e-1',
      name_translations: { en: 'Squat' },
      primary_muscle: 'quadriceps',
      movement_pattern: 'squat',
      equipment_required: 'bodyweight',
      boost_type: 'VISION_REP',
    },
    ...overrides,
  };
}

function renderStudio(boostId = 'b-1', state?: { boost: Boost }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/studio/${boostId}`, state }]}>
      <Routes>
        <Route path="/studio/:boost_id" element={<StudioPage />} />
        <Route path="/" element={<div>The Flow</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudioPage', () => {
  beforeEach(() => {
    vi.mocked(api.getTodayBoosts).mockReset();
  });

  it('fetches the boost and renders the factory with type, id, and duration', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([makeBoost()]);

    renderStudio();

    expect(
      await screen.findByText('factory:VISION_REP:b-1:45'),
    ).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(api.getTodayBoosts).toHaveBeenCalled();
  });

  it('uses the boost from route state without fetching', async () => {
    renderStudio('b-1', { boost: makeBoost() });

    expect(
      await screen.findByText('factory:VISION_REP:b-1:45'),
    ).toBeInTheDocument();
    expect(api.getTodayBoosts).not.toHaveBeenCalled();
  });

  it('shows an error with retry when the boost is not found', async () => {
    vi.mocked(api.getTodayBoosts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeBoost()]);

    renderStudio();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Boost not found',
    );

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(
      await screen.findByText('factory:VISION_REP:b-1:45'),
    ).toBeInTheDocument();
  });
});
