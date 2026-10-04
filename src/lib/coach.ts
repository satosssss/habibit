import { addDays, weekdayIndex } from './dates';
import { isCompleted, isScheduled } from './stats';
import type { Entry, Habit } from './types';

export type CoachCategory = 'frequency' | 'reminder' | 'stack' | 'difficulty'
  | 'target' | 'reward-streak' | 'reward-day' | 'encouragement';

export interface CoachInsight {
  id: string;
  kind: 'struggle' | 'success';
  category: CoachCategory;
  habitId?: string;
  title: string;
  body: string;
  patch?: Partial<Habit>;
}

// Spec R1 analysis rules — locked thresholds, one source of truth.
const STRUGGLE_RATE = 0.5;
const STRUGGLE_MIN_SLOTS = 6;
const MISSED_RUN = 3;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const key = (habitId: string, date: string) => `${habitId}|${date}`;

interface Window { slots: number; hits: number; }

function windowStats(habit: Habit, values: Map<string, number>, from: string, to: string): Window {
  let slots = 0;
  let hits = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    slots += 1;
    if (isCompleted(habit, values.get(key(habit.id, d)) ?? 0)) hits += 1;
  }
  return { slots, hits };
}

/** Trailing-14-day window: returns its rate when the habit is struggling,
 *  else null. The 6-slot floor gates BOTH paths (spec I3 — a never-completed
 *  but established habit still struggles; a brand-new one stays silent).
 *  The missed-run path walks back over scheduled days only, and today gets
 *  the same grace stats.ts gives it: an unfinished today is pending, not missed. */
function struggling(habit: Habit, values: Map<string, number>, today: string): number | null {
  const from = addDays(today, -13);
  const { slots, hits } = windowStats(habit, values, from, today);
  if (slots < STRUGGLE_MIN_SLOTS) return null;
  const rate = hits / slots;
  if (rate < STRUGGLE_RATE) return rate;
  let missed = 0;
  for (let d = today; d >= from; d = addDays(d, -1)) {
    if (!isScheduled(habit, d)) continue;
    if (isCompleted(habit, values.get(key(habit.id, d)) ?? 0)) return null;   // a done day breaks the run
    if (d !== today) {
      missed += 1;
      if (missed === MISSED_RUN) return rate;
    }
  }
  return null;
}

function frequencyInsight(habit: Habit, values: Map<string, number>, today: string): CoachInsight | null {
  const cut = habit.frequency.length - 3;                 // never below 3 days/week (R2.1)
  if (cut <= 0) return null;
  const from = addDays(today, -13);
  // Per-weekday hits inside the window: worst first, ties drop the later weekday.
  const hitsByDay = new Map<number, number>();
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    const w = weekdayIndex(d);
    const done = isCompleted(habit, values.get(key(habit.id, d)) ?? 0);
    hitsByDay.set(w, (hitsByDay.get(w) ?? 0) + (done ? 1 : 0));
  }
  const worst = [...habit.frequency].sort(
    (a, b) => (hitsByDay.get(a) ?? 0) - (hitsByDay.get(b) ?? 0) || b - a,
  );
  const removed = worst.slice(0, Math.min(2, cut));
  const remaining = habit.frequency.filter((w) => !removed.includes(w));
  const { slots, hits } = windowStats(habit, values, from, today);
  const days = removed.map((w) => WEEKDAYS[w]);
  const tail = days.length === 2 ? `Trim ${days[0]} and ${days[1]}?` : `Trim ${days[0]}?`;
  return {
    id: `struggle:${habit.id}`,
    kind: 'struggle',
    category: 'frequency',
    habitId: habit.id,
    title: 'Lighten the schedule',
    body: `${habit.name} is slipping — ${hits} of ${slots} scheduled days. ${tail}`,
    patch: { frequency: remaining },
  };
}

export function generateCoachInsights(habits: Habit[], entries: Entry[], today: string): CoachInsight[] {
  const values = new Map(entries.map((e) => [key(e.habitId, e.date), e.value]));
  const rows: Array<{ insight: CoachInsight; rate: number }> = [];   // `rate` feeds Task 4's worst-first sort
  for (const habit of habits) {
    const rate = struggling(habit, values, today);
    if (rate !== null) {
      const freq = frequencyInsight(habit, values, today);
      if (freq) rows.push({ insight: freq, rate });
      // Task 2 appends reminder + stack inside this block.
    }
    // Task 3 appends level-up + milestone here (success signals per habit).
  }
  // Task 3 appends global signals (perfect day, encouragement) after the loop.
  // Task 4 sorts `rows` before returning.
  return rows.map((r) => r.insight);
}
