import { ACTIVITY_LEVELS, TONES, emptyProfile, isTimeKey, normalizeGoals } from './profile';
import type { ProfileAnswers, PromptHistory } from './recommendPrompt';
import type { ActivityLevel, CoachingTone } from './types';

/**
 * Request caps (spec R6). Everything crossing the wire is trimmed and bounded
 * before it reaches a prompt, so a hostile or buggy client cannot blow up the
 * model call or the server memory.
 */
export const MAX_TEXT = 2_000;
export const MAX_SHORT = 120;
export const MAX_HABIT_NAME = 50;
export const MAX_ARRAY = 10;

export interface RecommendRequest {
  profile: ProfileAnswers;
  history: PromptHistory;
}

export type ParseResult =
  | { ok: true; value: RecommendRequest }
  | { ok: false; error: string };

const DEFAULT = emptyProfile(0);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function count(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), max);
}

function timeOr(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return isTimeKey(candidate) ? candidate : fallback;
}

/**
 * Validates a `POST /api/recommend` body. Structural problems (not an object,
 * missing profile, an `items` that is not an array) are a 400; individual
 * fields are repaired with defaults so a client one version behind still works.
 */
export function parseRecommendRequest(body: unknown): ParseResult {
  if (!isObject(body)) return { ok: false, error: 'Expected a JSON object.' };
  const rawProfile = body.profile;
  if (!isObject(rawProfile)) return { ok: false, error: 'Missing profile.' };

  const lifestyle = rawProfile.lifestyle ?? {};
  const goals = rawProfile.goals ?? {};
  const preferences = rawProfile.preferences ?? {};
  if (!isObject(lifestyle)) return { ok: false, error: 'Invalid lifestyle.' };
  if (!isObject(goals)) return { ok: false, error: 'Invalid goals.' };
  if (!isObject(preferences)) return { ok: false, error: 'Invalid preferences.' };
  if (goals.items !== undefined && !Array.isArray(goals.items)) {
    return { ok: false, error: 'Goals must be a list.' };
  }

  const profile: ProfileAnswers = {
    lifestyle: {
      wakeTime: timeOr(lifestyle.wakeTime, DEFAULT.lifestyle.wakeTime),
      sleepTime: timeOr(lifestyle.sleepTime, DEFAULT.lifestyle.sleepTime),
      schedule: text(lifestyle.schedule, MAX_TEXT),
      activityLevel: ACTIVITY_LEVELS.includes(lifestyle.activityLevel as ActivityLevel)
        ? lifestyle.activityLevel as ActivityLevel
        : DEFAULT.lifestyle.activityLevel,
      currentHabits: text(lifestyle.currentHabits, MAX_TEXT),
      timeSinks: text(lifestyle.timeSinks, MAX_TEXT),
    },
    goals: {
      items: normalizeGoals(goals.items).slice(0, MAX_ARRAY),
      timeframe: text(goals.timeframe, MAX_SHORT),
      why: text(goals.why, MAX_TEXT),
    },
    challenges: text(rawProfile.challenges, MAX_TEXT),
    preferences: {
      reminderTime: timeOr(preferences.reminderTime, ''),
      tone: TONES.includes(preferences.tone as CoachingTone)
        ? preferences.tone as CoachingTone
        : DEFAULT.preferences.tone,
    },
  };

  const rawHistory = isObject(body.history) ? body.history : {};
  const habitNames = Array.isArray(rawHistory.habitNames)
    ? rawHistory.habitNames
        .filter((name): name is string => typeof name === 'string')
        .map((name) => name.trim().slice(0, MAX_HABIT_NAME))
        .filter(Boolean)
        .slice(0, MAX_ARRAY)
    : [];

  const history: PromptHistory = {
    activeDays: count(rawHistory.activeDays, 366),
    completions: count(rawHistory.completions, 100_000),
    ratePct: count(rawHistory.ratePct, 100),
    habitNames,
  };

  return { ok: true, value: { profile, history } };
}
