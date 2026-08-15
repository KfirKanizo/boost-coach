import { useEffect } from 'react';
import { flushOfflineQueue } from '../services/offlineSync';

/**
 * Replays the offline completion queue whenever the device (re)connects.
 *
 * Fires on the initial online mount too — harmless when the queue is empty.
 * Failures are swallowed here; the next connection change retries.
 */
export function useOfflineSync(isConnected: boolean): void {
  useEffect(() => {
    if (!isConnected) return;
    void flushOfflineQueue().catch(() => {
      // Transient network failure; the next reconnect flushes again.
    });
  }, [isConnected]);
}
