import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';

/**
 * Subscribes to @capacitor/network and returns whether the device has an
 * active connection. Defaults to `true` so the app never blocks on a missing
 * plugin (SSR, tests) and starts online until proven otherwise.
 */
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let active = true;

    Network.getStatus()
      .then(({ connected }) => {
        if (active) setIsConnected(connected);
      })
      .catch(() => {
        // Plugin unavailable — keep the optimistic online default.
      });

    const handlePromise = Network.addListener('networkStatusChange', ({ connected }) => {
      if (active) setIsConnected(connected);
    });
    handlePromise.catch(() => {});

    return () => {
      active = false;
      void handlePromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return isConnected;
}
