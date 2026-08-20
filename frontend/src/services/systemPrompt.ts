/**
 * Dynamic system prompt builder for the AI Coach.
 *
 * Assembles user profile data, gamification stats, and local preferences
 * into a single system-prompt string that will be prepended to every LLM
 * request. This function is pure — it does not perform any I/O.
 */

import { getProfileName } from './profileStorage';

export interface PromptProfile {
  email: string;
  gender: string | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  fitness_goals: string[] | null;
  fitness_styles: string[] | null;
}

export interface PromptStats {
  level: number;
  total_xp: number;
  full_routines: number;
  single_exercises: number;
  total_verified_reps: number;
  sessions_this_week: number;
  weekly_goal: number;
  current_streak: number;
}

function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function formatList(items: string[]): string {
  if (items.length === 0) return 'none specified';
  return items
    .map((s) => s.replace(/_/g, ' '))
    .join(', ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the system prompt that gives the LLM full context about the user.
 */
export function buildSystemPrompt(
  profile: PromptProfile,
  stats: PromptStats,
): string {
  const name = getProfileName() || profile.email.split('@')[0];
  const gender = profile.gender
    ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
    : 'not specified';

  const bodyMetrics =
    profile.weight != null && profile.height != null
      ? `weighing ${profile.weight}kg (BMI ${bmi(profile.weight, profile.height).toFixed(1)})`
      : profile.weight != null
        ? `weighing ${profile.weight}kg`
        : '';

  const heightStr =
    profile.height != null ? ` ${profile.height}cm tall` : '';

  const ageStr = profile.age != null ? `${profile.age} years old` : 'age unknown';

  const goals =
    profile.fitness_goals && profile.fitness_goals.length > 0
      ? `Their fitness goals are: ${formatList(profile.fitness_goals)}.`
      : '';

  const styles =
    profile.fitness_styles && profile.fitness_styles.length > 0
      ? `They prefer: ${formatList(profile.fitness_styles)} workouts.`
      : '';

  return [
    `You are Boost Coach, an elite AI personal trainer built for the BoostCoach.fit app.`,
    `You are encouraging, knowledgeable, and concise. Give actionable advice.`,
    ``,
    `## Client Profile`,
    `Name: ${name}`,
    `Gender: ${gender}`,
    `Age: ${ageStr}${heightStr}${bodyMetrics ? `, ${bodyMetrics}` : ''}.`,
    goals,
    styles,
    ``,
    `## Fitness Stats`,
    `Level: ${stats.level} (${stats.total_xp} total XP)`,
    `Current streak: ${stats.current_streak} day(s)`,
    `Full routines completed: ${stats.full_routines}`,
    `Single exercises completed: ${stats.single_exercises}`,
    `Verified reps (all time): ${stats.total_verified_reps}`,
    `Sessions this week: ${stats.sessions_this_week}/${stats.weekly_goal}`,
    ``,
    `Use these stats to personalise your advice. Reference their goals and progress naturally.`,
    `Keep responses under 3 sentences unless the user asks for detail.`,
  ]
    .filter(Boolean)
    .join('\n');
}
