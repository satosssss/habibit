import { addDays, gridStart, todayKey, weekColumn, weekdayIndex, yearDays } from './dates';
import type { Entry, Habit } from './types';

export interface DayStat {
  date: string;
  scheduled: number;
  completed: number;
  bonus: number;      // completions of habits NOT scheduled that day (spec §6)
  ratio: number;
  active: boolean;
  perfect: boolean;
}

export interface IntentionStat {
  intention: string;
  completed: number;
  scheduled: number;
}

export interface HeatCell {
  date: string;
  inYear: boolean;
  future: boolean;
  completed: number;
  scheduled: number;
  bonus: number;
  ratio: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function isCompleted(habit: Habit, value: number): boolean {
  if (habit.type === 'boolean') return value > 0;
  return value >= habit.target;
}

function isScheduled(habit: Habit, date: string): boolean {
  if (!habit.frequency.includes(weekdayIndex(date))) return false;
  const dayStart = Date.parse(`${date}T00:00:00`);
  return habit.createdAt <= dayStart + 86_399_999;
}

function dayStat(date: string, habits: Habit[], byDate: Map<string, Entry[]>): DayStat {
  const scheduled = habits.filter((h) => isScheduled(h, date));
  const entries = byDate.get(date) ?? [];
  const values = new Map(entries.map((e) => [e.habitId, e.value]));
  const completed = scheduled.filter((h) => isCompleted(h, values.get(h.id) ?? 0)).length;
  // Off-schedule completions are "bonus": they join the all-completions family
  // (Completions, active days, streaks, heatmap floor) and are excluded from the
  // scheduled-slot family (rate, X of Y, tooltips) — spec §6.
  const byId = new Map(habits.map((h) => [h.id, h]));
  let bonus = 0;
  for (const [habitId, value] of values) {
    const habit = byId.get(habitId);
    if (!habit || isScheduled(habit, date) || !isCompleted(habit, value)) continue;
    bonus++;
  }
  return {
    date,
    scheduled: scheduled.length,
    completed,
    bonus,
    ratio: scheduled.length ? completed / scheduled.length : 0,
    active: completed > 0 || bonus > 0,
    perfect: scheduled.length > 0 && completed === scheduled.length,
  };
}

function indexEntries(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = map.get(entry.date);
    if (list) list.push(entry);
    else map.set(entry.date, [entry]);
  }
  return map;
}

export function buildDayStats(
  habits: Habit[],
  entries: Entry[],
  opts: { from?: string; to?: string } = {},
): Map<string, DayStat> {
  const to = opts.to ?? todayKey();
  const from = opts.from ?? gridStart(Number(to.slice(0, 4)));
  const byDate = indexEntries(entries.filter((e) => e.date >= from && e.date <= to));
  const stats = new Map<string, DayStat>();
  let cursor = from;
  while (cursor <= to) {
    stats.set(cursor, dayStat(cursor, habits, byDate));
    cursor = nextDayShift(cursor, 1);
  }
  return stats;
}

function nextDayShift(key: string, delta: number): string {
  return addDays(key, delta);
}

const scheduledOnly = (stats: Map<string, DayStat>) =>
  [...stats.values()].filter((s) => s.scheduled > 0);

export function countActiveDays(stats: Map<string, DayStat>): number {
  return [...stats.values()].filter((s) => s.active).length;
}

export function countPerfectDays(stats: Map<string, DayStat>): number {
  return scheduledOnly(stats).filter((s) => s.perfect).length;
}

export function sumCompletions(stats: Map<string, DayStat>): number {
  return [...stats.values()].reduce((sum, s) => sum + s.completed + s.bonus, 0);
}

export function completionRate(stats: Map<string, DayStat>): {
  completed: number; scheduled: number; rate: number;
} {
  const days = scheduledOnly(stats);
  const completed = days.reduce((sum, s) => sum + s.completed, 0);
  const scheduled = days.reduce((sum, s) => sum + s.scheduled, 0);
  return { completed, scheduled, rate: scheduled ? completed / scheduled : 0 };
}

/**
 * Active-day streak walking back from `today`.
 * - Any completion counts, including off-schedule ones (bonus, spec §6).
 * - Days with no scheduled habits and no completions are skipped: they neither count nor break.
 * - A due day with no completion ends the run; an incomplete `today` never does.
 */
