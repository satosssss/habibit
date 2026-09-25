import Dexie, { type Table } from 'dexie';
import type { Entry, Habit } from './types';

export class HabibitDexie extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;

  constructor(name = 'habibit') {
    super(name);
    this.version(1).stores({
      habits: 'id, name, category, intention, type, order, createdAt',
      entries: 'id, habitId, date, value, timestamp, [habitId+date]',
    });
  }
}

/** Live module binding — reassigned by ensureDb() if IndexedDB is unavailable. */
export let db = new HabibitDexie('habibit');

export type DbStatus = 'ok' | 'degraded';
let openPromise: Promise<DbStatus> | null = null;

/**
 * Opens IndexedDB. When it is unavailable (private browsing, locked profile),
 * rewires Dexie onto fake-indexeddb and swaps in a fresh instance so the app
 * stays usable for the session; callers surface `degraded` as a warning banner.
 */
export function ensureDb(): Promise<DbStatus> {
  if (!openPromise) {
    openPromise = (async (): Promise<DbStatus> => {
      try {
        await db.open();
        return 'ok';
      } catch {
        const fake = await import('fake-indexeddb');
        Dexie.dependencies.indexedDB = fake.indexedDB;
        Dexie.dependencies.IDBKeyRange = fake.IDBKeyRange;
        db = new HabibitDexie('habibit');
        try {
          await db.open();
        } catch {
          // still unusable: stay degraded, in-memory Dexie keeps the app running
        }
        return 'degraded';
      }
    })();
  }
  return openPromise;
}

export async function resetDb(): Promise<void> {
  await ensureDb();
  // One transaction for both clears: a failure between them must not leave
  // 0 habits plus orphaned entries (spec §11/§12 rule out partial applies).
  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.clear();
    await db.entries.clear();
  });
}
