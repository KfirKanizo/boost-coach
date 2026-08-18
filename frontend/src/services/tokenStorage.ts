import { Preferences } from '@capacitor/preferences';

/**
 * JWT access-token storage backed by @capacitor/preferences with an
 * in-memory cache.
 *
 * On Android the Capacitor Preferences bridge can resolve its set()
 * Promise before the value is actually committed to native storage.
 * A subsequent get() in the same micro-task queue then returns null,
 * which strips the Authorization header from every follow-up request.
 *
 * The in-memory cache keeps writes immediately visible to reads so
 * the token is never lost between set → navigate → get.
 */

const TOKEN_KEY = 'auth_token';

let _cached: string | null = null;

export async function getAuthToken(): Promise<string | null> {
  if (_cached) return _cached;

  const { value } = await Preferences.get({ key: TOKEN_KEY });
  console.log('[tokenStorage] getAuthToken — native value:', value);
  _cached = value ?? null;
  return _cached;
}

export async function setAuthToken(token: string): Promise<void> {
  if (!token || typeof token !== 'string') {
    console.error('[tokenStorage] setAuthToken — REFUSED non-string token:', token);
    return;
  }
  await Preferences.set({ key: TOKEN_KEY, value: token });
  _cached = token;
  console.log('[tokenStorage] setAuthToken — cached token, first 20 chars:', token.slice(0, 20));
}

export async function clearAuthToken(): Promise<void> {
  await Preferences.remove({ key: TOKEN_KEY });
  _cached = null;
  console.log('[tokenStorage] clearAuthToken — cache cleared');
}

/** Expose for tests only — resets the in-memory cache. */
export function _resetCacheForTest(): void {
  _cached = null;
}
