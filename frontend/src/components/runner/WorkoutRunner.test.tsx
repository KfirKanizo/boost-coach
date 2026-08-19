import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFakeWorkers } from '../../test/setupTests';
import type { RoutineExercise } from '../builder/RoutineEditor';
import { WorkoutRunner } from './WorkoutRunner';

// ── Helpers ──────────────────────────────────────────────────────────

const EXERCISES_DEFAULTS: RoutineExercise[] = [
  { exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 2, reps: 3, restSeconds: 2 },
  { exerciseId: 'e-2', exerciseName: 'Crunches', movementPattern: 'core', sets: 2, reps: 4, restSeconds: 2 },
];

function makeExercises(overrides?: Partial<RoutineExercise>[]): RoutineExercise[] {
  if (!overrides) return EXERCISES_DEFAULTS.map((d) => ({ ...d }));
  return EXERCISES_DEFAULTS.map((d, i) => ({ ...d, ...(overrides[i] ?? {}) }));
}

function singleExercise(overrides: Partial<RoutineExercise> = {}): RoutineExercise[] {
  return [{ exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 2, reps: 3, restSeconds: 2, ...overrides }];
}

function renderRunner(exercises?: RoutineExercise[]) {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/workout', state: { sessionExercises: exercises ?? makeExercises() } },
      ]}
    >
      <WorkoutRunner />
    </MemoryRouter>,
  );
}

function latestWorker() {
  return getFakeWorkers().at(-1)!;
}

async function waitForReady() {
  await act(async () => {
    latestWorker().emit({ type: 'READY' });
  });
  await act(async () => {});
}

async function emitResults(repCount: number) {
  await act(async () => {
    latestWorker().emit({
      type: 'RESULTS',
      frame: { landmarks: null, repCount, phase: 'squat', warning: null },
    });
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('WorkoutRunner', () => {
  it('renders nothing when no exercises are provided', () => {
    render(
      <MemoryRouter initialEntries={['/workout']}>
        <WorkoutRunner />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/plank/i)).not.toBeInTheDocument();
  });

  it('shows loading state on mount', () => {
    renderRunner();
    expect(screen.getByText(/initializing camera/i)).toBeInTheDocument();
  });

  it('transitions to ready after worker emits READY', async () => {
    renderRunner();
    await waitForReady();

    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.getByText(/start when ready/i)).toBeInTheDocument();
    expect(screen.getByText('Set 1 / 2')).toBeInTheDocument();
  });

  it('transitions to active on first rep and shows rep counter', async () => {
    renderRunner();
    await waitForReady();
    await emitResults(1);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('/3')).toBeInTheDocument();
  });

  it('counts local reps via worker delta', async () => {
    renderRunner();
    await waitForReady();

    await emitResults(2);
    expect(screen.getByText('2')).toBeInTheDocument();

    await emitResults(3);
    expect(screen.getByText(/up next/i)).toBeInTheDocument();
  });

  it('starts rest period after hitting target reps', async () => {
    vi.useFakeTimers();
    renderRunner();
    await waitForReady();

    await emitResults(3);

    expect(screen.getByText(/up next/i)).toBeInTheDocument();
    expect(screen.getByText('Set 2 of Plank')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip rest/i })).toBeInTheDocument();
  });

  it('auto-advances to next set after rest countdown', async () => {
    vi.useFakeTimers();
    renderRunner();
    await waitForReady();

    await emitResults(3);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {});

    await waitForReady();

    expect(screen.getByText('Set 2 / 2')).toBeInTheDocument();
  });

  it('skip rest button immediately triggers next set', async () => {
    vi.useFakeTimers();
    renderRunner();
    await waitForReady();

    await emitResults(3); // → resting

    // Use fireEvent to avoid userEvent + fake timer deadlock
    fireEvent.click(screen.getByRole('button', { name: /skip rest/i }));
    await act(async () => {});
    await waitForReady();

    expect(screen.getByText('Set 2 / 2')).toBeInTheDocument();
  });

  it('completes workout after final set of last exercise', async () => {
    renderRunner(singleExercise({ sets: 1, reps: 2, restSeconds: 0 }));
    await waitForReady();

    await emitResults(2);

    expect(screen.getByText('Workout Complete')).toBeInTheDocument();
    expect(screen.getByText('Plank')).toBeInTheDocument();
  });

  it('transitions to next exercise after completing all sets', async () => {
    vi.useFakeTimers();
    renderRunner([
      { exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 1, reps: 2, restSeconds: 0 },
      { exerciseId: 'e-2', exerciseName: 'Crunches', movementPattern: 'core', sets: 1, reps: 2, restSeconds: 0 },
    ]);
    await waitForReady();

    await emitResults(2);

    expect(screen.getByText(/get ready/i)).toBeInTheDocument();
    expect(screen.getByText('Crunches')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {});

    await waitForReady();

    expect(screen.getByText('Crunches')).toBeInTheDocument();
    expect(screen.getByText('Set 1 / 1')).toBeInTheDocument();
  });

  it('shows exercise counter badge', async () => {
    renderRunner();
    await waitForReady();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('shows error overlay when worker fails', async () => {
    renderRunner();
    await act(async () => {
      latestWorker().emit({ type: 'ERROR', message: 'Model download failed' });
    });

    expect(screen.getByText('Model download failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows End workout button during active phase', async () => {
    renderRunner();
    await waitForReady();
    await emitResults(1);

    expect(screen.getByRole('button', { name: /end workout/i })).toBeInTheDocument();
  });

  it('shows completion with correct totals for multi-exercise workout', async () => {
    vi.useFakeTimers();
    renderRunner([
      { exerciseId: 'e-1', exerciseName: 'Plank', movementPattern: 'core', sets: 1, reps: 2, restSeconds: 0 },
      { exerciseId: 'e-2', exerciseName: 'Crunches', movementPattern: 'core', sets: 1, reps: 3, restSeconds: 0 },
    ]);
    await waitForReady();

    await emitResults(2);
    await act(async () => { vi.advanceTimersByTime(1500); });
    await act(async () => {});
    await waitForReady();

    await emitResults(3);

    expect(screen.getByText('Workout Complete')).toBeInTheDocument();
    expect(screen.getByText('2 exercises · 2 sets · 5 total reps')).toBeInTheDocument();
  });

  it('shows posture warning during active phase', async () => {
    renderRunner();
    await waitForReady();
    await emitResults(1);

    await act(async () => {
      latestWorker().emit({
        type: 'RESULTS',
        frame: { landmarks: null, repCount: 2, phase: 'squat', warning: 'knee_valgus' },
      });
    });

    expect(screen.getByText(/knees caving in/i)).toBeInTheDocument();
  });

  it('navigates home when Return to Dashboard is clicked', async () => {
    renderRunner(singleExercise({ sets: 1, reps: 1, restSeconds: 0 }));
    await waitForReady();
    await emitResults(1);

    expect(screen.getByText('Workout Complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to dashboard/i })).toBeInTheDocument();
  });
});
