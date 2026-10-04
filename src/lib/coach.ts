import { addDays, mondayOf, weekdayIndex } from './dates';
import { buildDayStats, completionRate, isCompleted, isScheduled, weekWindows } from './stats';
import { habitStreaks } from './streaks';   // streaks are composed, never recomputed
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

// Catalog order from spec §4 — the tiebreaker inside a rank band.
const CATEGORY_ORDER: Record<CoachCategory, number> = {
  frequency: 0, reminder: 1, stack: 2, difficulty: 3, target: 4,
  'reward-streak': 5, 'reward-day': 6, encouragement: 7,
};

/** Struggle (0) > level-up (1) > reward (2) > encouragement (3) — spec §3 ranking. */
const rankOf = (c: CoachCategory): number =>
  c === 'encouragement' ? 3 : CATEGORY_ORDER[c] >= 5 ? 2 : CATEGORY_ORDER[c] >= 3 ? 1 : 0;

// Spec R1 analysis rules — locked thresholds, one source of truth.
const STRUGGLE_RATE = 0.5;
const STRUGGLE_MIN_SLOTS = 6;
const MISSED_RUN = 3;
const REMIND_LOOKBACK = 30;
const STACK_MIN_SLOTS = 7;
// Spec R1 success rules — level-ups need a real streak AND a strong week.
const LEVELUP_MIN_STREAK = 7;
const LEVELUP_HARD_STREAK = 14;
const LEVELUP_RATE = 0.8;
const MILESTONES = [7, 14, 30, 50, 100, 200, 365];
const ENCOURAGE_DELTA = 2;
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

function formatHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'am' : 'pm'}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** Mode completion hour over the trailing 30 days — the user's own rhythm
 *  (spec R2.2). Only rows that ARE completions tally: un-checks overwrite the
 *  day's row with value 0 and stopped timers leave partial seconds (both via
 *  putEntry's single row per habit+date), so counting touches would invent a
 *  peak from moments the habit was never finished. Orphan rows are skipped for
 *  the same reason — completion is unknowable without the habit. Zero
 *  completions → null and the reminder stays silent (I3: nothing invented).
 *  Ties resolve to the earliest hour. */
function peakHour(habits: Habit[], entries: Entry[], today: string): number | null {
  const from = addDays(today, -(REMIND_LOOKBACK - 1));
  const byId = new Map(habits.map((h) => [h.id, h]));
  const counts = new Map<number, number>();
  for (const e of entries) {
    if (e.date < from || e.date > today) continue;
    const habit = byId.get(e.habitId);
    if (!habit || !isCompleted(habit, e.value)) continue;
    const hour = new Date(e.timestamp).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [hour, n] of counts) {
    if (best === null || n > counts.get(best)!) best = hour;
    else if (n === counts.get(best)! && hour < best) best = hour;
  }
  return best;
}

function reminderInsight(habit: Habit, habits: Habit[], entries: Entry[], today: string): CoachInsight | null {
  const peak = peakHour(habits, entries, today);
  if (peak === null) return null;
  const suggested = `${String((peak + 23) % 24).padStart(2, '0')}:30`;   // peak − 30min, wraps midnight
  const current = habit.reminderTime;
  if (current && current === suggested) return null;
  const absent = !current;
  const body = absent
    ? `${habit.name} has no reminder. You usually check off habits around ${formatHour(peak)} — set ${formatTime(suggested)}?`
    : `${habit.name} reminds you at ${formatTime(current!)}, but you usually finish habits around ${formatHour(peak)} — try ${formatTime(suggested)}?`;
  return {
    id: `struggle:${habit.id}`,
    kind: 'struggle',
    category: 'reminder',
    habitId: habit.id,
    title: absent ? 'Pick a reminder time' : 'Move your reminder',
    body,
    patch: { reminderTime: suggested },
  };
}

