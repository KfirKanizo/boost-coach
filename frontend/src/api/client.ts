/**
 * Lightweight BoostCoach API client.
 *
 * Talks to the backend over the `/api/v1` prefix. The base URL can be
 * overridden via `VITE_API_BASE_URL` (e.g. when running the Capacitor app
 * against a remote host); it defaults to the local dev server.
 */

import type { Boost } from '../types/boost';
import type { SwapReason } from '../types/swap';
import { enqueueBoost } from '../services/offlineQueue';
import { getAuthToken, setAuthToken } from '../services/tokenStorage';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface CoachFeedback {
  llm_feedback: string;
  new_streak: number;
  is_fallback: boolean;
}

/** The current user's profile as returned by GET /users/me. */
export interface UserProfile {
  id: string;
  email: string;
  weight: number | null;
  height: number | null;
  current_streak: number;
}

/** Progressive profiling patch — only the provided fields are updated. */
export interface UserProfileUpdateRequest {
  weight?: number;
  height?: number;
}

/** Payload queued for offline flush via POST /boosts/sync. */
export interface SyncItem {
  boost_id: string;
  result_metrics: Record<string, unknown>;
}

/**
 * Outcome of a boost completion attempt.
 *
 * `queued: false` — persisted server-side and returned in `boost`.
 * `queued: true`  — the network was unavailable; the payload was stored in the
 *                   offline queue and will flush automatically on reconnect.
 */
export type CompleteBoostResult =
  | { queued: false; boost: Boost }
  | { queued: true; boost: null };

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') {
        message = body.detail;
      }
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

/** True when the fetch itself failed (DNS/TCP/offline) rather than the API. */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export const api = {
  /**
   * POST /auth/login — exchange the OAuth email for a JWT and persist it.
   * Returns the issued access token so callers can render post-login state.
   */
  async login(email: string): Promise<LoginResponse> {
    const response = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    await setAuthToken(response.access_token);
    return response;
  },

  /** GET /boosts/today — today's scheduled boosts for the user. */
  getTodayBoosts(): Promise<Boost[]> {
    return request<Boost[]>('/boosts/today');
  },

  /** POST /engine/swap — swap a boost's exercise, returns the updated boost. */
  swapBoost(boostId: string, swapReason: SwapReason): Promise<Boost> {
    return request<Boost>('/engine/swap', {
      method: 'POST',
      body: JSON.stringify({ boost_id: boostId, swap_reason: swapReason }),
    });
  },

  /** POST /coach/feedback — personalized coach feedback (fallback-safe). */
  getCoachFeedback(): Promise<CoachFeedback> {
    return request<CoachFeedback>('/coach/feedback', { method: 'POST' });
  },

  /** GET /users/me — the current user's profile (weight, height, streak). */
  getUserProfile(): Promise<UserProfile> {
    return request<UserProfile>('/users/me');
  },

  /** PATCH /users/me/profile — update weight/height as the coach prompts. */
  updateUserProfile(data: UserProfileUpdateRequest): Promise<UserProfile> {
    return request<UserProfile>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * PUT /boosts/{boostId}/complete — mark a boost completed.
   *
   * Optimistic by design: when the network is unavailable the payload is
   * appended to the local offline queue and a `queued: true` result is
   * returned so the UI can show "Completed" without waiting for a timeout.
   */
  async completeBoost(
    boostId: string,
    resultMetrics: Record<string, unknown>,
  ): Promise<CompleteBoostResult> {
    try {
      const boost = await request<Boost>(`/boosts/${boostId}/complete`, {
        method: 'PUT',
        body: JSON.stringify({ result_metrics: resultMetrics }),
      });
      return { queued: false, boost };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      try {
        await enqueueBoost({ boost_id: boostId, result_metrics: resultMetrics });
      } catch {
        // Storage unavailable; best-effort queueing never blocks the workout.
      }
      return { queued: true, boost: null };
    }
  },

  /** POST /boosts/sync — flush the offline completion queue in one batch. */
  syncBoosts(items: SyncItem[]): Promise<{ synced: number }> {
    return request<{ synced: number }>('/boosts/sync', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  },
};
