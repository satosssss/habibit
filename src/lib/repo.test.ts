import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { clampLegacyEntries, clearAll, deleteHabit, exportState, hasSeeded, importState, listHabits, loadDay, loadRange, markSeeded, newId, pruneOrphans, putEntry, putHabit, putHabits, resetToEmpty } from './repo';
import type { Entry, Habit } from './types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: Date.now(), ...over,
});

beforeEach(async () => { await clearAll(); });

describe('habits', () => {
  it('stores and lists habits', async () => {
    await putHabit(habit({ name: 'Read' }));
    await putHabit(habit({ name: 'Stretch' }));
    const list = await listHabits();
    expect(list.map((h) => h.name).sort()).toEqual(['Read', 'Stretch']);
  });

  it('upserts by id rather than duplicating', async () => {
    const h = habit();
    await putHabit(h);
    await putHabit({ ...h, name: 'Meditate 2.0' });
    expect(await listHabits()).toHaveLength(1);
    expect((await listHabits())[0].name).toBe('Meditate 2.0');
  });

  it('deletes a habit and all of its entries', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    await putEntry(h.id, '2026-09-21', 1);
    await deleteHabit(h.id);
    expect(await listHabits()).toHaveLength(0);
    expect(await loadDay('2026-09-20')).toHaveLength(0);
  });

  it('prunes entries left behind by a habit that no longer exists', async () => {
    await putEntry('ghost-habit', '2026-09-20', 1);
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    expect(await pruneOrphans()).toBe(1);
    expect(await loadDay('2026-09-20')).toHaveLength(1);   // the real habit's entry survives
  });

  it('writes a whole reorder as one bulk put (R3 — all or nothing)', async () => {
    const a = habit({ id: 'a', order: 0 });
    const b = habit({ id: 'b', order: 1 });
    await putHabit(a);
    await putHabit(b);
    const spy = vi.spyOn(db.habits, 'bulkPut');
    await putHabits([{ ...a, order: 1 }, { ...b, order: 0 }]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await listHabits()).find((h) => h.id === 'a')?.order).toBe(1);
  });
});

