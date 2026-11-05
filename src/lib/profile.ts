import type {
  ActivityLevel, CoachingTone, Profile, ProfileGoals, ProfileLifestyle, ProfilePreferences,
} from './types';

/**
 * Profile spec R2: one row, keyed 'me'. Defaults live here and nowhere else so
 * the onboarding form, the repo and import all agree on what "empty" means.
 */
export const PROFILE_ID = 'me' as const;

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['low', 'moderate', 'high'] as const;
export const TONES: readonly CoachingTone[] = ['gentle', 'direct'] as const;
export const TIMEFRAMES = ['4 weeks', '3 months', '6 months', '1 year'] as const;

/** Quick-pick chips for the challenges step; the textarea stays free-form. */
export const CHALLENGE_SUGGESTIONS = [
  'No time',
  'Forgetting',
  'All-or-nothing thinking',
  'Low energy',
  'Travel',
  'Stress',
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True for 'HH:MM' 24-hour strings; shared by the form and import. */
export function isTimeKey(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function emptyProfile(now = Date.now()): Profile {
  return {
    id: PROFILE_ID,
    accountEmail: null,
    lifestyle: {
      wakeTime: '07:00',
      sleepTime: '23:00',
      schedule: '',
      activityLevel: 'moderate',
      currentHabits: '',
      timeSinks: '',
    },
    goals: { items: [''], timeframe: '3 months', why: '' },
    challenges: '',
    preferences: { reminderTime: '', tone: 'gentle' },
    skipped: false,
    onboardedAt: 0,
    updatedAt: now,
    recommendations: null,
  };
}

export type ProfilePatch =
  Partial<Omit<Profile, 'id' | 'updatedAt' | 'recommendations' | 'lifestyle' | 'goals' | 'preferences'>> & {
    lifestyle?: Partial<ProfileLifestyle>;
    goals?: Partial<ProfileGoals>;
    preferences?: Partial<ProfilePreferences>;
  };

/** Trims, drops blanks, keeps order, caps at three (spec R3). */
export function normalizeGoals(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asTime(value: unknown, fallback: string): string {
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : fallback;
}

/** Deep merge that keeps the single-row invariants; used by every save. */
export function mergeProfile(base: Profile, patch: ProfilePatch, now = Date.now()): Profile {
  const next: Profile = {
    ...base,
    ...patch,
    id: PROFILE_ID,
    accountEmail: patch.accountEmail !== undefined ? patch.accountEmail : base.accountEmail,
    lifestyle: { ...base.lifestyle, ...patch.lifestyle },
    goals: {
      ...base.goals,
      ...patch.goals,
      items: normalizeGoals(patch.goals?.items ?? base.goals.items),
    },
    preferences: { ...base.preferences, ...patch.preferences },
    updatedAt: now,
    // Recommendations are invalidated by an answer change, never by a save that
    // only touches the account marker. The caller re-adds a cache separately.
    recommendations: base.recommendations,
  };
  if (answersChanged(base, next)) next.recommendations = null;
  return next;
}

/** The answer surface that feeds the prompt; `skipped` deliberately excluded. */
export function answersChanged(a: Profile, b: Profile): boolean {
  const shape = (p: Profile) => JSON.stringify({
    lifestyle: p.lifestyle,
    goals: p.goals,
    challenges: p.challenges,
    preferences: p.preferences,
  });
  return shape(a) !== shape(b);
}

/**
 * Import path: repairs anything salvageable and returns null only when the
 * value is not an object at all. Every field falls back to its default, so a
 * half-written profile from an older export cannot crash the form.
 */
export function normalizeProfile(raw: unknown, now = Date.now()): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const base = emptyProfile(now);
  const lifestyle = (value.lifestyle ?? {}) as Record<string, unknown>;
  const goals = (value.goals ?? {}) as Record<string, unknown>;
  const preferences = (value.preferences ?? {}) as Record<string, unknown>;

  return {
    id: PROFILE_ID,
    accountEmail: typeof value.accountEmail === 'string' ? value.accountEmail : null,
    lifestyle: {
      wakeTime: asTime(lifestyle.wakeTime, base.lifestyle.wakeTime),
      sleepTime: asTime(lifestyle.sleepTime, base.lifestyle.sleepTime),
      schedule: asString(lifestyle.schedule),
      activityLevel: ACTIVITY_LEVELS.includes(lifestyle.activityLevel as ActivityLevel)
        ? lifestyle.activityLevel as ActivityLevel
        : base.lifestyle.activityLevel,
      currentHabits: asString(lifestyle.currentHabits),
      timeSinks: asString(lifestyle.timeSinks),
    },
    goals: {
      items: normalizeGoals(goals.items),
      timeframe: asString(goals.timeframe, base.goals.timeframe),
      why: asString(goals.why),
    },
    challenges: asString(value.challenges),
    preferences: {
      reminderTime: asTime(preferences.reminderTime, ''),
      tone: TONES.includes(preferences.tone as CoachingTone)
        ? preferences.tone as CoachingTone
        : base.preferences.tone,
    },
    skipped: value.skipped === true,
    onboardedAt: typeof value.onboardedAt === 'number' ? value.onboardedAt : 0,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
    recommendations: null,
  };
}

/** Human summary for Settings; never throws on an empty profile. */
export function profileSummary(profile: Profile): string[] {
  const lines: string[] = [];
  const goals = profile.goals.items.filter(Boolean);
  if (goals.length) lines.push(`Goals: ${goals.join(', ')}`);
  const { wakeTime, sleepTime, schedule, activityLevel } = profile.lifestyle;
  lines.push(`Day: ${wakeTime}–${sleepTime}${schedule ? ` · ${schedule}` : ''} · ${activityLevel} activity`);
  if (profile.challenges.trim()) lines.push(`Hard before: ${profile.challenges.trim()}`);
  lines.push(`Coaching: ${profile.preferences.tone}${profile.preferences.reminderTime ? ` · reminder ${profile.preferences.reminderTime}` : ''}`);
  return lines;
}
