import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, countHabits, deleteHabit, listHabits, loadDay } from './repo';
import { buildDayStats, countActiveDays, currentStreak } from './stats';
import { addDays, todayKey, weekdayIndex } from './dates';
import { generateSeedEntries, seedIfEmpty, SEED_HABITS } from './seed';

describe('seed habits', () => {
  it('contains 8 habits spanning 3 categories and 4 intentions', () => {
    expect(SEED_HABITS).toHaveLength(8);
    expect(new Set(SEED_HABITS.map((h) => h.category))).toEqual(new Set(['Morning', 'Health', 'Evening']));
    expect(new Set(SEED_HABITS.map((h) => h.intention)).size).toBe(4);
    expect(SEED_HABITS.map((h) => h.id)).toHaveLength(new Set(SEED_HABITS.map((h) => h.id)).size);
  });

  it('covers all three habit types', () => {
    expect(new Set(SEED_HABITS.map((h) => h.type))).toEqual(new Set(['boolean', 'quantity', 'timer']));
  });
});

describe('generateSeedEntries', () => {
  const anchor = '2026-09-23';

  it('is deterministic for the same anchor', () => {
    expect(generateSeedEntries(SEED_HABITS, anchor)).toEqual(generateSeedEntries(SEED_HABITS, anchor));
  });

  it('differs for a different anchor', () => {
    expect(generateSeedEntries(SEED_HABITS, anchor)).not.toEqual(
      generateSeedEntries(SEED_HABITS, addDays(anchor, 1))
    );
  });

  it('spans exactly 13 weeks and never lands in the future', () => {
    const entries = generateSeedEntries(SEED_HABITS, anchor);
    const dates = [...new Set(entries.map((e) => e.date))].sort();
    expect(dates[0]).toBe(addDays(anchor, -(13 * 7 - 1)));
    expect(dates.at(-1)).toBe(anchor);
    expect(dates.length).toBeGreaterThanOrEqual(80);
    expect(entries.every((e) => e.date <= anchor)).toBe(true);
  });

  it('never writes an entry for an unscheduled habit', () => {
    const weekdayOnly = SEED_HABITS.map((h) => ({ ...h, name: 'Weekday only', frequency: [1, 2, 3, 4, 5] }));
    const entries = generateSeedEntries(weekdayOnly, anchor);
    for (const entry of entries) expect([0, 6]).not.toContain(entry.date && weekdayIndex(entry.date));
  });

  it('keeps the current streak alive and the perfect-day rate plausible', () => {
    const entries = generateSeedEntries(SEED_HABITS, anchor);
    const stats = buildDayStats(SEED_HABITS, entries, { from: addDays(anchor, -90), to: anchor });
    expect(stats.size).toBe(91);
    expect(currentStreak(stats, anchor)).toBeGreaterThanOrEqual(8);
    const active = countActiveDays(stats);
    expect(active / stats.size).toBeGreaterThan(0.7);
    const perfect = [...stats.values()].filter((s) => s.perfect).length;
    expect(perfect / stats.size).toBeGreaterThan(0.05);
    expect(perfect / stats.size).toBeLessThan(0.3);
  });
});

describe('seedIfEmpty', () => {
  beforeEach(async () => { await clearAll(); });

  it('seeds exactly once', async () => {
    expect(await seedIfEmpty()).toBe(true);
    const first = await loadDay(todayKey());
    expect(await countHabits()).toBe(8);
    expect(await seedIfEmpty()).toBe(false);
    expect(await loadDay(todayKey())).toHaveLength(first.length); // no duplicates
  });

  it('does not re-seed once the user has deleted every habit', async () => {
    await seedIfEmpty();
    for (const h of await listHabits()) await deleteHabit(h.id);
    expect(await seedIfEmpty()).toBe(false);
    expect(await countHabits()).toBe(0);
  });
});
