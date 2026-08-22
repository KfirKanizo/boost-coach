/**
 * Web Push notification helpers.
 *
 * Handles service-worker registration, permission requests, subscription
 * generation, and communicating the subscription to the backend.
 */

import { api } from '../api/client';

/** VAPID public key loaded from env. Falls back to empty string. */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

/**
 * Register the service worker if supported and not already registered.
 * Returns the registration or null if unsupported.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

/**
 * Request notification permission, generate a push subscription,
 * and send it to the backend.
 *
 * Returns `true` on success, `false` if the user denied or the
 * environment lacks push support / VAPID key.
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (!('Notification' in window) || !('PushManager' in window)) return false;
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VITE_VAPID_PUBLIC_KEY not set — push notifications disabled');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await registerServiceWorker();
  if (!registration) return false;

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await sendSubscriptionToBackend(existing);
    return true;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  await sendSubscriptionToBackend(subscription);
  return true;
}

/**
 * Check whether push notifications are currently enabled
 * (permission granted + active subscription exists).
 */
export async function isPushEnabled(): Promise<boolean> {
  if (!('Notification' in window) || !('PushManager' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

/**
 * Unsubscribe from push notifications and remove from backend.
 */
export async function disablePushNotifications(): Promise<boolean> {
  if (!('Notification' in window) || !('PushManager' in window)) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  await subscription.unsubscribe();
  return true;
}

async function sendSubscriptionToBackend(
  subscription: PushSubscription,
): Promise<void> {
  const json = subscription.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) return;

  await api.subscribePush({
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });
}
