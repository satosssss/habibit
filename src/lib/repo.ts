import { db, ensureDb, resetDb } from './db';
import type { Entry, Habit } from './types';

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function listHabits(): Promise<Habit[]> {
  await ensureDb();
  return db.habits.toArray();
}

export async function countHabits(): Promise<number> {
  await ensureDb();
  return db.habits.count();
}

export async function putHabit(habit: Habit): Promise<Habit> {
  await ensureDb();
  await db.habits.put(habit);
  return habit;
}

export async function deleteHabit(id: string): Promise<void> {
  await ensureDb();
  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.delete(id);
    await db.entries.where('habitId').equals(id).delete();
  });
}

export async function loadDay(date: string): Promise<Entry[]> {
  await ensureDb();
  return db.entries.where('date').equals(date).toArray();
}

export async function loadRange(from: string, to: string): Promise<Entry[]> {
  await ensureDb();
  return db.entries.where('date').between(from, to, true, true).toArray();
}

export async function setMany(entries: Entry[]): Promise<void> {
  await ensureDb();
  await db.entries.bulkPut(entries);
}

export async function putEntry(habitId: string, date: string, value: number): Promise<Entry> {
  await ensureDb();
  const entry: Entry = { id: `${habitId}_${date}`, habitId, date, value, timestamp: Date.now() };
  await db.entries.put(entry);
  return entry;
}

export async function clearAll(): Promise<void> {
  await ensureDb();
  await resetDb();
}

/** Removes entries whose habit no longer exists (spec §12). Returns the count removed. */
export async function pruneOrphans(): Promise<number> {
  await ensureDb();
  const ids = new Set((await db.habits.toArray()).map((h) => h.id));
  const orphans = (await db.entries.toArray())
    .filter((e) => e.habitId !== SEED_FLAG_ID && !ids.has(e.habitId));
  if (orphans.length) await db.entries.bulkDelete(orphans.map((e) => e.id));
  return orphans.length;
}

const SEED_FLAG_ID = '__seed__';

const seedMarker = (): Entry => ({ id: SEED_FLAG_ID, habitId: SEED_FLAG_ID, date: '', value: 1, timestamp: 0 });

/**
 * Seed marker row — spec §4.2/§11's seed marker: lives in `entries` with
 * `id = '__seed__'` and `date: ''`; it is not a real entry, so reads, stats,
 * and exportState skip it, while clearAll() clears it (so Reset can re-seed).
 * It survives habit deletion so deleting everything never resurrects seed data.
 */
export async function hasSeeded(): Promise<boolean> {
  await ensureDb();
  return !!(await db.entries.get(SEED_FLAG_ID));
}

export async function markSeeded(): Promise<void> {
  await ensureDb();
  await db.entries.put(seedMarker());
}

export async function exportState(): Promise<{ habits: Habit[]; entries: Entry[] }> {
  await ensureDb();
  return {
    habits: (await db.habits.toArray()).filter((h) => h.id !== SEED_FLAG_ID),
    entries: (await db.entries.toArray()).filter(
      (e) => e.id !== SEED_FLAG_ID && e.habitId !== SEED_FLAG_ID,
    ),
  };
}

function isHabit(x: unknown): x is Habit {
  if (!x || typeof x !== 'object') return false;
  const h = x as Record<string, unknown>;
  return (
    typeof h.id === 'string' && typeof h.name === 'string' &&
    typeof h.category === 'string' && typeof h.intention === 'string' &&
    (h.type === 'boolean' || h.type === 'quantity' || h.type === 'timer') &&
    typeof h.target === 'number' && typeof h.unit === 'string' &&
    Array.isArray(h.frequency) && typeof h.order === 'number' &&
    typeof h.createdAt === 'number'
  );
}

function isEntry(x: unknown): x is Entry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === 'string' && typeof e.habitId === 'string' &&
    typeof e.date === 'string' && typeof e.value === 'number' &&
    typeof e.timestamp === 'number'
  );
}

/** Validates fully before writing anything, so a bad file never half-applies. */
export async function importState(data: unknown): Promise<void> {
  const payload = data as { habits?: unknown; entries?: unknown } | null;
  const ok =
    !!payload && Array.isArray(payload.habits) && Array.isArray(payload.entries) &&
    payload.habits.every(isHabit) && payload.entries.every(isEntry);
  if (!ok) throw new Error("That file isn't a Habibit export.");
  await ensureDb();
  const habits = payload.habits as Habit[];
  const entries = payload.entries as Entry[];
  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.clear();
    await db.entries.clear();
    await db.habits.bulkPut(habits);
    await db.entries.bulkPut(entries);
    // §11: the clear above also wiped the `__seed__` marker, so a non-empty
    // payload must claim it here — otherwise import → delete-all → reload
    // would resurrect the seed data. An empty payload stays marker-less =
    // spec-blessed fresh install that re-seeds on next load. Written inline
    // (same row as markSeeded) to avoid ensureDb() inside the transaction.
    if (habits.length > 0) await db.entries.put(seedMarker());
  });
}
