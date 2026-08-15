import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Boost } from '../types/boost';
import { enqueueBoost } from '../services/offlineQueue';
import { getAuthToken, setAuthToken } from '../services/tokenStorage';
import { api } from './client';

vi.mock('../services/offlineQueue', () => ({
  enqueueBoost: vi.fn(),
}));

vi.mock('../services/tokenStorage', () => ({
  getAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
}));

function makeBoost(overrides: Partial<Boost> = {}): Boost {
  return {
    id: 'b-1',
    status: 'pending',
    target_metrics: { sets: 4, reps: 12 },
    result_metrics: null,
    scheduled_date: '2026-08-15',
    exercise: {
      id: 'e-1',
      name_translations: { en: 'Squat', he: 'סקוואט' },
      primary_muscle: 'quadriceps',
      movement_pattern: 'squat',
      equipment_required: 'bodyweight',
      boost_type: 'VISION_REP',
    },
    ...overrides,
  };
}

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

describe('api.getTodayBoosts', () => {
  it('fetches the boosts scheduled for today', async () => {
    const boosts = [makeBoost()];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, boosts));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.getTodayBoosts()).resolves.toEqual(boosts);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/boosts\/today$/);
  });

  it('attaches the Authorization header when a token is stored', async () => {
    vi.mocked(getAuthToken).mockResolvedValue('signed.jwt.token');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await api.getTodayBoosts();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/boosts\/today$/);
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer signed.jwt.token',
    );
  });

  it('omits the Authorization header when no token is stored', async () => {
    vi.mocked(getAuthToken).mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await api.getTodayBoosts();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/boosts\/today$/);
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });
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

describe('api.swapBoost', () => {
  it('POSTs the boost id and swap reason and returns the updated boost', async () => {
    const updated = makeBoost({
      exercise: {
        id: 'e-2',
        name_translations: { en: 'Bodyweight Squat' },
        primary_muscle: 'quadriceps',
        movement_pattern: 'squat',
        equipment_required: 'bodyweight',
        boost_type: 'VISION_REP',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updated));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.swapBoost('b-1', 'no_equipment')).resolves.toEqual(updated);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/engine\/swap$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      boost_id: 'b-1',
      swap_reason: 'no_equipment',
    });
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

describe('api.completeBoost', () => {
  it('PUTs the result metrics and returns the updated boost when online', async () => {
    const updated = makeBoost({ status: 'completed', result_metrics: { reps_completed: 12 } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updated));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.completeBoost('b-1', { reps_completed: 12 });

    expect(result).toEqual({ queued: false, boost: updated });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/boosts\/b-1\/complete$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      result_metrics: { reps_completed: 12 },
    });
  });

  it('queues the payload and returns queued:true when the network fails', async () => {
    vi.mocked(enqueueBoost).mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const result = await api.completeBoost('b-1', { reps_completed: 12 });

    expect(result).toEqual({ queued: true, boost: null });
    expect(enqueueBoost).toHaveBeenCalledWith({
      boost_id: 'b-1',
      result_metrics: { reps_completed: 12 },
    });
  });

  it('rethrows non-network errors instead of queueing them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'Daily boost not found' })),
    );

    await expect(api.completeBoost('b-1', { reps_completed: 12 })).rejects.toMatchObject({
      status: 404,
    });
    expect(enqueueBoost).not.toHaveBeenCalled();
  });
});

describe('api.syncBoosts', () => {
  it('POSTs the offline queue payload to /boosts/sync', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { synced: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    const items = [
      { boost_id: 'b-1', result_metrics: { reps_completed: 10 } },
      { boost_id: 'b-2', result_metrics: { reps_completed: 8 } },
    ];
    await expect(api.syncBoosts(items)).resolves.toEqual({ synced: 2 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/boosts\/sync$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(items);
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
        jsonResponse(404, { detail: 'Daily boost not found' }),
      ),
    );

    await expect(api.getTodayBoosts()).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Daily boost not found',
    });
  });

  it('falls back to a generic message when the body has no detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {})));

    await expect(api.getTodayBoosts()).rejects.toMatchObject({
      status: 500,
      message: 'Request failed (500)',
    });
  });
});
