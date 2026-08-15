import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => {
  const data = new Map<string, string>();
  return {
    data,
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: data.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      data.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      data.delete(key);
    }),
  };
});

vi.mock('@capacitor/preferences', () => ({ Preferences: store }));

import { getAuthToken, clearAuthToken, setAuthToken } from './tokenStorage';

describe('tokenStorage', () => {
  beforeEach(() => {
    store.data.clear();
    vi.clearAllMocks();
  });

  it('returns null when no token has been stored', async () => {
    expect(await getAuthToken()).toBeNull();
  });

  it('round-trips a token through Preferences', async () => {
    await setAuthToken('signed.jwt.token');

    expect(await getAuthToken()).toBe('signed.jwt.token');
    expect(store.set).toHaveBeenCalledWith({
      key: 'auth_token',
      value: 'signed.jwt.token',
    });
  });

  it('overwrites a previously stored token', async () => {
    await setAuthToken('first.token');
    await setAuthToken('second.token');

    expect(await getAuthToken()).toBe('second.token');
  });

  it('clears a stored token', async () => {
    await setAuthToken('signed.jwt.token');
    await clearAuthToken();

    expect(await getAuthToken()).toBeNull();
    expect(store.remove).toHaveBeenCalledWith({ key: 'auth_token' });
  });
});
