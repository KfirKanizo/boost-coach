import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { RoutineItem } from '../api/client';
import { FlowPage } from './FlowPage';

vi.mock('../api/client', () => ({
  api: {
    getUserProfile: vi.fn(),
    getRoutines: vi.fn().mockResolvedValue([]),
    getGamificationStats: vi.fn().mockResolvedValue({
      total_xp: 0,
      level: 1,
      xp_current_level: 0,
      xp_next_level: 100,
      full_routines: 0,
      single_exercises: 0,
      total_reps: 0,
      total_verified_reps: 0,
      current_streak: 0,
      weekly_goal: 4,
      sessions_this_week: 0,
      activity_days: [],
    }),
    deleteRoutine: vi.fn().mockResolvedValue(undefined),
  },
}));

function BuilderMarker() {
  return <div>Builder Page</div>;
}

function DiscoverMarker() {
  return <div>Discover Page</div>;
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FlowPage />} />
        <Route path="/builder" element={<BuilderMarker />} />
        <Route path="/builder/:routine_id" element={<BuilderMarker />} />
        <Route path="/discover" element={<DiscoverMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockRoutines(routines: RoutineItem[]) {
  vi.mocked(api.getRoutines).mockResolvedValue(routines);
}

describe('FlowPage', () => {
  beforeEach(() => {
    vi.mocked(api.getUserProfile).mockReset();
    vi.mocked(api.getRoutines).mockReset();
    vi.mocked(api.getRoutines).mockResolvedValue([]);
    vi.mocked(api.getGamificationStats).mockReset();
    vi.mocked(api.getGamificationStats).mockResolvedValue({
      total_xp: 250,
      level: 2,
      xp_current_level: 100,
      xp_next_level: 400,
      full_routines: 5,
      single_exercises: 3,
      total_reps: 120,
      total_verified_reps: 90,
      current_streak: 4,
      weekly_goal: 4,
      sessions_this_week: 2,
      activity_days: [],
    });
    vi.mocked(api.deleteRoutine).mockReset();
    vi.mocked(api.deleteRoutine).mockResolvedValue(undefined);
    vi.mocked(api.getUserProfile).mockResolvedValue({
      id: 'u-1',
      email: 'test@example.com',
      isAdmin: false,
      gender: null,
      age: null,
      weight: null,
      height: null,
      current_streak: 3,
      fitness_goals: null,
      fitness_styles: null,
    });
  });

  it('renders the gamification header with level and weekly tracker', async () => {
    renderFlow();

    expect(await screen.findByText('Level 2')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
  });

  it('shows empty state when no routines are saved', async () => {
    renderFlow();

    expect(
      await screen.findByText(/haven't built any flows yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create custom flow/i })).toBeInTheDocument();
  });

  it('loads and displays saved custom routines', async () => {
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
    mockRoutines([
      { id: 'r-1', name: 'A', exercises: [], schedule_days: null, created_at: '' },
      { id: 'r-2', name: 'B', exercises: [], schedule_days: null, created_at: '' },
    ]);

    renderFlow();
    await screen.findByText('A');

    expect(screen.getByRole('button', { name: /create custom flow/i })).toBeInTheDocument();
  });

  it('hides Create Custom Flow CTA when at 4 routines', async () => {
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

    const routineButtons = screen.getAllByText('Morning Core');
    await userEvent.click(routineButtons[0]);

    expect(screen.getByRole('dialog', { name: /overview: morning core/i })).toBeInTheDocument();
    expect(screen.getByText('Session overrides')).toBeInTheDocument();
  });

  it('navigates to builder when Create Custom Flow is clicked', async () => {
    renderFlow();

    await userEvent.click(screen.getByRole('button', { name: /create custom flow/i }));

    expect(await screen.findByText('Builder Page')).toBeInTheDocument();
  });

  it('re-fetches routines when the window regains focus', async () => {
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

  it('shows Discover Pro Programs button', () => {
    renderFlow();
    expect(screen.getByText('Discover Pro Programs')).toBeInTheDocument();
  });

  it('navigates to discover page when Discover button is clicked', async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByText('Discover Pro Programs'));
    expect(await screen.findByText('Discover Page')).toBeInTheDocument();
  });
});
