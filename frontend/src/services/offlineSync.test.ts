import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { clearQueuedBoosts, getQueuedBoosts } from './offlineQueue';
import { flushOfflineQueue } from './offlineSync';

vi.mock('../api/client', () => ({
  api: { syncBoosts: vi.fn() },
}));

vi.mock('./offlineQueue', () => ({
  getQueuedBoosts: vi.fn(),
  clearQueuedBoosts: vi.fn(),
}));

describe('flushOfflineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the queue to the sync endpoint and clears it', async () => {
    vi.mocked(getQueuedBoosts).mockResolvedValue([
      {
        boost_id: 'b-1',
        result_metrics: { reps_completed: 10 },
        queued_at: '2026-08-15T10:00:00.000Z',
      },
      {
        boost_id: 'b-2',
        result_metrics: { reps_completed: 8 },
        queued_at: '2026-08-15T10:05:00.000Z',
      },
    ]);
    vi.mocked(api.syncBoosts).mockResolvedValue({ synced: 2 });
    vi.mocked(clearQueuedBoosts).mockResolvedValue(undefined);

    const flushed = await flushOfflineQueue();

    expect(flushed).toBe(2);
    expect(api.syncBoosts).toHaveBeenCalledWith([
      { boost_id: 'b-1', result_metrics: { reps_completed: 10 } },
      { boost_id: 'b-2', result_metrics: { reps_completed: 8 } },
    ]);
    expect(clearQueuedBoosts).toHaveBeenCalled();
  });

  it('is a no-op when the queue is empty', async () => {
    vi.mocked(getQueuedBoosts).mockResolvedValue([]);

    const flushed = await flushOfflineQueue();

    expect(flushed).toBe(0);
    expect(api.syncBoosts).not.toHaveBeenCalled();
    expect(clearQueuedBoosts).not.toHaveBeenCalled();
  });
});
