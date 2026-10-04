import { db, ensureDb, resetDb } from './db';
import { ICON_CHOICES } from './icons';
import type { Entry, Habit } from './types';
import { clampedValue } from './values';

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

/** Bulk write — Dexie's bulkPut runs in one transaction, so a reorder is atomic (R3). */
export async function putHabits(habits: Habit[]): Promise<void> {
  await ensureDb();
  await db.habits.bulkPut(habits);
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
  const habit = await db.habits.get(habitId);
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const entry: Entry = {
    id: `${habitId}_${date}`,
    habitId,
    date,
    value: habit ? clampedValue(habit, value) : safe,   // orphans: floor only
    timestamp: Date.now(),
  };
  await db.entries.put(entry);
  return entry;
}

export async function clearAll(): Promise<void> {
  await ensureDb();
  await resetDb();
}

/**
 * Reset-to-empty (reset spec R1): wipe habits + entries and write the seed
 * marker in ONE transaction, so a reload's seedIfEmpty() sees a claimed
 * database and stays empty (I2/I3 — two separate steps would let a crash in
 * between resurrect the demo data on the next boot). Mirrors importState's
 * inline marker write (same row as markSeeded, no ensureDb inside the tx).
 */
export async function resetToEmpty(): Promise<void> {
  await ensureDb();
  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.clear();
    await db.entries.clear();
    await db.entries.put(seedMarker());
  });
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
 * and exportState skip it, while clearAll() clears it (raw wipe that simulates
 * a fresh database; the Reset button uses resetToEmpty, which re-claims it).
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

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const VALUES_MESSAGE = "That file contains values we can't import.";

/** Fields a payload must carry at all — anything else is a structural reject (R6). */
function isHabitShape(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const h = x as Record<string, unknown>;
  return (
    typeof h.id === 'string' && typeof h.name === 'string' &&
    typeof h.category === 'string' && typeof h.intention === 'string' &&
    (h.type === 'boolean' || h.type === 'quantity' || h.type === 'timer') &&
    typeof h.target === 'number' && Number.isFinite(h.target) &&
    typeof h.unit === 'string' && Array.isArray(h.frequency) &&
    typeof h.order === 'number' && typeof h.createdAt === 'number'
  );
}

function isEntryShape(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  // `value` is deliberately absent: R6.2 repairs it (finite ≥ 0 → clamp, else 0),
  // never rejects — only habit-level structural failures reject the file.
  return (
    typeof e.id === 'string' && typeof e.habitId === 'string' &&
    typeof e.date === 'string' && typeof e.timestamp === 'number'
  );
}

const isWeekday = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6;

/** Repair what is unambiguous; null = structurally unusable → reject the file. */
function repairHabit(x: Record<string, unknown>): Habit | null {
  const frequency = [...new Set((x.frequency as unknown[]).filter(isWeekday))]
    .sort((a, b) => a - b);
  if (frequency.length === 0) return null;               // no usable weekday
  const type = x.type as Habit['type'];
  const target =
    type === 'boolean' ? 1
    : type === 'timer' ? Math.max(60, Math.round(x.target as number))
    : Math.max(1, Math.round(x.target as number));
  return {
    id: x.id as string,
    name: (x.name as string).trim() || 'Untitled habit',
    icon: typeof x.icon === 'string' && (ICON_CHOICES as string[]).includes(x.icon) ? x.icon : 'target',
    color: typeof x.color === 'string' && HEX_COLOR.test(x.color) ? x.color : '#6366f1',
    category: (x.category as string).trim() || 'Other',
    intention: (x.intention as string).trim() || 'Other',
    type,
    target,
    unit: x.unit as string,
    frequency,
    order: x.order as number,
    createdAt: x.createdAt as number,
  };
}

/** Validates fully before writing anything, so a bad file never half-applies. */
export async function importState(data: unknown): Promise<void> {
  const payload = data as { habits?: unknown; entries?: unknown } | null;
  if (!payload || !Array.isArray(payload.habits) || !Array.isArray(payload.entries)) {
    throw new Error("That file isn't a Habibit export.");                     // payload shape
  }
  if (!payload.habits.every(isHabitShape)) throw new Error(VALUES_MESSAGE);   // habit-level (decision 7)
  if (!payload.entries.every(isEntryShape)) {
    throw new Error("That file isn't a Habibit export.");                     // entry-row shape (half-bad pin)
  }
  await ensureDb();

  const habits = (payload.habits as Record<string, unknown>[]).map(repairHabit);
  if (habits.some((h) => h === null)) throw new Error(VALUES_MESSAGE);
  const byId = new Map((habits as Habit[]).map((h) => [h.id, h]));
  const entries = (payload.entries as Entry[]).map((e) => {
    const habit = byId.get(e.habitId);
    const safe = Number.isFinite(e.value) ? Math.max(0, e.value) : 0;
    return { ...e, value: habit ? clampedValue(habit, safe) : safe };
  });

  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.clear();
    await db.entries.clear();
    await db.habits.bulkPut(habits as Habit[]);
    await db.entries.bulkPut(entries);
    // §11: the clear above also wiped the `__seed__` marker, so a non-empty
    // payload must claim it here — otherwise import → delete-all → reload
    // would resurrect the seed data. An empty payload stays marker-less =
    // spec-blessed fresh install that re-seeds on next load. Written inline
    // (same row as markSeeded) to avoid ensureDb() inside the transaction.
    if ((habits as Habit[]).length > 0) await db.entries.put(seedMarker());
  });
}

/**
 * One-time boot pass (spec R1 §2.3): rewrite any stored value outside
 * [0, target] left behind by pre-cap versions or old exports. The `__seed__`
 * marker is not a real entry and is skipped; orphan entries only floor at 0
 * (pruneOrphans removes them). Returns how many rows were fixed; idempotent.
 */
export async function clampLegacyEntries(): Promise<number> {
  await ensureDb();
  const habits = await db.habits.toArray();
  const byId = new Map(habits.map((h) => [h.id, h]));
  const updates: Entry[] = [];
  for (const e of await db.entries.toArray()) {
    if (e.id === SEED_FLAG_ID) continue;
    const habit = byId.get(e.habitId);
    const next = habit
      ? clampedValue(habit, e.value)
      : (Number.isFinite(e.value) ? Math.max(0, e.value) : 0);
    if (next !== e.value) updates.push({ ...e, value: next });
  }
  if (updates.length) await db.entries.bulkPut(updates);
  return updates.length;
}
