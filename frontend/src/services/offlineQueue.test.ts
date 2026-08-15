import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: data.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      data.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      data.delete(key);
    }),
  };
});

vi.mock('@capacitor/preferences', () => ({ Preferences: store }));

import {
  clearQueuedBoosts,
  enqueueBoost,
  getQueuedBoosts,
} from './offlineQueue';

describe('offlineQueue', () => {
  beforeEach(() => {
    store.data.clear();
    vi.clearAllMocks();
  });

  it('round-trips a queued boost through Preferences', async () => {
    await enqueueBoost({ boost_id: 'b-1', result_metrics: { reps_completed: 10 } });

    const queue = await getQueuedBoosts();
    expect(queue).toHaveLength(1);
    expect(queue[0].boost_id).toBe('b-1');
    expect(queue[0].result_metrics).toEqual({ reps_completed: 10 });
    expect(queue[0].queued_at).toEqual(expect.any(String));
  });

  it('appends to the existing queue', async () => {
    await enqueueBoost({ boost_id: 'b-1', result_metrics: { reps_completed: 1 } });
    await enqueueBoost({ boost_id: 'b-2', result_metrics: { reps_completed: 2 } });

    const queue = await getQueuedBoosts();
    expect(queue.map((item) => item.boost_id)).toEqual(['b-1', 'b-2']);
  });

  it('clears the queue after a successful sync', async () => {
    await enqueueBoost({ boost_id: 'b-1', result_metrics: { reps_completed: 3 } });
    await clearQueuedBoosts();

    expect(await getQueuedBoosts()).toEqual([]);
    expect(store.remove).toHaveBeenCalledWith({ key: 'offline_boost_queue' });
  });

  it('returns an empty queue for corrupt stored JSON', async () => {
    store.data.set('offline_boost_queue', 'not-json{');

    expect(await getQueuedBoosts()).toEqual([]);
  });
});
