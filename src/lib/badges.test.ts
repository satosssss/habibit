import { describe, expect, it } from 'vitest';
import { BADGES, badgeById, badgeSnapshot, badgeValue, earnedBadgeIds } from './badges';
import type { Challenge, Entry, Habit } from './types';

const TODAY = '2026-10-21'; // a Wednesday, fixed so tests never read the clock

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: 0, ...over,
});

const entry = (date: string, habitId = 'h1'): Entry => ({
  id: `${habitId}_${date}`, habitId, date, value: 1,
  timestamp: Date.parse(`${date}T12:00:00`),
});

const daysBack = (n: number): string => {
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const won = (type: Challenge['type']): Challenge => ({
  id: `c-${type}`, type, scopeLabel: 'x', status: 'won', startedAt: 0, resultAt: 1,
});

const snap = (over: Partial<Parameters<typeof badgeValue>[1]> = {}) => ({
  streak: 0, perfect: 0, completions: 0, wins: new Set<Challenge['type']>(), ...over,
});

describe('badge catalog', () => {
  it('has unique ids and the 16 spec badges', () => {
    expect(BADGES).toHaveLength(16);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(badgeById('streak-7')?.title).toBe('One Week Strong');
    expect(badgeById('nope')).toBeNull();
  });

  it('uses only the four documented kinds', () => {
    for (const b of BADGES) expect(['streak', 'perfect', 'completions', 'challenge']).toContain(b.kind);
  });
});

describe('badgeValue thresholds', () => {
  it('awards a streak badge at the threshold, not below', () => {
    const def = badgeById('streak-7')!;
    expect(badgeValue(def, snap({ streak: 6 }))).toBe(6);
    expect(badgeValue(def, snap({ streak: 7 }))).toBe(7);
    expect(earnedBadgeIds(snap({ streak: 6 }))).not.toContain('streak-7');
    expect(earnedBadgeIds(snap({ streak: 7 }))).toContain('streak-7');
  });

  it('awards perfect/completion badges independently', () => {
    const ids = earnedBadgeIds(snap({ perfect: 7, completions: 100 }));
    expect(ids).toEqual(expect.arrayContaining([
      'perfect-1', 'perfect-7', 'completions-1', 'completions-10',
      'completions-50', 'completions-100',
    ]));
    expect(ids).not.toContain('perfect-30');
    expect(ids).not.toContain('completions-365');
  });

  it('awards one badge per won challenge type only', () => {
    const ids = earnedBadgeIds(snap({ wins: new Set<Challenge['type']>(['weekend']) }));
    expect(ids).toEqual(['challenge-weekend']);
  });
});

describe('badgeSnapshot', () => {
  it('returns zeros without habits (no all-time walk)', () => {
    expect(badgeSnapshot({ habits: [], entries: [], challenges: [], today: TODAY }))
      .toEqual({ streak: 0, perfect: 0, completions: 0, wins: new Set() });
  });

  it('reads the same all-time numbers as Insights', () => {
    const h = habit();
    const entries = [0, 1, 2].map((n) => entry(daysBack(n)));
    const s = badgeSnapshot({ habits: [h], entries, challenges: [], today: TODAY });
    expect(s).toMatchObject({ streak: 3, perfect: 3, completions: 3 });
    const ids = earnedBadgeIds(s);
    expect(ids).toEqual(expect.arrayContaining(['streak-3', 'perfect-1', 'completions-1']));
    expect(ids).not.toContain('streak-7');
  });

  it('keeps a past longest streak after it breaks', () => {
    const h = habit();
    // A 7-day run ending 10 days ago, plus today alone: longest is still 7.
    const run = Array.from({ length: 7 }, (_, i) => entry(daysBack(i + 10)));
    const entries = [...run, entry(TODAY)];
    const s = badgeSnapshot({ habits: [h], entries, challenges: [], today: TODAY });
    expect(s.streak).toBe(7);
    expect(earnedBadgeIds(s)).toContain('streak-7');
  });

  it('counts terminal won challenges and ignores active/failed', () => {
    const s = badgeSnapshot({
      habits: [habit()], entries: [], today: TODAY,
      challenges: [won('streak7'), { ...won('weekend'), status: 'failed' }, { ...won('category7'), status: 'active' }],
    });
    expect([...s.wins]).toEqual(['streak7']);
  });
});
