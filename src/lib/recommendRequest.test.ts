import { describe, expect, it } from 'vitest';
import { MAX_ARRAY, MAX_HABIT_NAME, MAX_TEXT, parseRecommendRequest } from './recommendRequest';

const valid = {
  profile: {
    lifestyle: {
      wakeTime: '06:30', sleepTime: '22:00', schedule: 'Office 9–5',
      activityLevel: 'high', currentHabits: 'coffee', timeSinks: 'phone',
    },
    goals: { items: ['Move daily'], timeframe: '3 months', why: 'Energy' },
    challenges: 'No time',
    preferences: { reminderTime: '08:00', tone: 'direct' },
  },
  history: { activeDays: 4, completions: 9, ratePct: 40, habitNames: ['Walk'] },
};

describe('parseRecommendRequest (spec R6)', () => {
  it('accepts a well-formed body', () => {
    const parsed = parseRecommendRequest(valid);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.profile.lifestyle.wakeTime).toBe('06:30');
    expect(parsed.value.profile.preferences.tone).toBe('direct');
    expect(parsed.value.history).toEqual(valid.history);
  });

  it('rejects a body that is not an object or has no profile', () => {
    expect(parseRecommendRequest(null).ok).toBe(false);
    expect(parseRecommendRequest('nope').ok).toBe(false);
    expect(parseRecommendRequest({}).ok).toBe(false);
    expect(parseRecommendRequest({ profile: 'x' }).ok).toBe(false);
  });

  it('rejects malformed nested groups and a non-array goal list', () => {
    const base = structuredClone(valid);
    expect(parseRecommendRequest({ profile: { ...base.profile, lifestyle: 3 } }).ok).toBe(false);
    expect(parseRecommendRequest({ profile: { ...base.profile, goals: { items: 'goal' } } }).ok).toBe(false);
    expect(parseRecommendRequest({ profile: { ...base.profile, preferences: [] } }).ok).toBe(false);
  });

  it('caps long text and habit names', () => {
    const parsed = parseRecommendRequest({
      profile: {
        ...valid.profile,
        challenges: 'x'.repeat(MAX_TEXT + 500),
        goals: { items: Array.from({ length: 12 }, (_, i) => `goal ${i}`) },
      },
      history: {
        ...valid.history,
        completions: 9e9,
        ratePct: 400,
        habitNames: Array.from({ length: 20 }, () => 'n'.repeat(MAX_HABIT_NAME + 10)),
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.profile.challenges).toHaveLength(MAX_TEXT);
    expect(parsed.value.profile.goals.items).toHaveLength(3);   // normalizeGoals caps at 3
    expect(parsed.value.history.completions).toBeLessThanOrEqual(100_000);
    expect(parsed.value.history.ratePct).toBe(100);
    expect(parsed.value.history.habitNames).toHaveLength(MAX_ARRAY);
    expect(parsed.value.history.habitNames[0]).toHaveLength(MAX_HABIT_NAME);
  });

  it('repairs bad times and enums with defaults instead of failing', () => {
    const parsed = parseRecommendRequest({
      profile: {
        lifestyle: { wakeTime: '99:99', activityLevel: 'extreme' },
        goals: { items: ['ok'] },
        preferences: { reminderTime: 'nope', tone: 'loud' },
      },
      history: { activeDays: -3, completions: 'many', ratePct: Number.NaN, habitNames: [1, ' ok '] },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.profile.lifestyle.wakeTime).toBe('07:00');
    expect(parsed.value.profile.lifestyle.activityLevel).toBe('moderate');
    expect(parsed.value.profile.preferences).toEqual({ reminderTime: '', tone: 'gentle' });
    expect(parsed.value.history).toEqual({ activeDays: 0, completions: 0, ratePct: 0, habitNames: ['ok'] });
  });
});
