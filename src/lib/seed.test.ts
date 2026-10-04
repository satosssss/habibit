import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, countHabits, deleteHabit, exportState, hasSeeded, importState, listHabits, loadDay, putHabit, resetToEmpty } from './repo';
import { buildDayStats, countActiveDays, currentStreak } from './stats';
import { addDays, todayKey, weekdayIndex } from './dates';
import { generateSeedEntries, seedIfEmpty, SEED_HABITS } from './seed';
import type { Entry } from './types';

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

  it('pins every timestamp to UTC midnight of its date key', () => {
    const entries = generateSeedEntries(SEED_HABITS, anchor);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries)
      expect(entry.timestamp).toBe(Date.parse(`${entry.date}T00:00:00Z`));
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
  }, 15_000);   // A2 env hardening: the seed + cascade-delete + recheck chain
                // misses the 5s default under full-parallel suite contention
                // (passes in isolation/serial; assertions unchanged).

  it('claims marker-less existing habits without adding seed data', async () => {
    await putHabit({ ...SEED_HABITS[0] });   // e.g. an imported payload with no marker row
    expect(await hasSeeded()).toBe(false);
    expect(await seedIfEmpty()).toBe(false);
    expect(await countHabits()).toBe(1);
    expect(await loadDay(todayKey())).toHaveLength(0); // no seed entries were added
    expect(await hasSeeded()).toBe(true);
  });

  // Task 14 review issue 3 / Review Focus #4: a non-empty import must claim the
  // marker inside its own transaction, so import → delete-all → reload can't
  // resurrect the seed habits ("never resurrects after habits are deleted", §11).
  it('never resurrects after a non-empty import followed by delete-all', async () => {
    await importState({ habits: [SEED_HABITS[0]], entries: [] });
    expect(await hasSeeded()).toBe(true); // import claimed the marker it wiped
    for (const h of await listHabits()) await deleteHabit(h.id);
    expect(await countHabits()).toBe(0);
    expect(await seedIfEmpty()).toBe(false);
    expect(await countHabits()).toBe(0);   // no seed data came back
  });

  // Mirror image (spec §11): an empty payload leaves the marker absent, so the
  // database behaves as a fresh install and re-seeds on the next load.
  it('treats an empty import as a fresh install', async () => {
    expect(await seedIfEmpty()).toBe(true);
    await importState({ habits: [], entries: [] });
    expect(await hasSeeded()).toBe(false);
    expect(await seedIfEmpty()).toBe(true);
    expect(await countHabits()).toBe(8);
  });

  // Fresh-install determinism (§11): a marker-less database (clearAll is how
  // tests simulate one) must reproduce the exact dataset — same PRNG, ids and
  // values. The Reset button no longer re-seeds; see resetToEmpty.
  it('re-seeds a byte-identical dataset on a marker-less database', async () => {
    expect(await seedIfEmpty()).toBe(true);
    const first = await exportState();
    await clearAll();                       // Reset: data + marker cleared
    expect(await seedIfEmpty()).toBe(true);
    const second = await exportState();
    expect(second).toEqual(first);

    const byId = (a: Entry, b: Entry) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    expect([...second.entries].sort(byId)).toEqual(
      generateSeedEntries(SEED_HABITS, todayKey()).sort(byId),   // Task 4 generator
    );
    expect(second.habits.map((h) => h.id).sort())
      .toEqual(SEED_HABITS.map((h) => h.id).sort());
  });

  // Spec reset-to-empty R1 I1–I3: Reset wipes AND writes the seed marker in one
  // transaction, so the next boot's seedIfEmpty() must not resurrect demo data.
  it('a reset leaves the app empty across reloads', async () => {
    expect(await seedIfEmpty()).toBe(true);      // start from a seeded install
    await resetToEmpty();
    expect(await countHabits()).toBe(0);         // I1 — empty now
    expect(await hasSeeded()).toBe(true);        // I2 — marker written
    expect(await seedIfEmpty()).toBe(false);     // simulated reboot
    expect(await countHabits()).toBe(0);         // still empty
  });
});
