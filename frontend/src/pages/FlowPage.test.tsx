import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { RoutineItem } from '../api/client';
import type { Boost } from '../types/boost';
import { FlowPage } from './FlowPage';

vi.mock('../api/client', () => ({
  api: {
    getTodayBoosts: vi.fn(),
    swapBoost: vi.fn(),
    getUserProfile: vi.fn(),
    getRoutines: vi.fn().mockResolvedValue([]),
    getWeeklyStats: vi.fn().mockResolvedValue({ sessions_this_week: 0, weekly_goal: 4 }),
    deleteRoutine: vi.fn().mockResolvedValue(undefined),
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
        <Route path="/builder/:routine_id" element={<BuilderMarker />} />
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

function mockRoutines(routines: RoutineItem[]) {
  vi.mocked(api.getRoutines).mockResolvedValue(routines);
}

describe('FlowPage', () => {
  beforeEach(() => {
    vi.mocked(api.getTodayBoosts).mockReset();
    vi.mocked(api.swapBoost).mockReset();
    vi.mocked(api.getUserProfile).mockReset();
    vi.mocked(api.getRoutines).mockReset();
    vi.mocked(api.getRoutines).mockResolvedValue([]);
    vi.mocked(api.getWeeklyStats).mockReset();
    vi.mocked(api.getWeeklyStats).mockResolvedValue({ sessions_this_week: 0, weekly_goal: 4 });
    vi.mocked(api.deleteRoutine).mockReset();
    vi.mocked(api.deleteRoutine).mockResolvedValue(undefined);
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

  it('re-fetches boosts when the window regains focus', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);

    renderFlow();
    await waitFor(() => {
      expect(api.getTodayBoosts).toHaveBeenCalled();
    });

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
          { exercise_id: 'e-1', exercise_name: 'Plank', movement_pattern: 'core', sets: 3, reps: 1, rest_seconds: 30 },
          { exercise_id: 'e-2', exercise_name: 'Crunches', movement_pattern: 'core', sets: 3, reps: 15, rest_seconds: 30 },
        ],
        schedule_days: null,
        created_at: '2026-08-15T10:00:00Z',
      },
      {
        id: 'r-2',
        name: 'Leg Day',
        exercises: [
          { exercise_id: 'e-3', exercise_name: 'Squat', movement_pattern: 'squat', sets: 4, reps: 10, rest_seconds: 60 },
        ],
        schedule_days: null,
        created_at: '2026-08-15T10:00:00Z',
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
      { id: 'r-1', name: 'A', exercises: [], schedule_days: null, created_at: '' },
      { id: 'r-2', name: 'B', exercises: [], schedule_days: null, created_at: '' },
    ]);

    renderFlow();
    await screen.findByText('A');

    expect(screen.getByRole('button', { name: /create custom flow/i })).toBeInTheDocument();
  });

  it('hides Create Custom Flow CTA when at 4 routines', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      { id: 'r-1', name: 'A', exercises: [], schedule_days: null, created_at: '' },
      { id: 'r-2', name: 'B', exercises: [], schedule_days: null, created_at: '' },
      { id: 'r-3', name: 'C', exercises: [], schedule_days: null, created_at: '' },
      { id: 'r-4', name: 'D', exercises: [], schedule_days: null, created_at: '' },
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
          { exercise_id: 'e-1', exercise_name: 'Plank', movement_pattern: 'core', sets: 3, reps: 1, rest_seconds: 30 },
        ],
        schedule_days: null,
        created_at: '',
      },
    ]);

    renderFlow();
    await screen.findByText('Morning Core');

    // Click on the routine in "My Custom Flows" section
    const routineButtons = screen.getAllByText('Morning Core');
    await userEvent.click(routineButtons[0]);

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

    vi.mocked(api.getRoutines).mockResolvedValue([
      { id: 'r-1', name: 'New Flow', exercises: [], schedule_days: null, created_at: '' },
    ]);

    fireEvent.focus(window);

    expect(await screen.findByText('New Flow')).toBeInTheDocument();
  });

  // --- Today's Flow (scheduled routines) ---

  it('shows scheduled routines in Today\'s Flow section', async () => {
    const today = new Date().getDay();
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Scheduled Flow',
        exercises: [
          { exercise_id: 'e-1', exercise_name: 'Push-ups', movement_pattern: 'push', sets: 3, reps: 10, rest_seconds: 60 },
        ],
        schedule_days: [today],
        created_at: '',
      },
    ]);

    renderFlow();

    expect(await screen.findAllByText('Scheduled Flow')).toHaveLength(2);
    expect(screen.getByText(/scheduled for today/i)).toBeInTheDocument();
  });

  it('shows rest day message when no routines are scheduled for today', async () => {
    const today = new Date().getDay();
    const otherDay = (today + 3) % 7;
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Other Day Flow',
        exercises: [],
        schedule_days: [otherDay],
        created_at: '',
      },
    ]);

    renderFlow();

    expect(await screen.findByText('Rest Day!')).toBeInTheDocument();
    expect(screen.getByText(/pick a flow below/i)).toBeInTheDocument();
  });

  // --- Edit / Delete ---

  it('shows 3-dot menu button on routine cards', async () => {
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [
          { exercise_id: 'e-1', exercise_name: 'Plank', movement_pattern: 'core', sets: 3, reps: 1, rest_seconds: 30 },
        ],
        schedule_days: null,
        created_at: '',
      },
    ]);

    renderFlow();
    await screen.findByText('Morning Core');

    expect(screen.getByRole('button', { name: /options for morning core/i })).toBeInTheDocument();
  });

  it('opens edit/delete menu when 3-dot is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [],
        schedule_days: null,
        created_at: '',
      },
    ]);

    renderFlow();
    await screen.findByText('Morning Core');

    await user.click(screen.getByRole('button', { name: /options for morning core/i }));

    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('navigates to builder with routine_id when Edit is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [],
        schedule_days: null,
        created_at: '',
      },
    ]);

    renderFlow();
    await screen.findByText('Morning Core');

    await user.click(screen.getByRole('button', { name: /options for morning core/i }));
    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(await screen.findByText('Builder Page')).toBeInTheDocument();
  });

  it('shows delete confirmation when Delete is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [],
        schedule_days: null,
        created_at: '',
      },
    ]);

    renderFlow();
    await screen.findByText('Morning Core');

    await user.click(screen.getByRole('button', { name: /options for morning core/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(screen.getByRole('dialog', { name: /delete routine/i })).toBeInTheDocument();
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();
  });

  it('deletes routine when confirmed', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getTodayBoosts).mockResolvedValue([]);
    mockRoutines([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [],
        schedule_days: null,
        created_at: '',
      },
    ]);

    renderFlow();
    await screen.findByText('Morning Core');

    await user.click(screen.getByRole('button', { name: /options for morning core/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(api.deleteRoutine).toHaveBeenCalledWith('r-1');
    expect(await screen.findByText(/haven't built any flows yet/i)).toBeInTheDocument();
  });
});