describe('entries', () => {
  it('keeps one row per habit and date (idempotent writes)', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    await putEntry(h.id, '2026-09-20', 0);
    const day = await loadDay('2026-09-20');
    expect(day).toHaveLength(1);
    expect(day[0].value).toBe(0);
  });

  // Spec R1 §2.1: the write boundary is the single choke point — every screen
  // writes through putEntry, so clamping here makes the invariant global.
  it('clamps written values into [0, target]', async () => {
    const h = habit({ type: 'quantity', target: 8 });
    await putHabit(h);
    await expect(putEntry(h.id, '2026-09-20', 11)).resolves.toMatchObject({ value: 8 });
    await putEntry(h.id, '2026-09-20', -3);
    expect((await loadDay('2026-09-20'))[0].value).toBe(0);
    await putEntry(h.id, '2026-09-20', Number.NaN);
    expect((await loadDay('2026-09-20'))[0].value).toBe(0);
  });

  it('floors only the value for entries whose habit is gone (prune removes them later)', async () => {
    await putEntry('ghost-habit', '2026-09-20', 5);
    expect((await loadDay('2026-09-20'))[0].value).toBe(5);
  });

  it('loadRange covers the inclusive bounds only', async () => {
    const h = habit();
    await putHabit(h);
    for (const date of ['2026-09-01', '2026-09-15', '2026-09-30', '2026-10-01'])
      await putEntry(h.id, date, 1);
    const rows = await loadRange('2026-09-15', '2026-09-30');
    expect(rows.map((r: Entry) => r.date)).toEqual(['2026-09-15', '2026-09-30']);
  });

  it('round-trips through export and import', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    const dump = await exportState();
    await clearAll();
    await importState(dump);
    expect(await listHabits()).toHaveLength(1);
    expect(await loadDay('2026-09-20')).toHaveLength(1);
  });

  // Task 14 review issue 5a: exact wipe → import round trip. The export never
  // contains the `__seed__` marker (§11), so pre- and post-import dumps must be
  // deep-equal, while the non-empty import still claims the marker for §11.
  it('restores an export exactly after a full wipe', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    await putEntry(h.id, '2026-09-21', 0);
    const dump = await exportState();
    await clearAll();
    expect(await hasSeeded()).toBe(false);
    await importState(dump);
    expect(await exportState()).toEqual(dump);
    expect(await hasSeeded()).toBe(true); // marker claimed by the import, still export-skipped
  });

  it('carries difficulty and reminderTime through export/import', async () => {
    const h = habit({ difficulty: 'hard', reminderTime: '07:30' });
    await putHabit(h);
    const dump = await exportState();
    await clearAll();
    await importState(dump);
    const [restored] = await listHabits();
    expect(restored.difficulty).toBe('hard');
    expect(restored.reminderTime).toBe('07:30');
  });

  // Import repair: invalid detail values degrade to absent, never reject the
  // file (repairHabit's "repair what is unambiguous" rule).
  it('drops invalid difficulty and reminder time on import instead of rejecting', async () => {
    const bad = { ...habit({ name: 'Bad details' }), difficulty: 'extreme', reminderTime: '25:99' };
    const good = habit({ name: 'Good details', difficulty: 'easy', reminderTime: '23:59' });
    await importState({ habits: [bad, good], entries: [] });
    const list = await listHabits();
    const b = list.find((x) => x.name === 'Bad details')!;
    const g = list.find((x) => x.name === 'Good details')!;
    expect(b.difficulty).toBeUndefined();
    expect(b.reminderTime).toBeUndefined();
    expect(g.difficulty).toBe('easy');
    expect(g.reminderTime).toBe('23:59');
  });

  // Task 14 review issue 2: both clears run in ONE transaction, so a write
  // failure between them can't leave 0 habits + orphaned entries (§11/§12).
  it('keeps both tables intact when a write fails mid-reset', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    const spy = vi.spyOn(db.entries, 'clear')
      .mockImplementationOnce(() => Promise.reject(new Error('injected failure')) as never);
    try {
      await expect(clearAll()).rejects.toThrow(/injected failure/);
    } finally {
      spy.mockRestore();
    }
    expect(await listHabits()).toHaveLength(1);     // habits rolled back…
    expect(await loadDay('2026-09-20')).toHaveLength(1); // …entries untouched
  });

  // reset spec R1 I3: the wipe and the marker write run in ONE transaction, so
  // a failure between them rolls back instead of leaving the crash-in-between
  // state (cleared data + marker-less = next boot re-seeds the demo set).
  it('rolls back the wipe and writes no marker when resetToEmpty fails mid-transaction', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    const spy = vi.spyOn(db.entries, 'clear')
      .mockImplementationOnce(() => Promise.reject(new Error('injected failure')) as never);
    try {
      await expect(resetToEmpty()).rejects.toThrow(/injected failure/);
    } finally {
      spy.mockRestore();
    }
    expect(await listHabits()).toHaveLength(1);          // habits rolled back
    expect(await loadDay('2026-09-20')).toHaveLength(1); // entries untouched
    expect(await hasSeeded()).toBe(false);               // marker never written
  });

  it('never exports the seed marker row', async () => {
    await markSeeded();
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    const dump = await exportState();
    expect(dump.entries.some((e) => e.id === '__seed__' || e.habitId === '__seed__')).toBe(false);
    expect(dump.habits.some((x) => x.id === '__seed__')).toBe(false);
    expect(dump.entries).toHaveLength(1); // real entries still export
  });

  it('rejects malformed import payloads', async () => {
    const h = habit();
    await putHabit(h);
    await expect(importState({ habits: 'nope', entries: [] })).rejects.toThrow(/Habibit export/);
    await expect(importState(null)).rejects.toThrow(/Habibit export/);
    // Habit-level structure failure now routes to the §8 "values" message
    // (spec R6, decision 7); payload/entry-row shape keeps the original one.
    await expect(importState({ habits: [{ bad: true }], entries: [] })).rejects.toThrow(/values we can't import/);
    expect(await listHabits()).toHaveLength(1); // untouched
  });
});

