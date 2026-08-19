import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CustomRoutine } from '../../pages/WorkoutBuilderPage';
import { FlowOverviewSheet } from './FlowOverviewSheet';

function makeRoutine(overrides: Partial<CustomRoutine> = {}): CustomRoutine {
  return {
    id: 'r-1',
    name: 'Morning Core',
    exercises: [
      { exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 3, reps: 1, restSeconds: 30 },
      { exerciseId: 'e-2', exerciseName: 'Crunches', movementPattern: 'core', sets: 3, reps: 15, restSeconds: 30 },
    ],
    scheduleDays: null,
    createdAt: '2026-08-15T10:00:00Z',
    ...overrides,
  };
}

function getRow(name: string) {
  return screen.getByText(name).closest<HTMLElement>('div[class*="rounded-card"]')!;
}

function renderSheet(
  overrides: Partial<CustomRoutine> = {},
  onStart = vi.fn(),
  onClose = vi.fn(),
) {
  return {
    onStart,
    onClose,
    ...render(
      <MemoryRouter>
        <FlowOverviewSheet
          routine={makeRoutine(overrides)}
          onStart={onStart}
          onClose={onClose}
        />
      </MemoryRouter>,
    ),
  };
}

describe('FlowOverviewSheet', () => {
  it('renders the routine name in the header', () => {
    renderSheet({ name: 'Leg Day' });
    expect(screen.getByText('Leg Day')).toBeInTheDocument();
  });

  it('displays all exercises with their config values', () => {
    renderSheet();
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText('Crunches')).toBeInTheDocument();
    // Both exercises have 30s rest — verify they exist
    expect(screen.getAllByText('30s').length).toBeGreaterThanOrEqual(1);
  });

  it('shows session overrides label', () => {
    renderSheet();
    expect(screen.getByText(/session overrides/i)).toBeInTheDocument();
  });

  it('increments sets when + is clicked for a specific exercise', async () => {
    const user = userEvent.setup();
    renderSheet();

    const plankRow = getRow('Plank');
    const increaseBtn = within(plankRow).getByRole('button', { name: /increase sets/i });
    await user.click(increaseBtn);

    // Plank had 3 sets, should now show 4
    expect(within(plankRow).getByText('4')).toBeInTheDocument();
  });

  it('decrements reps when - is clicked', async () => {
    const user = userEvent.setup();
    renderSheet({ exercises: [
      { exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 3, reps: 10, restSeconds: 30 },
    ] });

    await user.click(screen.getByRole('button', { name: /decrease reps/i }));

    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('removes an exercise when trash icon is clicked', async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText('Crunches')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove plank/i }));

    expect(screen.queryByText('Plank')).not.toBeInTheDocument();
    expect(screen.getByText('Crunches')).toBeInTheDocument();
  });

  it('moves an exercise down in the list', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: /move plank down/i }));

    // After moving Plank down, Crunches should be first — its move-up should be disabled
    const crunchesRow = getRow('Crunches');
    const crunchesMoveUp = within(crunchesRow).getByRole('button', { name: /move crunches up/i });
    expect(crunchesMoveUp).toBeDisabled();

    // Plank should now be second — its move-down should be disabled
    const plankRow = getRow('Plank');
    const plankMoveDown = within(plankRow).getByRole('button', { name: /move plank down/i });
    expect(plankMoveDown).toBeDisabled();
  });

  it('calls onStart with the (potentially modified) exercises', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    renderSheet({}, onStart);

    await user.click(screen.getByRole('button', { name: /start workout/i }));

    expect(onStart).toHaveBeenCalledTimes(1);
    const exercises = onStart.mock.calls[0][0];
    expect(exercises).toHaveLength(2);
    expect(exercises[0].exerciseName).toBe('Plank');
    expect(exercises[1].exerciseName).toBe('Crunches');
  });

  it('passes modified exercise data to onStart', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    renderSheet({}, onStart);

    // Increase sets for Plank from 3 to 4
    const plankRow = getRow('Plank');
    const increaseBtn = within(plankRow).getByRole('button', { name: /increase sets/i });
    await user.click(increaseBtn);

    await user.click(screen.getByRole('button', { name: /start workout/i }));

    const exercises = onStart.mock.calls[0][0];
    expect(exercises[0].sets).toBe(4);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet({}, vi.fn(), onClose);

    const dialog = screen.getByRole('dialog', { name: /overview/i });
    await user.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet({}, vi.fn(), onClose);

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the original routine object', async () => {
    const original = makeRoutine();
    const originalExercises = original.exercises.map((e) => ({ ...e }));
    const user = userEvent.setup();
    renderSheet(original);

    const plankRow = getRow('Plank');
    const increaseBtn = within(plankRow).getByRole('button', { name: /increase sets/i });
    await user.click(increaseBtn);
    await user.click(screen.getByRole('button', { name: /remove crunches/i }));

    // Original should be untouched
    expect(original.exercises).toEqual(originalExercises);
  });

  it('disables Start Workout when all exercises are removed', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: /remove plank/i }));
    await user.click(screen.getByRole('button', { name: /remove crunches/i }));

    expect(screen.getByRole('button', { name: /start workout/i })).toBeDisabled();
  });

  it('shows empty state message when no exercises remain', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: /remove plank/i }));
    await user.click(screen.getByRole('button', { name: /remove crunches/i }));

    expect(screen.getByText(/no exercises/i)).toBeInTheDocument();
  });
});
