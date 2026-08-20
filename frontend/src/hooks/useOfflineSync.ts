import { useEffect } from 'react';

/**
 * Replays the offline completion queue whenever the device (re)connects.
 *
 * Stub — offline sync was removed with Daily Boosts.
 */
export function useOfflineSync(_isConnected: boolean): void {
  useEffect(() => {
    // No-op: offline boost sync has been removed.
  }, [_isConnected]);
}