describe('import repair and rejection (spec R6)', () => {
  const rawHabit = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'x1', name: 'Drink Water', icon: 'droplet', color: '#6366f1', category: 'Health',
    intention: 'Be Grateful', type: 'quantity', target: 8, unit: 'cups',
    frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
  });
  const rawEntry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: `x1_2026-09-20`, habitId: 'x1', date: '2026-09-20', value: 4, timestamp: 0, ...over,
  });

  it('repairs cosmetic damage and clamps entries to the repaired target', async () => {
    await importState({
      habits: [rawHabit({
        name: '', icon: 'nope', color: 'red', category: '', intention: '',
        target: -5, frequency: [1, 9, 1, 'x'],
      })],
      entries: [
        rawEntry({ value: 99 }),                                            // over repaired target (1)
        rawEntry({ id: 'x1_2026-09-21', date: '2026-09-21', value: -3 }),
        rawEntry({ id: 'x1_2026-09-22', date: '2026-09-22', value: Number.NaN }),
        rawEntry({ id: 'x1_2026-09-23', date: '2026-09-23', value: Number.POSITIVE_INFINITY }),
        rawEntry({ id: 'x1_2026-09-24', date: '2026-09-24', value: '4' }), // non-number value → 0, never rejects (R6.2)
      ],
    });
    const [h] = await listHabits();
    expect(h).toMatchObject({
      name: 'Untitled habit', icon: 'target', color: '#6366f1',
      category: 'Other', intention: 'Other', target: 1,
    });
    expect(h.frequency).toEqual([1]);                      // ints 0–6, deduped, sorted
    expect((await loadDay('2026-09-20'))[0].value).toBe(1); // 99 → 1
    expect((await loadDay('2026-09-21'))[0].value).toBe(0);
    expect((await loadDay('2026-09-22'))[0].value).toBe(0);
    expect((await loadDay('2026-09-23'))[0].value).toBe(0);
    expect((await loadDay('2026-09-24'))[0].value).toBe(0); // '4' → 0
  });

  it('repairs targets per type (boolean → 1, quantity ≥ 1, timer ≥ 60)', async () => {
    await importState({
      habits: [
        rawHabit({ id: 'b', type: 'boolean', target: 99 }),
        rawHabit({ id: 'q', type: 'quantity', target: 0 }),
        rawHabit({ id: 't', type: 'timer', target: 5 }),
      ],
      entries: [],
    });
    const byId = Object.fromEntries((await listHabits()).map((h) => [h.id, h.target]));
    expect(byId).toEqual({ b: 1, q: 1, t: 60 });
  });

  it('rejects structurally unusable files without touching existing data', async () => {
    await putHabit(habit());
    const values = /values we can't import/;             // spec §8 copy (toThrow substring match)
    await expect(importState({ habits: [rawHabit({ frequency: [] })], entries: [] })).rejects.toThrow(values);
    await expect(importState({ habits: [rawHabit({ target: '8' })], entries: [] })).rejects.toThrow(values);
    await expect(importState({ habits: [rawHabit({ id: 42 })], entries: [] })).rejects.toThrow(values);
    expect(await listHabits()).toHaveLength(1);
  });

  it('keeps the original message for shape-broken payloads and rows', async () => {
    await expect(importState({ habits: 'nope', entries: [] })).rejects.toThrow(/Habibit export/);
    await expect(importState(null)).rejects.toThrow(/Habibit export/);
    // entry-row shape — DataPanel's pinned half-bad payload (habitId not a string)
    await expect(importState({
      habits: [rawHabit()],
      entries: [rawEntry({ habitId: 42 })],
    })).rejects.toThrow(/Habibit export/);
  });
});

describe('boot migration clampLegacyEntries (spec R1 §2.3)', () => {
  it('rewrites over-target, negative, and non-finite stored values once', async () => {
    const h = habit({ type: 'quantity', target: 8 });
    await putHabit(h);
    await db.entries.put({ id: `${h.id}_2026-09-20`, habitId: h.id, date: '2026-09-20', value: 11, timestamp: 0 });
    await db.entries.put({ id: `${h.id}_2026-09-21`, habitId: h.id, date: '2026-09-21', value: -4, timestamp: 0 });
    await db.entries.put({ id: `${h.id}_2026-09-22`, habitId: h.id, date: '2026-09-22', value: Number.NaN, timestamp: 0 });
    expect(await clampLegacyEntries()).toBe(3);
    expect((await loadDay('2026-09-20'))[0].value).toBe(8);
    expect((await loadDay('2026-09-21'))[0].value).toBe(0);
    expect((await loadDay('2026-09-22'))[0].value).toBe(0);
    expect(await clampLegacyEntries()).toBe(0);            // idempotent
  });

  it('never touches the seed marker or orphan entries', async () => {
    await markSeeded();
    await putEntry('ghost-habit', '2026-09-20', 5);
    expect(await clampLegacyEntries()).toBe(0);
    expect((await loadDay('2026-09-20'))[0].value).toBe(5);
    expect(await hasSeeded()).toBe(true);
  });
});
