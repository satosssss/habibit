import Dexie, { type Table } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { HabibitDexie } from './db';
import type { Challenge, Entry, Habit } from './types';

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

/** A v2-era database: challenges exist, badges do not. */
class V2HabibitDexie extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;
  challenges!: Table<Challenge, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      habits: 'id, name, category, intention, type, order, createdAt',
      entries: 'id, habitId, date, value, timestamp, [habitId+date]',
    });
    this.version(2).stores({
      challenges: 'id, type, status, [type+status], startedAt',
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

describe('HabibitDexie v2 → v3 migration (badges spec R3)', () => {
  afterEach(async () => {
    for (const name of opened.splice(0)) {
      await Dexie.delete(name);
    }
  });

  it('creates the badges store, keeps v1/v2 rows, and accepts badge writes', async () => {
    const name = `habibit-badges-migration-test-${Date.now()}-${opened.length + 1}`;
    const v2 = new V2HabibitDexie(name);
    opened.push(name);
    await v2.open();
    const v2Habit = habitFactory();
    const v2Entry = entryFactory();
    const v2Challenge: Challenge = {
      id: 'c1', type: 'weekend', scopeLabel: 'Weekend', status: 'won',
      startedAt: Date.parse('2026-09-19T08:00:00'),
      resultAt: Date.parse('2026-09-21T20:00:00'),
    };
    await v2.habits.put(v2Habit);
    await v2.entries.put(v2Entry);
    await v2.challenges.put(v2Challenge);
    const v2HabitIndexes = indexSources(v2.habits);
    const v2EntryIndexes = indexSources(v2.entries);
    const v2ChallengeIndexes = indexSources(v2.challenges);
    v2.close();

    const upgraded = new HabibitDexie(name);
    await upgraded.open();

    // Existing data survives the upgrade untouched.
    expect(await upgraded.habits.get('h1')).toEqual(v2Habit);
    expect(await upgraded.entries.get('h1_2026-09-20')).toEqual(v2Entry);
    expect(await upgraded.challenges.get('c1')).toEqual(v2Challenge);

    // v3 delta: empty badges store, primary key `id`, secondary index `earnedAt`.
    expect(await upgraded.badges.count()).toBe(0);
    expect(upgraded.badges.schema.primKey.keyPath).toBe('id');
    expect(indexSources(upgraded.badges)).toEqual(['earnedAt']);

    // ...and it is writable through the new version.
    await upgraded.badges.put({ id: 'streak-3', earnedAt: 1 });
    expect(await upgraded.badges.get('streak-3')).toEqual({ id: 'streak-3', earnedAt: 1 });

    // v1/v2 structure unchanged.
    expect(indexSources(upgraded.habits)).toEqual(v2HabitIndexes);
    expect(indexSources(upgraded.entries)).toEqual(v2EntryIndexes);
    expect(indexSources(upgraded.challenges)).toEqual(v2ChallengeIndexes);
  });
});

/** A v3-era database: badges exist, the profile store does not. */
class V3HabibitDexie extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;
  challenges!: Table<Challenge, string>;
  badges!: Table<{ id: string; earnedAt: number }, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      habits: 'id, name, category, intention, type, order, createdAt',
      entries: 'id, habitId, date, value, timestamp, [habitId+date]',
    });
    this.version(2).stores({ challenges: 'id, type, status, [type+status], startedAt' });
    this.version(3).stores({ badges: 'id, earnedAt' });
  }
}

describe('HabibitDexie v3 → v4 migration (accounts spec R2)', () => {
  afterEach(async () => {
    for (const name of opened.splice(0)) {
      await Dexie.delete(name);
    }
  });

  it('creates the profile store, keeps every v1–v3 row, and accepts the me row', async () => {
    const name = `habibit-profile-migration-test-${Date.now()}-${opened.length + 1}`;
    const v3 = new V3HabibitDexie(name);
    opened.push(name);
    await v3.open();
    const v3Habit = habitFactory();
    const v3Entry = entryFactory();
    await v3.habits.put(v3Habit);
    await v3.entries.put(v3Entry);
    await v3.badges.put({ id: 'streak-3', earnedAt: 1 });
    const v3HabitIndexes = indexSources(v3.habits);
    const v3EntryIndexes = indexSources(v3.entries);
    v3.close();

    const upgraded = new HabibitDexie(name);
    await upgraded.open();

    expect(await upgraded.habits.get('h1')).toEqual(v3Habit);
    expect(await upgraded.entries.get('h1_2026-09-20')).toEqual(v3Entry);
    expect(await upgraded.badges.get('streak-3')).toEqual({ id: 'streak-3', earnedAt: 1 });

    // v4 delta: empty profile store keyed by `id`, no secondary indexes.
    expect(await upgraded.profile.count()).toBe(0);
    expect(upgraded.profile.schema.primKey.keyPath).toBe('id');
    expect(indexSources(upgraded.profile)).toEqual([]);

    await upgraded.profile.put({
      id: 'me', accountEmail: null,
      lifestyle: {
        wakeTime: '07:00', sleepTime: '23:00', schedule: '', activityLevel: 'moderate',
        currentHabits: '', timeSinks: '',
      },
      goals: { items: [''], timeframe: '3 months', why: '' },
      challenges: '', preferences: { reminderTime: '', tone: 'gentle' },
      skipped: false, onboardedAt: 0, updatedAt: 1, recommendations: null,
    });
    expect((await upgraded.profile.get('me'))?.id).toBe('me');

    expect(indexSources(upgraded.habits)).toEqual(v3HabitIndexes);
    expect(indexSources(upgraded.entries)).toEqual(v3EntryIndexes);
  });
});
