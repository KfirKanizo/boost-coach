/**
 * Local-storage helpers for the user's display name and profile picture.
 *
 * Uses plain `localStorage` (not Capacitor Preferences) intentionally —
 * these are cosmetic, device-local values that should NOT persist across
 * account switches or be synced to the server.
 */

const NAME_KEY = 'bc_profile_name';
const PIC_KEY = 'bc_profile_pic';

export function getProfileName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function setProfileName(name: string): void {
  if (name.trim()) {
    localStorage.setItem(NAME_KEY, name.trim());
  } else {
    localStorage.removeItem(NAME_KEY);
  }
}

/** Returns the base64 data-URL stored for the profile picture, or null. */
export function getProfilePicture(): string | null {
  return localStorage.getItem(PIC_KEY);
}

/**
 * Store a profile picture as a base64 data-URL.
 * Pass `null` to clear the picture.
 */
export function setProfilePicture(dataUrl: string | null): void {
  if (dataUrl) {
    localStorage.setItem(PIC_KEY, dataUrl);
  } else {
    localStorage.removeItem(PIC_KEY);
  }
}
