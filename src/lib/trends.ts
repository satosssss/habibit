import { addDays, mondayIndex, mondayOf } from './dates';
import type { DayStat } from './stats';
import { isCompleted } from './stats';
import type { Entry, Habit } from './types';

export type SeriesPoint = { date: string; streak: number; broke: number | null };

/**
 * Forward walk of the active-day streak — the exact mirror of `currentStreak`
 * (stats.ts), one point per day up to and including `today`:
 * - active day (spec §6): run + 1
 * - unscheduled day: skipped — neither counts nor breaks; the run persists
 * - incomplete `today`: held — the day isn't over yet (never implies failure)
 * - past scheduled day with nothing done: closes the run; `broke` carries the
 *   length that ended (≥ 1), or `null` when the run was already 0 — so only
 *   the FIRST missed day of a run of misses carries a break (spec R1.3).
 */
export function streakSeries(stats: Map<string, DayStat>, today: string): SeriesPoint[] {
  const days = [...stats.values()].sort((a, b) => a.date.localeCompare(b.date));
  const out: SeriesPoint[] = [];
  let run = 0;
  for (const day of days) {
    if (day.date > today) break;                                  // future days are never in the series
    if (day.active) { run += 1; out.push({ date: day.date, streak: run, broke: null }); continue; }
    if (day.scheduled === 0) { out.push({ date: day.date, streak: run, broke: null }); continue; }
    if (day.date === today) { out.push({ date: day.date, streak: run, broke: null }); continue; }
    out.push({ date: day.date, streak: 0, broke: run > 0 ? run : null });
    run = 0;
  }
  return out;
}

export type WeekRate = { weekStart: string; completed: number; scheduled: number; rate: number | null };
export type WeekdayRate = { weekday: number; completed: number; scheduled: number; rate: number | null };

const inYear = (date: string, year: number) => date >= `${year}-01-01` && date <= `${year}-12-31`;

/**
 * Weekly completion rate across the selected year, Monday-anchored buckets
 * (heatmap week start). `rate: null` marks a week with no scheduled slots —
 * the chart draws a GAP, never a fake 0% (spec §5.2). Edge buckets keep only
 * in-year days, the same slot math `completionRate` uses.
 */
export function weeklyRates(stats: Map<string, DayStat>, year: number): WeekRate[] {
  const buckets = new Map<string, { completed: number; scheduled: number }>();
  for (const day of stats.values()) {
    if (!inYear(day.date, year)) continue;
    const key = mondayOf(day.date);
    const b = buckets.get(key) ?? { completed: 0, scheduled: 0 };
    b.completed += day.completed;
    b.scheduled += day.scheduled;
    buckets.set(key, b);
  }
  const out: WeekRate[] = [];
  let cursor = mondayOf(`${year}-01-01`);
  const end = mondayOf(`${year}-12-31`);
  while (cursor <= end) {
    const b = buckets.get(cursor) ?? { completed: 0, scheduled: 0 };
    out.push({ weekStart: cursor, ...b, rate: b.scheduled > 0 ? b.completed / b.scheduled : null });
    cursor = addDays(cursor, 7);
  }
  return out;
}

/** Completion rate per weekday, Monday-first (Mon = 0). Slots family (spec R5 §5.3). */
export function weekdayRates(stats: Map<string, DayStat>, year: number): WeekdayRate[] {
  const buckets = Array.from({ length: 7 }, () => ({ completed: 0, scheduled: 0 }));
  for (const day of stats.values()) {
    if (!inYear(day.date, year)) continue;
    const b = buckets[mondayIndex(day.date)];
    b.completed += day.completed;
    b.scheduled += day.scheduled;
  }
  return buckets.map((b, weekday) => ({
    weekday, ...b, rate: b.scheduled > 0 ? b.completed / b.scheduled : null,
  }));
}

/**
 * Completions per local hour (0–23) from entry write times, selected year.
 * Counts only rows that ARE completions (`isCompleted` — the coach peak-hour
 * rule) and includes off-schedule bonus logs (all-completions family).
 */
export function hourHistogram(habits: Habit[], entries: Entry[], year: number): number[] {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const counts = Array.from({ length: 24 }, () => 0);
  for (const e of entries) {
    if (!e.date.startsWith(`${year}-`)) continue;
    const habit = byId.get(e.habitId);
    if (!habit || !isCompleted(habit, e.value)) continue;
    counts[new Date(e.timestamp).getHours()] += 1;
  }
  return counts;
}
