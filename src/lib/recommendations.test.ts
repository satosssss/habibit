import { describe, expect, it } from 'vitest';
import {
  MAX_SUGGESTIONS, REGENERATE_AFTER_DAYS, cacheSuggestions, categoryForTime, historyWindow,
  normalizeSuggestions, recommendationsStale, suggestionToHabit,
} from './recommendations';
import type { HabitSuggestion, RecommendationCache } from './types';

const suggestion = (over: Partial<HabitSuggestion> = {}): HabitSuggestion => ({
  id: 's1', name: 'Walk after lunch', reason: 'You sit all afternoon.',
  suggestedTime: '13:00', firstStep: 'Five minutes outside.', ...over,
});

describe('normalizeSuggestions (spec R5)', () => {
  it('trims, drops empties, dedupes case-insensitively and caps at five', () => {
    const raw = [
      { name: '  Walk  ', reason: ' r ', suggestedTime: '13:00', firstStep: ' f ' },
      { name: 'walk' },
      { name: '' },
      'not an object',
      null,
      { name: 'Two' }, { name: 'Three' }, { name: 'Four' }, { name: 'Five' }, { name: 'Six' },
    ];
    const out = normalizeSuggestions(raw);
    expect(out).toHaveLength(MAX_SUGGESTIONS);
    expect(out[0]).toMatchObject({ name: 'Walk', reason: 'r', suggestedTime: '13:00', firstStep: 'f' });
    expect(out.map((s) => s.name)).toEqual(['Walk', 'Two', 'Three', 'Four', 'Five']);
    expect(new Set(out.map((s) => s.id)).size).toBe(out.length);
  });

  it('drops invalid times and rejects non-arrays', () => {
    const [item] = normalizeSuggestions([{ name: 'Read', suggestedTime: '25:00' }]);
    expect(item.suggestedTime).toBe('');
    expect(normalizeSuggestions({ suggestions: [] })).toEqual([]);
    expect(normalizeSuggestions(null)).toEqual([]);
  });
});

describe('recommendationsStale (spec R4)', () => {
  const cache = (over: Partial<RecommendationCache> = {}): RecommendationCache => ({
    generatedAt: 1_000, dataThrough: '2026-11-01', source: 'server',
    suggestions: [suggestion()], ...over,
  });

  it('is stale with no cache or no suggestions', () => {
    expect(recommendationsStale({ cache: null, profileUpdatedAt: 0, latestEntryDate: null })).toBe(true);
    expect(recommendationsStale({
      cache: cache({ suggestions: [] }), profileUpdatedAt: 0, latestEntryDate: null,
    })).toBe(true);
  });

  it('is stale when the profile changed after generation', () => {
    expect(recommendationsStale({
      cache: cache(), profileUpdatedAt: 2_000, latestEntryDate: null,
    })).toBe(true);
    expect(recommendationsStale({
      cache: cache(), profileUpdatedAt: 500, latestEntryDate: null,
    })).toBe(false);
  });

  it(`is stale after ${REGENERATE_AFTER_DAYS} days of new entries, not before`, () => {
    expect(recommendationsStale({
      cache: cache({ dataThrough: '2026-11-01' }), profileUpdatedAt: 0, latestEntryDate: '2026-11-07',
    })).toBe(false);
    expect(recommendationsStale({
      cache: cache({ dataThrough: '2026-11-01' }), profileUpdatedAt: 0, latestEntryDate: '2026-11-08',
    })).toBe(true);
  });

  it('treats a missing dataThrough as stale when entries exist', () => {
    expect(recommendationsStale({
      cache: cache({ dataThrough: '' }), profileUpdatedAt: 0, latestEntryDate: '2026-11-02',
    })).toBe(true);
  });
});

describe('cacheSuggestions', () => {
  it('caps at five and records the source and window end', () => {
    const many = Array.from({ length: 7 }, (_, i) => suggestion({ id: `s${i}`, name: `H${i}` }));
    const built = cacheSuggestions(many, 'on-device', '2026-11-05', 42);
    expect(built.suggestions).toHaveLength(MAX_SUGGESTIONS);
    expect(built).toMatchObject({ generatedAt: 42, dataThrough: '2026-11-05', source: 'on-device' });
  });
});

describe('suggestionToHabit (spec R4)', () => {
  it('produces an ordinary habit in the matching category', () => {
    const habit = suggestionToHabit(suggestion(), 1_700_000_000_000);
    expect(habit.name).toBe('Walk after lunch');
    expect(habit.type).toBe('boolean');
    expect(habit.category).toBe('Afternoon');
    expect(habit.reminderTime).toBe('13:00');
    expect(habit.frequency).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(habit.icon).toEqual(expect.any(String));
    expect(habit.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('maps times to categories and defaults to morning', () => {
    expect(categoryForTime('07:30')).toBe('Morning');
    expect(categoryForTime('12:00')).toBe('Afternoon');
    expect(categoryForTime('18:15')).toBe('Evening');
    expect(categoryForTime('')).toBe('Morning');
  });
});

describe('historyWindow', () => {
  it('returns a 14-day inclusive window ending today', () => {
    expect(historyWindow('2026-11-05')).toEqual({ from: '2026-10-23', to: '2026-11-05' });
  });
});
