import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_LEVELS, PROFILE_ID, TONES, emptyProfile, isTimeKey, mergeProfile, normalizeGoals,
  normalizeProfile, profileSummary,
} from './profile';
import { cacheSuggestions } from './recommendations';

const NOW = Date.parse('2026-11-05T09:00:00Z');

describe('emptyProfile (account spec R2)', () => {
  it('is the single source of defaults and has no undefined fields', () => {
    const profile = emptyProfile(NOW);
    expect(profile.id).toBe(PROFILE_ID);
    expect(profile.accountEmail).toBeNull();
    expect(profile.lifestyle.activityLevel).toBe('moderate');
    expect(profile.goals.items).toEqual(['']);
    expect(profile.preferences.tone).toBe('gentle');
    expect(profile.skipped).toBe(false);
    expect(profile.onboardedAt).toBe(0);
    expect(profile.updatedAt).toBe(NOW);
    expect(profile.recommendations).toBeNull();
  });

  it('exposes the enums the form renders', () => {
    expect(ACTIVITY_LEVELS).toEqual(['low', 'moderate', 'high']);
    expect(TONES).toEqual(['gentle', 'direct']);
  });
});

describe('mergeProfile (account spec R2)', () => {
  it('deep-merges a patch and stamps updatedAt', () => {
    const base = emptyProfile(NOW);
    const next = mergeProfile(base, {
      lifestyle: { wakeTime: '06:30', schedule: 'Office 9–5' },
      goals: { items: ['Run a 5k', '  ', 'Read more'] },
      preferences: { tone: 'direct' },
    }, NOW + 1_000);

    expect(next.lifestyle.wakeTime).toBe('06:30');
    expect(next.lifestyle.sleepTime).toBe('23:00');       // untouched default
    expect(next.lifestyle.schedule).toBe('Office 9–5');
    expect(next.goals.items).toEqual(['Run a 5k', 'Read more']);
    expect(next.preferences.tone).toBe('direct');
    expect(next.updatedAt).toBe(NOW + 1_000);
  });

  it('clears cached recommendations only when an answer changed', () => {
    const base = mergeProfile(emptyProfile(NOW), {
      goals: { items: ['Move daily'] },
      preferences: { tone: 'direct' },
    }, NOW);
    base.recommendations = cacheSuggestions([], 'server', '2026-11-01', NOW);

    const accountOnly = mergeProfile(base, { accountEmail: 'a@example.com' }, NOW + 1);
    expect(accountOnly.recommendations).not.toBeNull();

    const answerChange = mergeProfile(base, { challenges: 'No time' }, NOW + 1);
    expect(answerChange.recommendations).toBeNull();
  });

  it('never changes the row id', () => {
    const next = mergeProfile(emptyProfile(NOW), { id: 'other' } as never, NOW);
    expect(next.id).toBe(PROFILE_ID);
  });
});

describe('normalizeGoals', () => {
  it('trims, drops blanks, keeps order and caps at three', () => {
    expect(normalizeGoals([' a ', '', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(normalizeGoals('nope')).toEqual([]);
    expect(normalizeGoals([1, 'ok'])).toEqual(['ok']);
  });
});

describe('normalizeProfile (import)', () => {
  it('repairs a partial profile instead of throwing', () => {
    const profile = normalizeProfile({
      accountEmail: 'a@example.com',
      lifestyle: { wakeTime: '25:00', activityLevel: 'extreme' },
      goals: { items: ['One goal'] },
      preferences: { tone: 'shouty' },
      skipped: true,
    }, NOW);
    expect(profile).not.toBeNull();
    expect(profile!.lifestyle.wakeTime).toBe('07:00');       // invalid time → default
    expect(profile!.lifestyle.activityLevel).toBe('moderate');
    expect(profile!.preferences.tone).toBe('gentle');
    expect(profile!.goals.items).toEqual(['One goal']);
    expect(profile!.skipped).toBe(true);
  });

  it('returns null for non-objects', () => {
    expect(normalizeProfile(null)).toBeNull();
    expect(normalizeProfile('profile')).toBeNull();
  });
});

describe('isTimeKey', () => {
  it('accepts 24h times only', () => {
    expect(isTimeKey('07:05')).toBe(true);
    expect(isTimeKey('23:59')).toBe(true);
    expect(isTimeKey('24:00')).toBe(false);
    expect(isTimeKey('7:05')).toBe(false);
  });
});

describe('profileSummary', () => {
  it('never throws on an empty profile and mentions the tone', () => {
    const lines = profileSummary(emptyProfile(NOW));
    expect(lines.some((line) => line.startsWith('Day:'))).toBe(true);
    expect(lines.join(' ')).toContain('gentle');
  });

  it('lists goals and challenges when present', () => {
    const profile = mergeProfile(emptyProfile(NOW), {
      goals: { items: ['Sleep better', 'Move daily'] },
      challenges: 'No time',
    });
    const text = profileSummary(profile).join(' | ');
    expect(text).toContain('Goals: Sleep better, Move daily');
    expect(text).toContain('Hard before: No time');
  });
});
