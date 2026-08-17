import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { Boost, Exercise } from '../types/boost';
import { FlowPage } from './FlowPage';

vi.mock('../api/client', () => ({
  api: {
    getTodayBoosts: vi.fn(),
    swapBoost: vi.fn(),
    getExercises: vi.fn(),
  },
}));

vi.mock('../components/studio/StudioFactory', () => ({
  StudioFactory: () => null,
}));

function StudioMarker() {
  const { boost_id } = useParams<{ boost_id: string }>();
  return <div>Studio {boost_id}</div>;
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FlowPage />} />
        <Route path="/studio/:boost_id" element={<StudioMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeBoost(overrides: Partial<Boost> = {}): Boost {
  return {
    id: 'b-1',
    status: 'pending',
    target_metrics: { sets: 4, reps: 12 },
    result_metrics: null,
    scheduled_date: '2026-08-15',
    exercise: {
      id: 'e-1',
      name_translations: { en: 'Squat', he: 'סקוואט' },
      primary_muscle: 'quadriceps',
      movement_pattern: 'squat',
      equipment_required: 'bodyweight',
      boost_type: 'VISION_REP',
    },
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'e-10',
    name_translations: { en: 'Push-Up', he: 'שכיבות שמיכה' },
    primary_muscle: 'chest',
    movement_pattern: 'push',
    equipment_required: 'bodyweight',
    boost_type: 'VISION_REP',
    ...overrides,
  };
}

describe('FlowPage', () => {
  beforeEach(() => {
    vi.mocked(api.getTodayBoosts).mockReset();
    vi.mocked(api.swapBoost).mockReset();
    vi.mocked(api.getExercises).mockReset();
    vi.mocked(api.getExercises).mockResolvedValue([
      makeExercise({ id: 'e-10', name_translations: { en: 'Push-Up' }, boost_type: 'VISION_REP' }),
      makeExercise({ id: 'e-11', name_translations: { en: 'Plank' }, boost_type: 'DURATION', movement_pattern: 'isometric' }),
    ]);
  });

  it('shows a loading state then renders the fetched boosts', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([
      makeBoost({
        exercise: {
          id: 'e-1',
          name_translations: { en: 'Dumbbell Thrusters' },
          primary_muscle: 'full_body',
          movement_pattern: 'push',
          equipment_required: 'dumbbells',
          boost_type: 'VISION_REP',
        },
      }),
      makeBoost({
        id: 'b-2',
        exercise: {
          id: 'e-2',
          name_translations: { en: 'Plank Hold' },
          primary_muscle: 'core',
          movement_pattern: 'isometric',
          equipment_required: 'bodyweight',
          boost_type: 'DURATION',
        },
      }),
    ]);

    renderFlow();

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(await screen.findByText('Dumbbell Thrusters')).toBeInTheDocument();
    expect(screen.getByText('Plank Hold')).toBeInTheDocument();
  });

  it('shows an error with retry when the fetch fails', async () => {
    vi.mocked(api.getTodayBoosts)
      .mockRejectedValueOnce(new Error('Cannot reach backend'))
      .mockResolvedValueOnce([
        makeBoost({
          exercise: {
            id: 'e-1',
            name_translations: { en: 'Squat' },
            primary_muscle: 'quadriceps',
            movement_pattern: 'squat',
            equipment_required: 'bodyweight',
            boost_type: 'VISION_REP',
          },
        }),
      ]);

    renderFlow();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach backend',
    );

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Squat')).toBeInTheDocument();
  });

  it('shows a friendly message when no boosts are scheduled', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();

    expect(
      await screen.findByText(/no boosts scheduled today/i),
    ).toBeInTheDocument();
  });

  it('swaps a boost from the bottom sheet and updates the card', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([
      makeBoost({
        exercise: {
          id: 'e-1',
          name_translations: { en: 'Dumbbell Thrusters' },
          primary_muscle: 'full_body',
          movement_pattern: 'push',
          equipment_required: 'dumbbells',
          boost_type: 'VISION_REP',
        },
      }),
    ]);
    vi.mocked(api.swapBoost).mockResolvedValue(
      makeBoost({
        exercise: {
          id: 'e-9',
          name_translations: { en: 'Bodyweight Thrusters' },
          primary_muscle: 'full_body',
          movement_pattern: 'push',
          equipment_required: 'bodyweight',
          boost_type: 'VISION_REP',
        },
      }),
    );

    renderFlow();
    await screen.findByText('Dumbbell Thrusters');

    await userEvent.click(
      screen.getByRole('button', { name: 'Swap Dumbbell Thrusters' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /no equipment/i }),
    );

    expect(api.swapBoost).toHaveBeenCalledWith('b-1', 'no_equipment');
    expect(await screen.findByText('Bodyweight Thrusters')).toBeInTheDocument();
    expect(screen.queryByText('Dumbbell Thrusters')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the sheet open and surfaces an error when the swap fails', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([
      makeBoost({
        exercise: {
          id: 'e-1',
          name_translations: { en: 'Squat' },
          primary_muscle: 'quadriceps',
          movement_pattern: 'squat',
          equipment_required: 'bodyweight',
          boost_type: 'VISION_REP',
        },
      }),
    ]);
    vi.mocked(api.swapBoost).mockRejectedValue(
      new Error('No suitable replacement exercise found'),
    );

    renderFlow();
    await screen.findByText('Squat');

    await userEvent.click(screen.getByRole('button', { name: 'Swap Squat' }));
    await userEvent.click(
      screen.getByRole('button', { name: /muscle soreness/i }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No suitable replacement exercise found',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('navigates to the studio of the first pending boost on Execute', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([
      makeBoost({
        id: 'b-1',
        exercise: {
          id: 'e-1',
          name_translations: { en: 'Squat' },
          primary_muscle: 'quadriceps',
          movement_pattern: 'squat',
          equipment_required: 'bodyweight',
          boost_type: 'VISION_REP',
        },
      }),
      makeBoost({
        id: 'b-2',
        status: 'completed',
        exercise: {
          id: 'e-2',
          name_translations: { en: 'Plank Hold' },
          primary_muscle: 'core',
          movement_pattern: 'isometric',
          equipment_required: 'bodyweight',
          boost_type: 'DURATION',
        },
      }),
    ]);

    renderFlow();
    await screen.findByText('Squat');

    await userEvent.click(screen.getByRole('button', { name: /execute/i }));

    expect(await screen.findByText('Studio b-1')).toBeInTheDocument();
  });

  it('disables Execute and shows DONE when every boost is completed', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([
      makeBoost({
        id: 'b-1',
        status: 'completed',
        exercise: {
          id: 'e-1',
          name_translations: { en: 'Squat' },
          primary_muscle: 'quadriceps',
          movement_pattern: 'squat',
          equipment_required: 'bodyweight',
          boost_type: 'VISION_REP',
        },
      }),
    ]);

    renderFlow();
    await screen.findByText('Squat');

    const execute = screen.getByRole('button', { name: 'DONE' });
    expect(execute).toBeDisabled();
  });

  it('re-fetches boosts when the window regains focus', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();
    await screen.findByText(/no boosts scheduled today/i);

    const callsBefore = vi.mocked(api.getTodayBoosts).mock.calls.length;
    fireEvent.focus(window);

    await waitFor(() => {
      expect(vi.mocked(api.getTodayBoosts).mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });
  });

  it('renders the exercise picker when exercises are fetched', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();

    expect(await screen.findByText('Pick an Exercise')).toBeInTheDocument();
    expect(screen.getByText('Push-Up')).toBeInTheDocument();
    expect(screen.getByText('Plank')).toBeInTheDocument();
  });

  it('shows inline StudioFactory when an exercise is selected', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();
    await screen.findByText('Pick an Exercise');

    // Click the exercise picker button
    const pushUpBtn = screen.getByRole('button', { name: /push-up/i });
    await userEvent.click(pushUpBtn);

    // Close button confirms the inline panel appeared
    expect(screen.getByRole('button', { name: /close exercise/i })).toBeInTheDocument();
  });

  it('hides the inline execution when close is clicked', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();
    await screen.findByText('Pick an Exercise');

    await userEvent.click(screen.getByRole('button', { name: /push-up/i }));
    await userEvent.click(screen.getByRole('button', { name: /close exercise/i }));

    expect(screen.queryByRole('button', { name: /close exercise/i })).not.toBeInTheDocument();
  });
});
