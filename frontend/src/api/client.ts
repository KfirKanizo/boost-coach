/**
 * Lightweight BoostCoach API client.
 *
 * Talks to the backend over the `/api/v1` prefix. The base URL can be
 * overridden via `VITE_API_BASE_URL` (e.g. when running the Capacitor app
 * against a remote host); it defaults to the local dev server.
 */

import { getAuthToken, setAuthToken, clearAuthToken } from '../services/tokenStorage';

export interface RoutineItem {
  id: string;
  name: string;
  exercises: {
    exercise_id: string;
    exercise_name: string;
    movement_pattern: string;
    sets: number;
    reps: number;
    rest_seconds: number;
    animation_url?: string;
    instructions?: string[];
  }[];
  schedule_days: number[] | null;
  created_at: string;
}

export interface RoutineCreatePayload {
  name: string;
  exercises: {
    exercise_id: string;
    exercise_name: string;
    movement_pattern: string;
    sets: number;
    reps: number;
    rest_seconds: number;
    animation_url?: string;
    instructions?: string[];
  }[];
  schedule_days?: number[];
}

export interface WorkoutCompletePayload {
  session_type: 'single' | 'flow';
  total_reps: number;
  total_duration_seconds: number;
  exercise_count: number;
  verified_reps: number;
  target_reps: number;
  routine_id?: string;
}

export interface WorkoutSessionItem {
  id: string;
  session_type: string;
  total_reps: number;
  total_duration_seconds: number;
  exercise_count: number;
  created_at: string;
  xp_earned: number;
}

export interface WeeklyStats {
  sessions_this_week: number;
  weekly_goal: number;
}

export interface GamificationStats {
  total_xp: number;
  level: number;
  xp_current_level: number;
  xp_next_level: number;
  full_routines: number;
  single_exercises: number;
  total_reps: number;
  total_verified_reps: number;
  current_streak: number;
  weekly_goal: number;
  sessions_this_week: number;
  activity_days: string[];
}

/** System-wide metrics returned by GET /admin/stats. */
export interface AdminStats {
  total_users: number;
  total_workouts: number;
  total_exercises: number;
}

/** Exercise record returned by admin endpoints. */
export interface AdminExercise {
  id: string;
  name_translations: Record<string, string>;
  primary_muscle: string;
  movement_pattern: string;
  equipment_required: string;
  boost_type: string;
  animation_url: string | null;
  instructions: string[] | null;
  is_active: boolean;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
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
  isAdmin: boolean;
  gender: string | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  current_streak: number;
  fitness_goals: string[] | null;
  fitness_styles: string[] | null;
}

/** Profile update patch — only the provided fields are updated. */
export interface UserProfileUpdateRequest {
  gender?: string;
  age?: number;
  weight?: number;
  height?: number;
  fitness_goals?: string[];
  fitness_styles?: string[];
}

/** A single conversation turn sent as history context. */
export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Response from POST /coach/chat. */
export interface CoachChatResponse {
  reply: string;
  is_fallback: boolean;
}

/** Payload for POST /coach/chat. */
export interface CoachChatPayload {
  message: string;
  system_prompt?: string;
  history?: ChatHistoryTurn[];
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Guard against multiple concurrent 401 redirects. */
let _redirectingToLogin = false;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  console.log('[api:request]', path, '— token:', token ? `${token.slice(0, 20)}…` : null);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && token) {
    console.warn('[api:request] 401 received — clearing token and redirecting to login');
    await clearAuthToken();
    if (!_redirectingToLogin) {
      _redirectingToLogin = true;
      window.location.hash = '/login';
    }
  }

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
    if (!response.access_token || typeof response.access_token !== 'string') {
      console.error('[api:login] backend returned invalid access_token:', response.access_token);
      throw new ApiError('Server returned an invalid token', 500);
    }
    await setAuthToken(response.access_token);
    return response;
  },

  /** POST /auth/register — create a new account with email + password. */
  async register(email: string, password: string): Promise<RegisterResponse> {
    return request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /** POST /auth/google — exchange a Google ID token for a JWT and persist it. */
  async googleLogin(idToken: string): Promise<LoginResponse> {
    const response = await request<LoginResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!response.access_token || typeof response.access_token !== 'string') {
      console.error('[api:googleLogin] backend returned invalid access_token:', response.access_token);
      throw new ApiError('Server returned an invalid token', 500);
    }
    await setAuthToken(response.access_token);
    return response;
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

  /** GET /exercises — full exercise catalogue. */
  getExercises() {
    return request<{ id: string; name_translations: Record<string, string>; primary_muscle: string; movement_pattern: string; equipment_required: string; boost_type: string; animation_url?: string; instructions?: string[] }[]>('/exercises');
  },

  /** POST /coach/chat — free-form conversational chat with the coach. */
  sendCoachChat(
    message: string,
    options?: { system_prompt?: string; history?: ChatHistoryTurn[] },
  ): Promise<CoachChatResponse> {
    const payload: CoachChatPayload = {
      message,
      ...options,
    };
    return request<CoachChatResponse>('/coach/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** GET /routines — list the user's custom routines. */
  getRoutines(): Promise<RoutineItem[]> {
    return request<RoutineItem[]>('/routines');
  },

  /** POST /routines — create a new custom routine. */
  createRoutine(data: RoutineCreatePayload): Promise<RoutineItem> {
    return request<RoutineItem>('/routines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** PUT /routines/:id — update an existing routine. */
  updateRoutine(
    routineId: string,
    data: Partial<RoutineCreatePayload>,
  ): Promise<RoutineItem> {
    return request<RoutineItem>(`/routines/${routineId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /** DELETE /routines/:id — delete a routine. */
  async deleteRoutine(routineId: string): Promise<void> {
    await request(`/routines/${routineId}`, { method: 'DELETE' });
  },

  /** POST /history/complete — log a completed workout session. */
  completeWorkout(
    data: WorkoutCompletePayload,
  ): Promise<WorkoutSessionItem> {
    return request<WorkoutSessionItem>('/history/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** GET /history/weekly-stats — sessions this week + weekly goal. */
  getWeeklyStats(): Promise<WeeklyStats> {
    return request<WeeklyStats>('/history/weekly-stats');
  },

  /** GET /history/stats — aggregated gamification stats for the dashboard. */
  getGamificationStats(): Promise<GamificationStats> {
    return request<GamificationStats>('/history/stats');
  },

  // ── Admin endpoints ──────────────────────────────────────────────

  /** GET /admin/stats — system-wide metrics (admin only). */
  getAdminStats(): Promise<AdminStats> {
    return request<AdminStats>('/admin/stats');
  },

  /** GET /admin/exercises — all exercises including inactive (admin only). */
  getAdminExercises(): Promise<AdminExercise[]> {
    return request<AdminExercise[]>('/admin/exercises');
  },

  /** PUT /admin/exercises/:id — update exercise fields (admin only). */
  updateAdminExercise(
    exerciseId: string,
    data: { movement_pattern?: string; is_active?: boolean },
  ): Promise<AdminExercise> {
    return request<AdminExercise>(`/admin/exercises/${exerciseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // -- Legacy boost stubs (kept for studio components compilation) --

  async getTodayBoosts(): Promise<import('../types/boost').Boost[]> {
    return [];
  },

  async completeBoost(
    _boostId: string,
    _result: unknown,
  ): Promise<{ queued: boolean; boost: unknown }> {
    return { queued: false, boost: null };
  },
};
