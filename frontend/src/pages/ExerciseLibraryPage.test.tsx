import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { Exercise } from '../types/boost';
import { ExerciseLibraryPage } from './ExerciseLibraryPage';

vi.mock('../api/client', () => ({
  api: { getExercises: vi.fn() },
}));

function renderLibrary() {
  return render(
    <MemoryRouter initialEntries={['/library']}>
      <Routes>
        <Route path="/library" element={<ExerciseLibraryPage />} />
        <Route path="/workout" element={<div>Workout</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  makeExercise({ id: 'e-1', name_translations: { en: 'Squat' }, primary_muscle: 'quadriceps', movement_pattern: 'squat', equipment_required: 'bodyweight' }),
  makeExercise({ id: 'e-2', name_translations: { en: 'Push-Up' }, primary_muscle: 'chest', movement_pattern: 'push', equipment_required: 'bodyweight' }),
  makeExercise({ id: 'e-3', name_translations: { en: 'Barbell Row' }, primary_muscle: 'back', movement_pattern: 'pull', equipment_required: 'barbell' }),
  makeExercise({ id: 'e-4', name_translations: { en: 'Deadlift' }, primary_muscle: 'hamstrings', movement_pattern: 'hinge', equipment_required: 'barbell' }),
  makeExercise({ id: 'e-5', name_translations: { en: 'Plank' }, primary_muscle: 'core', movement_pattern: 'core', equipment_required: 'bodyweight' }),
  makeExercise({ id: 'e-6', name_translations: { en: 'Lunge' }, primary_muscle: 'quadriceps', movement_pattern: 'squat', equipment_required: 'dumbbells' }),
];

function getGridContainer() {
  return document.querySelector('.grid.grid-cols-2') as HTMLElement;
}

describe('ExerciseLibraryPage', () => {
  beforeEach(() => {
    vi.mocked(api.getExercises).mockReset();
    vi.mocked(api.getExercises).mockResolvedValue(SAMPLE);
  });

  it('loads and renders all exercises', async () => {
    renderLibrary();
    expect(await screen.findByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Push-Up')).toBeInTheDocument();
    expect(screen.getByText('6 exercises')).toBeInTheDocument();
  });

  it('filters by Bodyweight equipment', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /equipment: home/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Squat')).toBeInTheDocument();
    expect(within(grid).getByText('Push-Up')).toBeInTheDocument();
    expect(within(grid).getByText('Plank')).toBeInTheDocument();
    expect(within(grid).queryByText('Barbell Row')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Deadlift')).not.toBeInTheDocument();
  });

  it('filters by Weights equipment', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /equipment: gym/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Barbell Row')).toBeInTheDocument();
    expect(within(grid).getByText('Deadlift')).toBeInTheDocument();
    expect(within(grid).getByText('Lunge')).toBeInTheDocument();
    expect(within(grid).queryByText('Squat')).not.toBeInTheDocument();
  });

  it('filters by movement pattern chip', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /pattern: push/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Push-Up')).toBeInTheDocument();
    expect(within(grid).queryByText('Squat')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Deadlift')).not.toBeInTheDocument();
  });

  it('combines equipment and pattern filters', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /equipment: home/i }));
    await user.click(screen.getByRole('button', { name: /pattern: squat/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Squat')).toBeInTheDocument();
    expect(within(grid).queryByText('Push-Up')).not.toBeInTheDocument();
  });

  it('searches exercises by name', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.type(screen.getByPlaceholderText(/search exercises/i), 'dead');

    const grid = getGridContainer();
    expect(within(grid).getByText('Deadlift')).toBeInTheDocument();
    expect(within(grid).queryByText('Push-Up')).not.toBeInTheDocument();
  });

  it('shows empty state when no exercises match', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.type(screen.getByPlaceholderText(/search exercises/i), 'xyz999');

    expect(screen.getByText('No exercises found')).toBeInTheDocument();
  });

  it('opens QuickStartSheet when a card is clicked', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    const grid = getGridContainer();
    const squatCard = within(grid).getByText('Squat').closest('button')!;
    await user.click(squatCard);

    expect(
      await screen.findByRole('dialog', { name: /quick start: squat/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // default sets
    expect(screen.getByText('10')).toBeInTheDocument(); // default reps
  });

  it('resets to All equipment when All is clicked', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /equipment: home/i }));
    const grid = getGridContainer();
    expect(within(grid).queryByText('Barbell Row')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /equipment: all/i }));
    expect(within(grid).getByText('Barbell Row')).toBeInTheDocument();
  });

  it('filters by muscle group LEGS', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /muscle group: legs/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Squat')).toBeInTheDocument();
    expect(within(grid).getByText('Lunge')).toBeInTheDocument();
    expect(within(grid).getByText('Deadlift')).toBeInTheDocument();
    expect(within(grid).queryByText('Push-Up')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Barbell Row')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Plank')).not.toBeInTheDocument();
  });

  it('filters by muscle group CHEST', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /muscle group: chest/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Push-Up')).toBeInTheDocument();
    expect(within(grid).queryByText('Squat')).not.toBeInTheDocument();
  });

  it('filters by muscle group ARMS', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /muscle group: arms/i }));

    // No exercises have biceps/triceps in SAMPLE, so empty state
    expect(screen.getByText('No exercises found')).toBeInTheDocument();
  });

  it('toggles muscle group off when clicked again', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /muscle group: legs/i }));
    const grid = getGridContainer();
    expect(within(grid).queryByText('Push-Up')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /muscle group: legs/i }));
    expect(within(grid).getByText('Push-Up')).toBeInTheDocument();
  });

  it('combines muscle group with equipment and pattern filters', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /equipment: home/i }));
    await user.click(screen.getByRole('button', { name: /muscle group: legs/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Squat')).toBeInTheDocument();
    expect(within(grid).queryByText('Lunge')).not.toBeInTheDocument(); // dumbbells
    expect(within(grid).queryByText('Deadlift')).not.toBeInTheDocument(); // barbell
  });

  it('combines muscle group with pattern filter', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('Squat');

    await user.click(screen.getByRole('button', { name: /muscle group: legs/i }));
    await user.click(screen.getByRole('button', { name: /pattern: hinge/i }));

    const grid = getGridContainer();
    expect(within(grid).getByText('Deadlift')).toBeInTheDocument();
    expect(within(grid).queryByText('Squat')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Lunge')).not.toBeInTheDocument();
  });

  it('shows primary_muscle tag instead of equipment on exercise cards', async () => {
    renderLibrary();
    await screen.findByText('Squat');

    const grid = getGridContainer();
    expect(within(grid).getAllByText('Quadriceps').length).toBeGreaterThanOrEqual(1);
    expect(within(grid).getByText('Chest')).toBeInTheDocument();
    expect(within(grid).getByText('Core')).toBeInTheDocument();
    expect(within(grid).queryByText('Bodyweight')).not.toBeInTheDocument();
    expect(within(grid).queryByText('Weights')).not.toBeInTheDocument();
  });
});
