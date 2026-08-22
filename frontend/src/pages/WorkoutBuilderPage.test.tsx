import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { Exercise } from '../types/boost';
import { WorkoutBuilderPage } from './WorkoutBuilderPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../api/client', () => ({
  api: {
    getExercises: vi.fn(),
    getRoutines: vi.fn().mockResolvedValue([]),
    createRoutine: vi.fn().mockResolvedValue({ id: 'new-1', name: 'My Custom Flow', exercises: [], schedule_days: null, created_at: '' }),
    updateRoutine: vi.fn().mockResolvedValue({ id: 'r-1', name: 'Updated', exercises: [], schedule_days: null, created_at: '' }),
  },
}));

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'e-1',
    name_translations: { en: 'Squat' },
    primary_muscle: 'quadriceps',
    movement_pattern: 'squat',
    equipment_required: 'bodyweight',
    boost_type: 'VISION_REP',
    ...overrides,
  };
}

const SAMPLE: Exercise[] = [
  makeExercise({ id: 'e-1', name_translations: { en: 'Squat' }, movement_pattern: 'squat' }),
  makeExercise({ id: 'e-2', name_translations: { en: 'Push-Up' }, movement_pattern: 'push' }),
  makeExercise({ id: 'e-3', name_translations: { en: 'Plank' }, movement_pattern: 'core', boost_type: 'DURATION' }),
  makeExercise({ id: 'e-4', name_translations: { en: 'Deadlift' }, movement_pattern: 'hinge' }),
];