export function currentStreak(stats: Map<string, DayStat>, today: string): number {
  let streak = 0;
  let cursor: string | undefined = today;
  while (cursor && stats.has(cursor)) {
    const day = stats.get(cursor)!;
    if (day.active) { streak++; cursor = prevDay(cursor); continue; }  // scheduled or bonus (spec §6)
    if (day.scheduled === 0) { cursor = prevDay(cursor); continue; }  // neither counts nor breaks
    if (cursor === today) { cursor = prevDay(cursor); continue; }     // today isn't over yet
    break;                                                            // a missed day ends the run
  }
  return streak;
}

function prevDay(key: string): string {
  return nextDayShift(key, -1);
}

export function longestStreak(stats: Map<string, DayStat>): number {
  let best = 0;
  let run = 0;
  for (const day of [...stats.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    if (day.active) { run++; best = Math.max(best, run); continue; }  // scheduled or bonus (spec §6)
    if (day.scheduled === 0) continue;                                // neither counts nor breaks
    run = 0;                                                          // a missed due day ends the run
  }
  return best;
}

export function perIntentionTotals(
  habits: Habit[],
  entries: Entry[],
  year: number,
  today: string = todayKey(),
): IntentionStat[] {
  const from = `${year}-01-01`;
  const to = today < `${year}-12-31` ? today : `${year}-12-31`;
  const byHabit = new Map<string, Entry[]>();
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue; // year window; also drops future-dated rows
    const list = byHabit.get(entry.habitId);
    if (list) list.push(entry);
    else byHabit.set(entry.habitId, [entry]);
  }
  const intentions = [...new Set(habits.map((h) => h.intention))];

  return intentions.map((intention) => {
    let completed = 0;
    let scheduled = 0;
    for (const habit of habits) {
      if (habit.intention !== intention) continue;
      const own = byHabit.get(habit.id);
      if (!own?.length) continue; // never logged this year: nothing owed, renders as 0/0
      const values = new Map(own.map((e) => [e.date, e.value]));
      // "Scheduled-so-far this year": count each scheduled day from the habit's
      // first logged day through today, so days before the user started it
      // aren't counted against them.
      let date = own.reduce((min, e) => (e.date < min ? e.date : min), own[0].date);
      while (date <= to) {
        if (isScheduled(habit, date)) {
          scheduled++;
          if (isCompleted(habit, values.get(date) ?? 0)) completed++;
        }
        date = addDays(date, 1);
      }
    }
    return { intention, completed, scheduled };
  });
}

const LEVEL_STEPS = 4;

export function levelFor(ratio: number, completed: number): 0 | 1 | 2 | 3 | 4 {
  if (completed <= 0 || ratio <= 0) return 0;
  return Math.min(LEVEL_STEPS, Math.ceil(ratio * LEVEL_STEPS)) as 1 | 2 | 3 | 4;
}

export function heatmapCells(
  year: number,
  habits: Habit[],
  entries: Entry[],
  today: string = todayKey(),
): HeatCell[] {
  const start = gridStart(year);
  const inYear = yearDays(year);
  const byDate = indexEntries(entries);
  // Whole weeks covering Jan 1 … Dec 31: the grid start is the Monday on or
  // before Jan 1, so the number of weeks is the column of Dec 31 plus one.
  const daysNeeded = (weekColumn(`${year}-12-31`, year) + 1) * 7;
  const cells: HeatCell[] = [];

  for (let i = 0; i < daysNeeded; i++) {
    const date = nextDayShift(start, i);
    const inYearDay = inYear.includes(date);
    const day = inYearDay ? dayStat(date, habits, byDate) : null;
    const future = date > today;
    const bonus = day?.bonus ?? 0;
    cells.push({
      date,
      inYear: inYearDay,
      future,
      completed: day?.completed ?? 0,
      scheduled: day?.scheduled ?? 0,
      bonus,
      ratio: day?.ratio ?? 0,
      // Off-schedule days floor at level 1 so a bonus still colors the cell
      // (spec §6/§7.4); future and out-of-year days stay at 0.
      level: !day || future
        ? 0
        : (Math.max(levelFor(day.ratio, day.completed), bonus > 0 ? 1 : 0) as 0 | 1 | 2 | 3 | 4),
    });
  }
  return cells;
}
