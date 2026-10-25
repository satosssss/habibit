import { addDays, toKey, weekdayIndex } from './dates';
import { habitStreaks } from './streaks';
import { isCompleted } from './stats';
import type { Challenge, ChallengeType, Entry, Habit } from './types';

export type ChallengeOutcome = 'active' | 'won' | 'failed';
export type ChallengeProgress = { label: string; current: number; total: number };

export function challengeTitle(type: ChallengeType): string {
  return type === 'streak7' ? '7-Day Streak'
    : type === 'weekend' ? 'Weekend Warrior'
    : 'Category Sprint';
}

/** Key -> value map for O(1) day lookups (same shape habitStreaks builds). */
const valueMap = (entries: Entry[]): Map<string, number> =>
  new Map(entries.map((e) => [`${e.habitId}|${e.date}`, e.value]));

/**
 * A day is perfect for a scope when every scheduled habit in it is complete.
 * A day with nothing scheduled in scope is skipped: it counts as perfect
 * (streak-preserving) and never fails — the same convention streaks use (G3).
 */
const dayPerfect = (scope: Habit[], values: Map<string, number>, date: string): boolean => {
  for (const h of scope) {
    if (!h.frequency.includes(weekdayIndex(date))) continue;
    if (!isCompleted(h, values.get(`${h.id}|${date}`) ?? 0)) return false;
  }
  return true;
};

/** Consecutive perfect days ending today (today counts only if perfect; a miss before today breaks). */
const scopeRun = (scope: Habit[], entries: Entry[], today: string): number => {
  const values = valueMap(entries);
  let run = dayPerfect(scope, values, today) ? 1 : 0;
  for (let cursor = addDays(today, -1), guard = 0; guard < 36500; cursor = addDays(cursor, -1), guard++) {
    if (dayPerfect(scope, values, cursor)) run++;
    else break;
  }
  return run;
};

/** True when some scheduled in-scope day in [from, to) is not perfect. */
const missedBetween = (scope: Habit[], values: Map<string, number>, from: string, to: string): boolean => {
  for (let cursor = from, guard = 0; cursor < to && guard < 36500; cursor = addDays(cursor, 1), guard++) {
    if (!dayPerfect(scope, values, cursor)) return true;
  }
  return false;
};

/** Anti-instant-win guard: at least one in-scope completion written at/after the join moment. */
const completedSince = (scope: Habit[], entries: Entry[], since: number): boolean => {
  const ids = new Set(scope.map((h) => h.id));
  return entries.some((e) => ids.has(e.habitId) && e.timestamp >= since && isCompleted(scope.find((h) => h.id === e.habitId)!, e.value));
};

/**
 * The first Saturday on/after the join date (join Saturday → that same
 * weekend; join Sunday → next weekend; join midweek → the upcoming one).
 */
export function weekendWindow(startedAt: number): { saturday: string; sunday: string } {
  const joinDay = toKey(new Date(startedAt));
  const delta = (6 - weekdayIndex(joinDay) + 7) % 7; // Sat → 0, Sun → 6, Fri → 1 …
  const saturday = addDays(joinDay, delta);
  return { saturday, sunday: addDays(saturday, 1) };
}

/**
 * Pure evaluation of an ACTIVE challenge. Callers (repo.evaluateChallenges)
 * only pass active instances — terminal statuses are never re-evaluated.
 * Win is checked before fail (spec: win-before-fail ordering).
 */
export function challengeOutcome(c: Challenge, habits: Habit[], entries: Entry[], today: string): ChallengeOutcome {
  if (c.type === 'weekend') {
    const { saturday, sunday } = weekendWindow(c.startedAt);
    const values = valueMap(entries);
    if (dayPerfect(habits, values, saturday) && dayPerfect(habits, values, sunday)) return 'won'; // decided once both days are done
    if (today > sunday) return 'failed'; // the weekend closed with a miss (persists to next open)
    return 'active';
  }

  const scope = c.type === 'streak7'
    ? habits.filter((h) => h.id === c.habitId)
    : habits.filter((h) => h.category === c.category);
  if (scope.length === 0) return 'active'; // orphan closes via the boot orphan pass, not here

  const run = c.type === 'streak7'
    ? habitStreaks(scope, entries, today)[scope[0].id] // single habit: reuse the house run, never reimplement it
    : scopeRun(scope, entries, today);

  if (run >= 7 && completedSince(scope, entries, c.startedAt)) return 'won';
  if (missedBetween(scope, valueMap(entries), toKey(new Date(c.startedAt)), today)) return 'failed';
  return 'active';
}

/** Live progress for the UI. Pure; derives everything from entries. */
export function challengeProgress(c: Challenge, habits: Habit[], entries: Entry[], today: string): ChallengeProgress {
  if (c.type === 'weekend') {
    const { saturday, sunday } = weekendWindow(c.startedAt);
    const values = valueMap(entries);
    const current = Number(dayPerfect(habits, values, saturday)) + Number(dayPerfect(habits, values, sunday));
    return { label: `${current}/2 weekend days`, current, total: 2 };
  }
  const scope = c.type === 'streak7'
    ? habits.filter((h) => h.id === c.habitId)
    : habits.filter((h) => h.category === c.category);
  const run = scope.length === 0 ? 0 : c.type === 'streak7'
    ? habitStreaks(scope, entries, today)[scope[0].id]
    : scopeRun(scope, entries, today);
  const current = Math.min(run, 7);
  return { label: `Day ${current}/7`, current, total: 7 };
}
