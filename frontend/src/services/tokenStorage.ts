import { Preferences } from '@capacitor/preferences';

/**
 * JWT access-token storage backed by @capacitor/preferences.
 *
 * The token is returned by POST /auth/login and attached as a Bearer
 * Authorization header on every API call. It also persists across app
 * restarts, so the app starts authenticated until the token expires.
 */

const TOKEN_KEY = 'auth_token';

export async function getAuthToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value ?? null;
}

export async function setAuthToken(token: string): Promise<void> {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function clearAuthToken(): Promise<void> {
  await Preferences.remove({ key: TOKEN_KEY });
}
