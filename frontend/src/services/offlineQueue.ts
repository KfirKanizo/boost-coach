import { Preferences } from '@capacitor/preferences';

/**
 * Offline-first completion queue persisted via @capacitor/preferences.
 *
 * When a boost completes without connectivity, `completeBoost` appends the
 * `BoostCompleteRequest` payload here. Once the network listener detects a
 * connection the queue is flushed to POST /boosts/sync and cleared.
 */

export interface QueuedBoost {
  boost_id: string;
  result_metrics: Record<string, unknown>;
  queued_at: string;
}

const QUEUE_KEY = 'offline_boost_queue';

export async function getQueuedBoosts(): Promise<QueuedBoost[]> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as QueuedBoost[]) : [];
  } catch {
    // Corrupt/partial write; treat as an empty queue rather than crashing.
    return [];
  }
}

export async function enqueueBoost(
  payload: Omit<QueuedBoost, 'queued_at'>,
): Promise<void> {
  const queue = await getQueuedBoosts();
  const item: QueuedBoost = {
    ...payload,
    queued_at: new Date().toISOString(),
  };
  await Preferences.set({
    key: QUEUE_KEY,
    value: JSON.stringify([...queue, item]),
  });
}

export async function clearQueuedBoosts(): Promise<void> {
  await Preferences.remove({ key: QUEUE_KEY });
}