function stackInsight(
  habit: Habit, habits: Habit[], values: Map<string, number>,
  streaks: Record<string, number>, today: string,
): CoachInsight | null {
  if (habits.length < 2) return null;
  const from = addDays(today, -29);
  let best: { habit: Habit; rate: number; streak: number } | null = null;
  for (const other of habits) {
    if (other.id === habit.id) continue;
    if (!other.frequency.some((w) => habit.frequency.includes(w))) continue;   // shared scheduled day
    const { slots, hits } = windowStats(other, values, from, today);
    if (slots < STACK_MIN_SLOTS) continue;
    const rate = slots ? hits / slots : 0;
    const streak = streaks[other.id] ?? 0;
    const better = !best || rate > best.rate
      || (rate === best.rate && streak > best.streak)
      || (rate === best.rate && streak === best.streak && other.name.localeCompare(best.habit.name) < 0);
    if (better) best = { habit: other, rate, streak };
  }
  if (!best) return null;
  return {
    id: `struggle:${habit.id}`,
    kind: 'struggle',
    category: 'stack',
    habitId: habit.id,
    title: 'Stack it',
    body: `Stack it: do ${habit.name} right after ${best.habit.name} — your steadiest habit.`,
  };
}

function levelUpInsight(habit: Habit, streak: number, rate7: number): CoachInsight | null {
  if (streak < LEVELUP_MIN_STREAK || rate7 < LEVELUP_RATE) return null;
  if (habit.type === 'boolean') {
    const current = habit.difficulty ?? 'medium';        // legacy rows read medium (spec R1)
    if (current === 'hard') return null;                 // terminal
    const next = current === 'easy' ? 'medium' : 'hard';
    if (next === 'hard' && streak < LEVELUP_HARD_STREAK) return null;
    return {
      id: `levelup:${habit.id}:difficulty`,
      kind: 'success',
      category: 'difficulty',
      habitId: habit.id,
      title: 'Level up',
      body: `${streak}-day streak on ${habit.name}. Ready for ${next === 'medium' ? 'Medium' : 'Hard'}?`,
      patch: { difficulty: next },
    };
  }
  const next = habit.type === 'quantity'
    ? Math.ceil(habit.target * 1.1)
    : Math.ceil((habit.target * 1.1) / 60) * 60;        // timer: next whole minute of +10%
  if (habit.type === 'timer') {
    const currentMin = Math.round(habit.target / 60);
    if (next / 60 <= currentMin) return null;            // rounds to the current value → nothing to say
    return {
      id: `levelup:${habit.id}:target`,
      kind: 'success',
      category: 'target',
      habitId: habit.id,
      title: 'Raise the target',
      body: `${streak}-day streak at ${currentMin} minutes. Try ${next / 60}?`,
      patch: { target: next },
    };
  }
  const unit = habit.unit ? ` ${habit.unit}` : '';       // empty unit drops from the copy (spec §4)
  return {
    id: `levelup:${habit.id}:target`,
    kind: 'success',
    category: 'target',
    habitId: habit.id,
    title: 'Raise the target',
    body: `${habit.target.toLocaleString('en-US')}${unit} for ${streak} days straight. Try ${next.toLocaleString('en-US')}?`,
    patch: { target: next },
  };
}

function milestoneInsight(habit: Habit, streak: number): CoachInsight | null {
  if (!MILESTONES.includes(streak)) return null;
  return {
    id: `reward:${habit.id}:streak:${streak}`,
    kind: 'success',
    category: 'reward-streak',
    habitId: habit.id,
    title: 'Streak milestone',
    body: `${streak} days of ${habit.name} in a row. That's a habit now.`,
  };
}

function perfectDayInsight(habits: Habit[], entries: Entry[], today: string): CoachInsight | null {
  const day = buildDayStats(habits, entries, { from: today, to: today }).get(today);
  if (!day?.perfect) return null;                        // scheduled > 0 && completed === scheduled
  return {
    id: `reward:perfectday:${today}`,
    kind: 'success',
    category: 'reward-day',
    title: 'Perfect day',
    body: 'Every habit checked off today. Perfect day.',
  };
}

