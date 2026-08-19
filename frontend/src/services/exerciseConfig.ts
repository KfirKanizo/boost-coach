import { Preferences } from '@capacitor/preferences';

/**
 * Per-exercise configuration (sets, reps/time, rest) persisted to
 * Capacitor Preferences keyed by exercise id.
 *
 * The in-memory cache avoids bridge latency during the same session.
 */

export interface ExerciseConfig {
  sets: number;
  /** Rep target for VISION_REP exercises. */
  reps: number;
  /** Duration in seconds for DURATION exercises. */
  duration: number;
  /** Rest period in seconds between sets. */
  restDuration: number;
}

const PREFIX = 'ex_cfg_';

export const DEFAULT_VISION_REP_CONFIG: ExerciseConfig = {
  sets: 3,
  reps: 12,
  duration: 60,
  restDuration: 60,
};

export const DEFAULT_DURATION_CONFIG: ExerciseConfig = {
  sets: 3,
  reps: 12,
  duration: 45,
  restDuration: 45,
};

const _cache = new Map<string, ExerciseConfig>();

export async function getExerciseConfig(
  exerciseId: string,
  boostType: string,
): Promise<ExerciseConfig> {
  const cached = _cache.get(exerciseId);
  if (cached) return cached;

  const { value } = await Preferences.get({ key: `${PREFIX}${exerciseId}` });
  if (value) {
    try {
      const parsed: ExerciseConfig = JSON.parse(value);
      _cache.set(exerciseId, parsed);
      return parsed;
    } catch {
      // Corrupted value — fall through to defaults.
    }
  }

  const defaults =
    boostType === 'DURATION'
      ? { ...DEFAULT_DURATION_CONFIG }
      : { ...DEFAULT_VISION_REP_CONFIG };
  _cache.set(exerciseId, defaults);
  // Persist defaults so they are available next time.
  await setExerciseConfig(exerciseId, defaults);
  return defaults;
}

export async function setExerciseConfig(
  exerciseId: string,
  config: ExerciseConfig,
): Promise<void> {
  _cache.set(exerciseId, config);
  await Preferences.set({
    key: `${PREFIX}${exerciseId}`,
    value: JSON.stringify(config),
  });
}
