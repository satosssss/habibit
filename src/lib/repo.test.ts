import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, deleteHabit, exportState, importState, listHabits, loadDay, loadRange, markSeeded, newId, pruneOrphans, putEntry, putHabit } from './repo';
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
    await expect(importState({ habits: [{ bad: true }], entries: [] })).rejects.toThrow(/Habibit export/);
    expect(await listHabits()).toHaveLength(1); // untouched
  });
});
