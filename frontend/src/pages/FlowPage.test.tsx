import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Preferences } from '@capacitor/preferences';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { Boost } from '../types/boost';
import { FlowPage } from './FlowPage';

vi.mock('../api/client', () => ({
  api: {
    getTodayBoosts: vi.fn(),
    swapBoost: vi.fn(),
    getUserProfile: vi.fn(),
  },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

function StudioMarker() {
  const { boost_id } = useParams<{ boost_id: string }>();
  return <div>Studio {boost_id}</div>;
}

function BuilderMarker() {
  return <div>Builder Page</div>;
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FlowPage />} />
        <Route path="/builder" element={<BuilderMarker />} />
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

function mockRoutines(routines: unknown[]) {
  vi.mocked(Preferences.get).mockResolvedValue({
    value: JSON.stringify(routines),
  });
}

describe('FlowPage', () => {
  beforeEach(() => {
    vi.mocked(api.getTodayBoosts).mockReset();
    vi.mocked(api.swapBoost).mockReset();
    vi.mocked(api.getUserProfile).mockReset();
    vi.mocked(Preferences.get).mockReset();
    vi.mocked(Preferences.get).mockResolvedValue({ value: null });
    vi.mocked(api.getUserProfile).mockResolvedValue({
      id: 'u-1',
      email: 'test@example.com',
      gender: null,
      age: null,
      weight: null,
      height: null,
      current_streak: 3,
      fitness_goals: null,
      fitness_styles: null,
    });
  });

  // --- Boost loading ---

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

  // --- Custom routines ---

  it('shows empty state when no routines are saved', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();

    expect(
      await screen.findByText(/haven't built any flows yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create custom flow/i })).toBeInTheDocument();
  });

  it('loads and displays saved custom routines', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [
          { exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 3, reps: 1, restSeconds: 30 },
          { exerciseId: 'e-2', exerciseName: 'Crunches', movementPattern: 'core', sets: 3, reps: 15, restSeconds: 30 },
        ],
        createdAt: '2026-08-15T10:00:00Z',
      },
      {
        id: 'r-2',
        name: 'Leg Day',
        exercises: [
          { exerciseId: 'e-3', exerciseName: 'Squat', movementPattern: 'squat', sets: 4, reps: 10, restSeconds: 60 },
        ],
        createdAt: '2026-08-15T10:00:00Z',
      },
    ]);

    renderFlow();

    expect(await screen.findByText('Morning Core')).toBeInTheDocument();
    expect(screen.getByText('Leg Day')).toBeInTheDocument();
    expect(screen.getByText('2 exercises')).toBeInTheDocument();
    expect(screen.getByText('1 exercise')).toBeInTheDocument();
  });

  it('shows Create Custom Flow CTA when under 4 routines', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      { id: 'r-1', name: 'A', exercises: [], createdAt: '' },
      { id: 'r-2', name: 'B', exercises: [], createdAt: '' },
    ]);

    renderFlow();
    await screen.findByText('A');

    expect(screen.getByRole('button', { name: /create custom flow/i })).toBeInTheDocument();
  });

  it('hides Create Custom Flow CTA when at 4 routines', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      { id: 'r-1', name: 'A', exercises: [], createdAt: '' },
      { id: 'r-2', name: 'B', exercises: [], createdAt: '' },
      { id: 'r-3', name: 'C', exercises: [], createdAt: '' },
      { id: 'r-4', name: 'D', exercises: [], createdAt: '' },
    ]);

    renderFlow();
    await screen.findByText('A');

    expect(screen.queryByRole('button', { name: /create custom flow/i })).not.toBeInTheDocument();
  });

  it('opens FlowOverviewSheet when a routine card is clicked', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [
          { exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 3, reps: 1, restSeconds: 30 },
        ],
        createdAt: '',
      },
    ]);

    renderFlow();
    await screen.findByText('Morning Core');

    await userEvent.click(screen.getByText('Morning Core'));

    // The sheet should open with the routine name in the header
    expect(screen.getByRole('dialog', { name: /overview: morning core/i })).toBeInTheDocument();
    expect(screen.getByText('Session overrides')).toBeInTheDocument();
  });

  it('navigates to builder when Create Custom Flow is clicked', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();

    await userEvent.click(screen.getByRole('button', { name: /create custom flow/i }));

    expect(await screen.findByText('Builder Page')).toBeInTheDocument();
  });

  it('re-fetches routines when the window regains focus', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();
    await screen.findByText(/haven't built any flows yet/i);

    // Update the mock to return a routine
    mockRoutines([
      { id: 'r-1', name: 'New Flow', exercises: [], createdAt: '' },
    ]);

    fireEvent.focus(window);

    expect(await screen.findByText('New Flow')).toBeInTheDocument();
  });
});