function encouragementInsight(habits: Habit[], entries: Entry[], today: string): CoachInsight | null {
  const { thisFrom, thisTo, lastFrom, lastTo } = weekWindows(today);
  const now = completionRate(buildDayStats(habits, entries, { from: thisFrom, to: thisTo })).completed;
  const prev = completionRate(buildDayStats(habits, entries, { from: lastFrom, to: lastTo })).completed;
  const delta = now - prev;
  if (delta < ENCOURAGE_DELTA) return null;
  return {
    id: `encourage:${mondayOf(today)}`,
    kind: 'success',
    category: 'encouragement',
    title: 'Momentum',
    body: `You logged ${delta} more completions than last week. Keep that going.`,
  };
}

export function generateCoachInsights(habits: Habit[], entries: Entry[], today: string): CoachInsight[] {
  const values = new Map(entries.map((e) => [key(e.habitId, e.date), e.value]));
  const streaks = habitStreaks(habits, entries, today);
  const rows: Array<{ insight: CoachInsight; rate: number }> = [];   // `rate` feeds Task 4's worst-first sort
  for (const habit of habits) {
    const rate = struggling(habit, values, today);
    if (rate !== null) {
      const freq = frequencyInsight(habit, values, today);
      if (freq) rows.push({ insight: freq, rate });
      const remind = reminderInsight(habit, habits, entries, today);
      if (remind) rows.push({ insight: remind, rate });
      const stack = stackInsight(habit, habits, values, streaks, today);
      if (stack) rows.push({ insight: stack, rate });
    }
    const streak = streaks[habit.id] ?? 0;
    const w7 = windowStats(habit, values, addDays(today, -6), today);
    const level = levelUpInsight(habit, streak, w7.slots ? w7.hits / w7.slots : 0);
    if (level) rows.push({ insight: level, rate: 0 });
    const ms = milestoneInsight(habit, streak);
    if (ms) rows.push({ insight: ms, rate: 0 });
  }
  const perfect = perfectDayInsight(habits, entries, today);
  if (perfect) rows.push({ insight: perfect, rate: 0 });
  const encourage = encouragementInsight(habits, entries, today);
  if (encourage) rows.push({ insight: encourage, rate: 0 });
  // Spec §3 + I1: priority order, worst struggling first inside the struggle
  // band, then catalog order, then habit id + insight id — same inputs, same
  // output, always.
  rows.sort((a, b) => {
    const ra = rankOf(a.insight.category);
    const rb = rankOf(b.insight.category);
    if (ra !== rb) return ra - rb;
    if (ra === 0 && a.rate !== b.rate) return a.rate - b.rate;
    return CATEGORY_ORDER[a.insight.category] - CATEGORY_ORDER[b.insight.category]
      || (a.insight.habitId ?? '').localeCompare(b.insight.habitId ?? '')
      || a.insight.id.localeCompare(b.insight.id);
  });
  return rows.map((r) => r.insight);
}

export const COACH_DISMISSALS_KEY = 'habibit:coach-dismissals';
export const COACH_DISMISS_TTL_MS = 7 * 86_400_000;

export function readDismissals(): Record<string, number> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(COACH_DISMISSALS_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [id, at] of Object.entries(raw)) if (typeof at === 'number') out[id] = at;
    return out;
  } catch { return {}; }                                 // corrupt → empty, never a crash
}

/** Unexpired dismissals only. */
export function liveDismissals(now: number = Date.now()): Record<string, number> {
  const live: Record<string, number> = {};
  for (const [id, at] of Object.entries(readDismissals()))
    if (now - at < COACH_DISMISS_TTL_MS) live[id] = at;
  return live;
}

export function dismissSuggestion(id: string, now: number = Date.now()): void {
  const next = { ...liveDismissals(now), [id]: now };    // prune on every write
  try { localStorage.setItem(COACH_DISMISSALS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
}

export function visibleInsights(
  insights: CoachInsight[], dismissed: Record<string, number>, now: number = Date.now(),
): CoachInsight[] {
  return insights.filter((i) => {
    const at = dismissed[i.id];
    return at === undefined || now - at >= COACH_DISMISS_TTL_MS;
  });
}
