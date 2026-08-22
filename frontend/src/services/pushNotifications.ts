/**
 * Capacitor Push Notifications helpers.
 *
 * Uses @capacitor/push-notifications for native Android push support.
 * On web (unsupported), all functions return gracefully.
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../api/client';

/**
 * Platform detection: Capacitor native vs. web browser.
 */
function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor;
}

/**
 * Register for push notifications and send the FCM token to the backend.
 * Called once on app launch (after permission is granted).
 */
export async function registerForPush(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;

    await PushNotifications.register();

    return await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10000);

      PushNotifications.addListener('registration', async (token) => {
        clearTimeout(timeout);
        try {
          await api.subscribePush({ fcm_token: token.value });
          resolve(true);
        } catch {
          resolve(false);
        }
      });

      PushNotifications.addListener('registrationError', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

/**
 * Check whether push notifications are enabled.
 * On native: checks if we have a stored token.
 * On web: always returns false (web push not supported in this architecture).
 */
export async function isPushEnabled(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const result = await PushNotifications.checkPermissions();
    return result.receive === 'granted';
  } catch {
    return false;
  }
}

/**
 * Unregister from push notifications (native only).
 * Note: we don't delete the backend subscription — stale tokens are
 * cleaned up automatically by FCM dispatch failures.
 */
export async function disablePushNotifications(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    await PushNotifications.unregister();
    return true;
  } catch {
    return false;
  }
}

/**
 * Enable push notifications (alias for registerForPush).
 */
export async function enablePushNotifications(): Promise<boolean> {
  return registerForPush();
}

/**
 * Whether the current platform supports native push.
 */
export function pushSupported(): boolean {
  return isNative();
}
