import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuthToken } from '../services/tokenStorage';
import { api } from './client';

vi.mock('../services/tokenStorage', () => ({
  getAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
}));

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('api.login', () => {
  it('POSTs the email, persists the token, and returns it', async () => {
    const response = { access_token: 'signed.jwt.token', token_type: 'bearer' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.login('test@boostcoach.fit')).resolves.toEqual(response);
    expect(setAuthToken).toHaveBeenCalledWith('signed.jwt.token');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'test@boostcoach.fit' });
  });

  it('rethrows and does not store a token when login is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, { detail: 'Invalid email or password' }),
      ),
    );

    await expect(api.login('ghost@boostcoach.fit')).rejects.toMatchObject({
      status: 401,
    });
    expect(setAuthToken).not.toHaveBeenCalled();
  });
});

describe('api.getCoachFeedback', () => {
  it('POSTs to /coach/feedback and returns the feedback payload', async () => {
    const payload = {
      llm_feedback: 'Incredible work today!',
      new_streak: 4,
      is_fallback: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, payload));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.getCoachFeedback()).resolves.toEqual(payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/coach\/feedback$/);
    expect(init.method).toBe('POST');
  });
});

describe('api.getUserProfile', () => {
  it('fetches the current user profile', async () => {
    const profile = {
      id: 'u-1',
      email: 'test@boostcoach.fit',
      weight: null,
      height: null,
      current_streak: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, profile));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.getUserProfile()).resolves.toEqual(profile);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/users\/me$/);
  });
});

describe('api.updateUserProfile', () => {
  it('PATCHes the provided profile fields', async () => {
    const updated = {
      id: 'u-1',
      email: 'test@boostcoach.fit',
      weight: 75,
      height: null,
      current_streak: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updated));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.updateUserProfile({ weight: 75 })).resolves.toEqual(updated);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/users\/me\/profile$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ weight: 75 });
  });
});

describe('api error handling', () => {
  it('throws an ApiError carrying the backend detail message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(404, { detail: 'Route not found' }),
      ),
    );

    await expect(api.getUserProfile()).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Route not found',
    });
  });

  it('falls back to a generic message when the body has no detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {})));

    await expect(api.getUserProfile()).rejects.toMatchObject({
      status: 500,
      message: 'Request failed (500)',
    });
  });
});
