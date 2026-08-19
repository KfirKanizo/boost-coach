import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { api } from '../../api/client';
import { getFakeWorkers } from '../../test/setupTests';
import {
  reportVisionFps,
  reportVisionSessionFps,
} from '../../services/telemetry';
import type { Boost } from '../../types/boost';
import type { LandmarkPoint } from '../../workers/visionProtocol';
import { MediaPipeCameraTracker } from './MediaPipeCameraTracker';

vi.mock('../../api/client', () => ({
  api: { completeBoost: vi.fn() },
}));

vi.mock('../../services/telemetry', () => ({
  reportVisionFps: vi.fn(),
  reportVisionSessionFps: vi.fn(),
}));

function renderTracker(
  props: { durationSec?: number; boostId?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <Routes>
        <Route path="/session" element={<MediaPipeCameraTracker {...props} />} />
        <Route path="/" element={<div>The Flow</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeBoost(overrides: Partial<Boost> = {}): Boost {
  return {
    id: 'b-1',
    status: 'completed',
    target_metrics: { duration_sec: 1, reps: 1 },
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

const lm = (x: number, y: number, z = 0, visibility = 1): LandmarkPoint => ({
  x,
  y,
  z,
  visibility,
});

const pose33 = (): LandmarkPoint[] => {
  const points: LandmarkPoint[] = [];
  for (let i = 0; i < 33; i += 1) points.push(lm(0.5, 0.5));
  return points;
};

/**
 * Drive the tracker from initializing → ready by emitting a READY message
 * from the worker (camera is already mocked as ready in setupTests).
 */
async function waitForReady() {
  const worker = getFakeWorkers().at(-1);
  expect(worker).toBeDefined();
  await act(async () => {
    worker?.emit({ type: 'READY' });
  });
  // Flush the getUserMedia + captureFrame microtask chain.
  await act(async () => {});
}

/**
 * Emit a RESULTS frame with repCount > 0 to trigger smart start (active).
 */
async function triggerSmartStart() {
  const worker = getFakeWorkers().at(-1);
  await act(async () => {
    worker?.emit({
      type: 'RESULTS',
      frame: {
        landmarks: pose33(),
        repCount: 1,
        phase: 'squat',
        warning: null,
      },
    });
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('MediaPipeCameraTracker', () => {
  it('shows ready overlay with exercise name and settings gear', async () => {
    renderTracker({ durationSec: 90 });

    await waitForReady();

    expect(screen.getByText('Vision Boost')).toBeInTheDocument();
    expect(screen.getByText('VISION_REP')).toBeInTheDocument();
    expect(
      screen.getByText(/Start when ready/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Exercise settings/ }),
    ).toBeInTheDocument();
  });

  it('reflects worker results in the HUD and hides the loading overlay', async () => {
    renderTracker({ durationSec: 30 });

    await waitForReady();

    expect(screen.queryByText('Loading motion model…')).not.toBeInTheDocument();

    // Worker reports a squat frame with a knee-valgus warning.
    // Trigger smart start first so the HUD elements become visible.
    await triggerSmartStart();

    const worker = getFakeWorkers().at(-1);
    await act(async () => {
      worker?.emit({
        type: 'RESULTS',
        frame: {
          landmarks: pose33(),
          repCount: 3,
          phase: 'squat',
          warning: 'knee_valgus',
        },
      });
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('SQUAT')).toBeInTheDocument();
    expect(screen.getByText(/Knees caving in/)).toBeInTheDocument();
  });

  it('renders an error state when the worker fails to initialize', async () => {
    renderTracker({ durationSec: 60 });

    const worker = getFakeWorkers().at(-1);
    await act(async () => {
      worker?.emit({ type: 'ERROR', message: 'model not found' });
    });

    expect(screen.getByText('model not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('does not call the API when rendered as a preview (no boost id)', async () => {
    vi.useFakeTimers();
    renderTracker({ durationSec: 1 });

    await waitForReady();
    await triggerSmartStart();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});

    expect(api.completeBoost).not.toHaveBeenCalled();
    expect(screen.getByText('Set complete')).toBeInTheDocument();
  });

  it('reports completion and queues offline when the network fails', async () => {
    vi.useFakeTimers();
    vi.mocked(api.completeBoost).mockResolvedValue({ queued: true, boost: null });

    renderTracker({ durationSec: 1, boostId: 'b-1' });

    await waitForReady();
    await triggerSmartStart();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});

    expect(api.completeBoost).toHaveBeenCalledWith('b-1', {
      reps_completed: 1,
      duration_sec: 1,
    });
    expect(
      screen.getByText(/Saved locally — will sync when back online/),
    ).toBeInTheDocument();
  });

  it('confirms the profile save when completion succeeds online', async () => {
    vi.useFakeTimers();
    vi.mocked(api.completeBoost).mockResolvedValue({
      queued: false,
      boost: makeBoost(),
    });

    renderTracker({ durationSec: 1, boostId: 'b-1' });

    await waitForReady();
    await triggerSmartStart();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});

    expect(
      screen.getByText(/Progress saved to your profile/),
    ).toBeInTheDocument();
  });

  it('navigates back to The Flow 1.5s after the set completes', async () => {
    vi.useFakeTimers();
    vi.mocked(api.completeBoost).mockResolvedValue({
      queued: false,
      boost: makeBoost(),
    });

    renderTracker({ durationSec: 1, boostId: 'b-1' });

    await waitForReady();
    await triggerSmartStart();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});

    expect(screen.getByText('Set complete')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {});

    expect(screen.getByText('The Flow')).toBeInTheDocument();
  });

  it('does not navigate home in preview mode (no boost id)', async () => {
    vi.useFakeTimers();
    renderTracker({ durationSec: 1 });

    await waitForReady();
    await triggerSmartStart();

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    await act(async () => {});

    expect(screen.getByText('Set complete')).toBeInTheDocument();
    expect(screen.queryByText('The Flow')).not.toBeInTheDocument();
  });

  it('forwards anonymized FPS telemetry from the worker', async () => {
    renderTracker({ durationSec: 60 });

    await waitForReady();

    const worker = getFakeWorkers().at(-1);
    await act(async () => {
      worker?.emit({ type: 'TELEMETRY', fps: 27.3, framesProcessed: 90 });
    });

    expect(reportVisionFps).toHaveBeenCalledWith(27.3);
  });

  it('reports the session average FPS once the set completes', async () => {
    vi.useFakeTimers();
    vi.mocked(api.completeBoost).mockResolvedValue({
      queued: false,
      boost: makeBoost(),
    });

    renderTracker({ durationSec: 1, boostId: 'b-1' });

    await waitForReady();
    await triggerSmartStart();

    const worker = getFakeWorkers().at(-1);
    await act(async () => {
      worker?.emit({ type: 'TELEMETRY', fps: 30, framesProcessed: 10 });
    });
    await act(async () => {
      worker?.emit({ type: 'TELEMETRY', fps: 26, framesProcessed: 20 });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {});

    expect(reportVisionSessionFps).toHaveBeenCalledWith(28);
  });
});
