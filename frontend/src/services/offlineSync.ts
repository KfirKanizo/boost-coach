import { api } from '../api/client';
import { clearQueuedBoosts, getQueuedBoosts } from './offlineQueue';

/**
 * Flush every queued completion to POST /boosts/sync.
 *
 * Returns the number of boosts flushed, or 0 when the queue is empty. The
 * queue is only cleared after the backend acknowledges the batch, so a
 * transient failure loses nothing — the next reconnect retries.
 */
export async function flushOfflineQueue(): Promise<number> {
  const queue = await getQueuedBoosts();
  if (queue.length === 0) return 0;

  const items = queue.map(({ boost_id, result_metrics }) => ({
    boost_id,
    result_metrics,
  }));
  await api.syncBoosts(items);
  await clearQueuedBoosts();
  return queue.length;
}