function renderBuilder(routineId?: string) {
  const entries = routineId ? [`/builder/${routineId}`] : ['/builder'];
  return render(
    <MemoryRouter initialEntries={entries}>
      <Routes>
        <Route path="/builder" element={<WorkoutBuilderPage />} />
        <Route path="/builder/:routine_id" element={<WorkoutBuilderPage />} />
        <Route path="/" element={<div>Flow Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkoutBuilderPage', () => {
  beforeEach(() => {
    vi.mocked(api.getExercises).mockReset();
    vi.mocked(api.getExercises).mockResolvedValue(SAMPLE);
    vi.mocked(api.getRoutines).mockReset();
    vi.mocked(api.getRoutines).mockResolvedValue([]);
    vi.mocked(api.createRoutine).mockReset();
    vi.mocked(api.createRoutine).mockResolvedValue({
      id: 'new-1', name: 'My Custom Flow', exercises: [], schedule_days: null, created_at: '',
    });
    vi.mocked(api.updateRoutine).mockReset();
    vi.mocked(api.updateRoutine).mockResolvedValue({
      id: 'r-1', name: 'Updated', exercises: [], schedule_days: null, created_at: '',
    });
  });

  it('renders the routine name input with default value', async () => {
    renderBuilder();
    const input = screen.getByLabelText(/routine name/i);
    expect(input).toHaveValue('My Custom Flow');
  });

  it('allows editing the routine name', async () => {
    const user = userEvent.setup();
    renderBuilder();
    const input = screen.getByLabelText(/routine name/i);

    await user.clear(input);
    await user.type(input, 'Morning Core');

    expect(input).toHaveValue('Morning Core');
  });

  it('shows empty state when no exercises are added', () => {
    renderBuilder();
    expect(screen.getByText(/no exercises yet/i)).toBeInTheDocument();
  });

  it('opens the exercise picker when Add Exercise is clicked', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));

    expect(screen.getByRole('dialog', { name: /add exercise/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search exercises/i)).toBeInTheDocument();
  });

  it('adds an exercise to the routine when clicked in the picker', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows default config values (3 sets, 10 reps, 60s rest)', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    // Check default values are displayed
    expect(screen.getByText('3')).toBeInTheDocument(); // sets
    expect(screen.getByText('10')).toBeInTheDocument(); // reps
    expect(screen.getByText('60s')).toBeInTheDocument(); // rest
  });

  it('increases sets when + button is clicked', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    await user.click(screen.getByRole('button', { name: /increase sets/i }));

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText(/^3$/)).not.toBeInTheDocument();
  });

  it('decreases reps when - button is clicked', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    await user.click(screen.getByRole('button', { name: /decrease reps/i }));

    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('adds multiple exercises to the routine', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // Add Squat
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    // Add Push-Up
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Push-Up'));

    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Push-Up')).toBeInTheDocument();
    expect(screen.getByText('2 exercises')).toBeInTheDocument();
  });

  it('removes an exercise when trash icon is clicked', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    expect(screen.getByText('Squat')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove squat/i }));

    expect(screen.queryByText('Squat')).not.toBeInTheDocument();
    expect(screen.getByText(/no exercises yet/i)).toBeInTheDocument();
  });

  it('moves an exercise down in the list', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // Add two exercises
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Push-Up'));

    // Squat should be first — click its "move down" button
    await user.click(screen.getByRole('button', { name: /move squat down/i }));

    // Now Push-Up should be first, Squat second
    // The move-up button for Push-Up should now exist (was disabled before since it was last)
    expect(screen.getByRole('button', { name: /move push-up up/i })).toBeInTheDocument();
  });

  it('disables move-up on first item and move-down on last item', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Push-Up'));

    // First item (Squat) — move-up disabled
    expect(screen.getByRole('button', { name: /move squat up/i })).toBeDisabled();
    // Last item (Push-Up) — move-down disabled
    expect(screen.getByRole('button', { name: /move push-up down/i })).toBeDisabled();
  });

  it('searches exercises in the picker', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));

    const searchInput = screen.getByPlaceholderText(/search exercises/i);
    await user.type(searchInput, 'dead');

    expect(screen.getByText('Deadlift')).toBeInTheDocument();
    expect(screen.queryByText('Squat')).not.toBeInTheDocument();
    expect(screen.queryByText('Push-Up')).not.toBeInTheDocument();
  });

  it('marks already-selected exercises in the picker', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // Add Squat first
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    // Open picker again
    await user.click(screen.getByRole('button', { name: /add exercise/i }));

    // Squat in the picker should show "Added" badge and be disabled
    const dialog = screen.getByRole('dialog', { name: /add exercise/i });
    const squatItem = within(dialog).getByText('Squat').closest('button')!;
    expect(squatItem).toBeDisabled();
    expect(within(squatItem).getByText('Added')).toBeInTheDocument();
  });

  it('saves the routine via API and navigates back', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // Add an exercise
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    // Save
    await user.click(screen.getByRole('button', { name: /save routine/i }));

    // Should call api.createRoutine
    expect(api.createRoutine).toHaveBeenCalledOnce();
    const callArg = vi.mocked(api.createRoutine).mock.calls[0][0];
    expect(callArg.name).toBe('My Custom Flow');
    expect(callArg.exercises).toHaveLength(1);
    expect(callArg.exercises[0].exercise_id).toBe('e-1');

    // Should show toast
    expect(await screen.findByText('Routine saved!')).toBeInTheDocument();

    // Should navigate back after delay
    expect(await screen.findByText('Flow Page')).toBeInTheDocument();
  });

  it('shows error toast when save fails', async () => {
    vi.mocked(api.createRoutine).mockRejectedValueOnce(new Error('Server error'));
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    await user.click(screen.getByRole('button', { name: /save routine/i }));

    expect(await screen.findByText('Failed to save — try again')).toBeInTheDocument();
  });

  it('shows error toast when trying to save with no exercises', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /save routine/i }));

    expect(await screen.findByText('Add at least one exercise')).toBeInTheDocument();
  });

  it('shows error toast when API rejects the save (e.g. limit reached)', async () => {
    vi.mocked(api.createRoutine).mockRejectedValueOnce({
      status: 409,
      message: 'Maximum of 4 routines reached',
    });
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    await user.click(screen.getByRole('button', { name: /save routine/i }));

    expect(await screen.findByText('Failed to save — try again')).toBeInTheDocument();
    // Should NOT have navigated away
    expect(screen.getByText('Custom Builder')).toBeInTheDocument();
  });

  it('closes the picker when clicking the backdrop', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click the backdrop (the fixed overlay)
    const backdrop = screen.getByRole('dialog', { name: /add exercise/i });
    await user.click(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the picker when clicking the X button', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates back to flow when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(await screen.findByText('Flow Page')).toBeInTheDocument();
  });

  it('shows rest after exercise control only for non-last exercises', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // Add first exercise
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    // With only 1 exercise, "Rest after" should NOT show (it's the last)
    expect(screen.queryByText(/rest after/i)).not.toBeInTheDocument();

    // Add second exercise
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Push-Up'));

    // First exercise should now show "Rest after" control
    expect(screen.getByText(/rest after/i)).toBeInTheDocument();
  });

  it('saves rest_after_exercise value in the payload', async () => {
    const user = userEvent.setup();
    renderBuilder();

    // Add two exercises
    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Squat'));

    await user.click(screen.getByRole('button', { name: /add exercise/i }));
    await user.click(screen.getByText('Push-Up'));

    // Increase rest after for first exercise (default 0, step 15)
    const increaseButtons = screen.getAllByRole('button', { name: /increase rest after/i });
    await user.click(increaseButtons[0]);

    // Save
    await user.click(screen.getByRole('button', { name: /save routine/i }));

    expect(api.createRoutine).toHaveBeenCalledOnce();
    const callArg = vi.mocked(api.createRoutine).mock.calls[0][0];
    expect(callArg.exercises[0].rest_after_exercise).toBe(15);
    expect(callArg.exercises[1].rest_after_exercise).toBe(0); // default for last exercise
  });

  // --- Edit mode ---

  it('shows Edit Routine title in edit mode', async () => {
    vi.mocked(api.getRoutines).mockResolvedValue([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [
          { exercise_id: 'e-1', exercise_name: 'Squat', movement_pattern: 'squat', sets: 3, reps: 10, rest_seconds: 60 },
        ],
        schedule_days: [1, 3],
        created_at: '',
      },
    ]);

    renderBuilder('r-1');

    expect(await screen.findByText('Edit Routine')).toBeInTheDocument();
  });

  it('loads existing routine data in edit mode', async () => {
    vi.mocked(api.getRoutines).mockResolvedValue([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [
          { exercise_id: 'e-1', exercise_name: 'Squat', movement_pattern: 'squat', sets: 4, reps: 12, rest_seconds: 90 },
        ],
        schedule_days: [1, 3],
        created_at: '',
      },
    ]);

    renderBuilder('r-1');

    expect(await screen.findByDisplayValue('Morning Core')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // sets
    expect(screen.getByText('12')).toBeInTheDocument(); // reps
    expect(screen.getByText('90s')).toBeInTheDocument(); // rest
  });

  it('calls updateRoutine instead of createRoutine in edit mode', async () => {
    vi.mocked(api.getRoutines).mockResolvedValue([
      {
        id: 'r-1',
        name: 'Morning Core',
        exercises: [
          { exercise_id: 'e-1', exercise_name: 'Squat', movement_pattern: 'squat', sets: 3, reps: 10, rest_seconds: 60 },
        ],
        schedule_days: null,
        created_at: '',
      },
    ]);

    const user = userEvent.setup();
    renderBuilder('r-1');

    await screen.findByText('Edit Routine');

    await user.click(screen.getByRole('button', { name: /update routine/i }));

    expect(api.updateRoutine).toHaveBeenCalledWith('r-1', expect.objectContaining({
      name: 'Morning Core',
    }));
    expect(api.createRoutine).not.toHaveBeenCalled();
  });

  it('shows Update Routine button text in edit mode', async () => {
    vi.mocked(api.getRoutines).mockResolvedValue([
      {
        id: 'r-1',
        name: 'Test',
        exercises: [],
        schedule_days: null,
        created_at: '',
      },
    ]);

    renderBuilder('r-1');

    expect(await screen.findByText('Update Routine')).toBeInTheDocument();
  });
});
