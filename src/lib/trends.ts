import type { DayStat } from './stats';

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
