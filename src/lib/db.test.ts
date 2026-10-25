import Dexie, { type Table } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { HabibitDexie } from './db';
import type { Entry, Habit } from './types';

// Spec §1 (challenges): the v1 → v2 upgrade is a pure delta — v1 tables keep
// their schema and every v1 row, and the new `challenges` store is created
// empty. This exercises a REAL upgrade against a throwaway database name,
// never the app's main instance (a fresh HabibitDexie here, not the db.ts
// singleton — the singleton's name must stay untouched by tests).
class V1HabibitDexie extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      habits: 'id, name, category, intention, type, order, createdAt',
      entries: 'id, habitId, date, value, timestamp, [habitId+date]',
    });
  }
}

const habitFactory = (): Habit => ({
  id: 'h1', name: 'Read', icon: 'target', color: '#6366f1',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [1, 2, 3], order: 0,
  createdAt: Date.parse('2026-09-01T08:00:00'),
});

const entryFactory = (): Entry => ({
  id: 'h1_2026-09-20', habitId: 'h1', date: '2026-09-20', value: 1,
  timestamp: Date.parse('2026-09-20T12:00:00'),
});

const opened: string[] = [];
const indexSources = (table: { schema: { indexes: Array<{ src: string }> } }): string[] =>
  table.schema.indexes.map((i) => i.src);

describe('HabibitDexie v1 → v2 migration (spec line 144)', () => {
  afterEach(async () => {
    for (const name of opened.splice(0)) {
      await Dexie.delete(name);
    }
  });

  it('creates the challenges store and preserves every v1 row and v1 store structure', async () => {
    // 1) A v1-era database: habits + entries only, no version(2), no challenges.
    const name = `habibit-migration-test-${Date.now()}-${opened.length + 1}`;
    const v1 = new V1HabibitDexie(name);
    opened.push(name);
    await v1.open();
    const v1Habit = habitFactory();
    const v1Entry = entryFactory();
    await v1.habits.put(v1Habit);
    await v1.entries.put(v1Entry);
    const v1HabitIndexes = indexSources(v1.habits);
    const v1EntryIndexes = indexSources(v1.entries);
    v1.close();

    // 2) Reopen the SAME name with the full (v1 + v2) schema → Dexie upgrades.
    const upgraded = new HabibitDexie(name);
    await upgraded.open();
    expect(await upgraded.habits.count()).toBe(1);            // v1 habit survives
    expect(await upgraded.entries.count()).toBe(1);           // v1 entry survives
    expect(await upgraded.habits.get('h1')).toEqual(v1Habit); // fields intact
    expect(await upgraded.entries.get('h1_2026-09-20')).toEqual(v1Entry);

    // 3) v2 delta: the challenges store exists and starts empty.
    expect(await upgraded.challenges.count()).toBe(0);

    // 4) v1 structure unchanged — exactly the v1 index set, nothing added/removed.
    expect(indexSources(upgraded.habits)).toEqual(v1HabitIndexes);
    expect(indexSources(upgraded.entries)).toEqual(v1EntryIndexes);
  });
});
