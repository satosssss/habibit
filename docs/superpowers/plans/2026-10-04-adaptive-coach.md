# Adaptive Habit Coach: Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-04-adaptive-coach-design.md` (approved by user 2026-10-04)
**Method:** TDD — every task writes its tests first, watches them fail, implements, then runs the full gate suite before committing.
**Execution:** current checkout on `main` (house precedent — reset/add-habit ran inline; no worktree).

## Conventions (apply to every task)

- **Gates, in order:** `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
  Expected at every commit (cumulative, baseline **459 tests / 49 files**):

  | Task | New tests | Cumulative |
  |---|---|---|
  | 1 | +12 | 471 / 50 |
  | 2 | +10 | 481 / 50 |
  | 3 | +17 | 498 / 50 |
  | 4 | +9 | 507 / 50 |
  | 5 | +6 | 513 / 51 |
  | 6 | +9 | 522 / 52 |
  | 7 | +4 | 526 / 52 |
  | 8 | 0 | 526 / 52 |

  `tsc --noEmit` 0 errors, lint = baseline only (2 warnings in `src/lib/stats.test.ts`),
  build exit 0. If the runner's total ≠ the table, reconcile against the authored
  `it(` count before committing (a mismatch means a test silently didn't register).
- **Exact staging only:** `git add <specific paths>` — NEVER `git add .`.
  Never stage `.opencode/` or `opencode.json` (they stay untracked).
- **Ledger:** record each task (test counts, gate output, deviations) in
  `.superpowers/sdd/2026-10-04-adaptive-coach/progress.md` (create in Task 1,
  stage alongside each commit).
- **Copy is exact.** Spec §4 strings are asserted verbatim in tests; changing a
  string = changing the spec. Dynamic slots render via the template helpers.
- **Engine test idiom:** the engine takes `today` as a parameter — tests pass a
  fixed date (`2026-10-04`, a Sunday; trailing-14 window = Mon 2026-09-21 …
  Sun 2026-10-04). NO fake timers for engine tests. Component tests needing
  "today" use `todayKey()` directly.
- **Component test idiom:** `beforeEach(async () => { await clearAll(); localStorage.clear(); })`;
  banner failures render inside `<NavShell>` and spy `putHabit`
  (AddHabitScreen.test.tsx:100-112 pattern); `waitFor` around async state.
- **No new dependencies. No runtime network. Local-first.** Components never call
  `generateCoachInsights` — the screens own the `useMemo` and pass `insights` down.
- **Rejected levers (spec §8):** no difficulty-downgrade suggestions, no
  notifications, no dismiss-on-apply (re-firing after apply is threshold-governed
  by design — the user can dismiss), no localStorage in the engine function itself.

## Task graph

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
```

Linear: `coach.ts` grows each engine task; components consume the finished
engine; surfaces wire last; docs/verification follow the behavior.
Task 5 (CoachSection) precedes Task 6 (CoachCard) because CoachCard imports the
shared `CoachRow` from CoachSection.

---

## Task 1 — Engine part 1: slot windows + struggle detection + frequency (spec R1 I1–I3, R2.1)

**Files:** `src/lib/stats.ts`, `src/lib/coach.ts` (new), `src/lib/coach.test.ts` (new),
`.superpowers/sdd/2026-10-04-adaptive-coach/progress.md` (new)

### Tests first (red)

`src/lib/coach.test.ts` — new file:

```ts
import { describe, expect, it } from 'vitest';
import { generateCoachInsights } from './coach';
import { addDays } from './dates';
import type { Entry, Habit } from './types';

// Coach spec R1/R2: the engine takes `today` as a parameter, so every fixture
// pins an explicit date. 2026-10-04 is a Sunday; the trailing-14 window is
// Mon 2026-09-21 … Sun 2026-10-04 (14 scheduled slots for a daily habit).
const TODAY = '2026-10-04';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const createdDaysAgo = (n: number) => Date.parse(`${addDays(TODAY, -n)}T00:00:00`);

const entry = (habitId: string, date: string, value = 1, hour = 12): Entry => ({
  id: `${habitId}_${date}`, habitId, date, value,
  timestamp: Date.parse(`${date}T${String(hour).padStart(2, '0')}:15:00`),
});

describe('coach: struggle detection (spec R1 I2/I3)', () => {
  it('returns nothing when there are no habits', () => {
    expect(generateCoachInsights([], [], TODAY)).toEqual([]);
  });

  it('stays silent while a habit has fewer than 6 scheduled slots', () => {
    const young = habit({ createdAt: createdDaysAgo(4) });   // Sep 30 … Oct 4 = 5 slots
    expect(generateCoachInsights([young], [], TODAY)).toEqual([]);
  });

  it('fires struggle when the 14-day rate is under 50% with ≥6 slots', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });      // exactly 14 slots
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d));
    const freq = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'frequency');
    expect(freq).toBeDefined();
    expect(freq!.kind).toBe('struggle');
    expect(freq!.id).toBe('struggle:h1');
    expect(freq!.body).toContain('6 of 14 scheduled days');
  });

  it('fires struggle for a never-completed habit once it has 6 slots (0/6)', () => {
    const h = habit({ createdAt: createdDaysAgo(5) });       // Sep 29 … Oct 4 = 6 slots
    const freq = generateCoachInsights([h], [], TODAY).find((i) => i.category === 'frequency');
    expect(freq?.body).toContain('0 of 6 scheduled days');
  });

  it('does not flag a habit sitting at exactly 50%', () => {
    const h = habit({ createdAt: createdDaysAgo(7) });       // 8 slots
    const entries = ['2026-09-27', '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => entry(h.id, d));
    expect(generateCoachInsights([h], entries, TODAY).filter((i) => i.kind === 'struggle')).toEqual([]);
  });

  it('missed-3 also needs the 6-slot floor', () => {
    const h = habit({ createdAt: createdDaysAgo(4) });       // 5 slots, all missed
    expect(generateCoachInsights([h], [], TODAY)).toEqual([]);
  });

  it('fires struggle on 3 consecutive missed scheduled days despite a good window rate', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    // Done through Sep 30, Oct 1–3 missed → 10/14 = 71%, which the rate path
    // would never flag: only the missed-run path can produce this insight.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
                     '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']
      .map((d) => entry(h.id, d));
    const out = generateCoachInsights([h], entries, TODAY);
    expect(out.some((i) => i.kind === 'struggle' && i.category === 'frequency')).toBe(true);
  });

  it('treats an unfinished today as pending, not missed (grace, stats.ts precedent)', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    // Done through Oct 1; Oct 2–3 missed; today pending. The real run is only
    // two misses — counting today as a third would wrongly fire.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
                     '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01'].map((d) => entry(h.id, d));
    expect(generateCoachInsights([h], entries, TODAY).filter((i) => i.kind === 'struggle')).toEqual([]);
  });
});

describe('coach: frequency suggestions (spec R2.1)', () => {
  it('cuts the two worst weekdays, ties dropping the later weekday first', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    // Done Mon–Wed both weeks only → 6/14 = 43%; Thu–Sun all zero-hit.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d));
    const freq = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'frequency')!;
    // Zero-hit tie {Thu, Fri, Sat, Sun} → later weekday first: Sat(6), Fri(5).
    expect(freq.patch?.frequency).toEqual([0, 1, 2, 3, 4]);
    expect(freq.body).toContain('Trim Saturday and Friday?');
  });

  it('ranks a fully-missed weekday above midweek ties', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    // First week Mon–Sat done, both Sundays missed → Sun the only zero-hit
    // day; the six one-hit weekdays tie → Sat is the second cut.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-24', '2026-09-25', '2026-09-26'].map((d) => entry(h.id, d));
    const freq = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'frequency')!;
    expect(freq.patch?.frequency).toEqual([1, 2, 3, 4, 5]);
    expect(freq.body).toContain('Trim Sunday and Saturday?');
  });

  it('never cuts below three days a week (no frequency insight at 3×)', () => {
    const h = habit({ createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });
    const out = generateCoachInsights([h], [], TODAY);
    expect(out.some((i) => i.category === 'frequency')).toBe(false);
  });

  it('cuts a single day at 4×/week with the one-day copy', () => {
    const h = habit({ createdAt: createdDaysAgo(14), frequency: [1, 2, 3, 5] });
    const freq = generateCoachInsights([h], [], TODAY).find((i) => i.category === 'frequency')!;
    expect(freq.patch?.frequency).toEqual([1, 2, 3]);
    expect(freq.body).toContain('Trim Friday?');
    expect(freq.body).not.toContain(' and ');
  });
});
```

Run: all 12 fail (`./coach` doesn't exist).

### Implementation

**`src/lib/stats.ts`** — export the existing private helper (the engine must use
the SAME scheduling rule, never a reimplementation — spec R1/R5):

```diff
- function isScheduled(habit: Habit, date: string): boolean {
+ // Exported for the coach engine (coach spec R1 I2): slot windows must use the
+ // SAME scheduling rule stats uses — never a reimplementation.
+ export function isScheduled(habit: Habit, date: string): boolean {
```

**`src/lib/coach.ts`** — new file:

```ts
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
```

### Gates → commit

`npm test` (471 green) → typecheck → lint → build.
Stage `src/lib/stats.ts`, `src/lib/coach.ts`, `src/lib/coach.test.ts`,
`.superpowers/sdd/2026-10-04-adaptive-coach/progress.md`.
**Commit:** `feat(coach): struggle detection + frequency suggestions from a 14-day slot window`

---

## Task 2 — Engine part 2: reminder derivation + habit stacking (spec R2.2–2.3)

**Files:** `src/lib/coach.ts`, `src/lib/coach.test.ts`

### Tests first (red)

Append to `src/lib/coach.test.ts`:

```ts
describe('coach: reminder suggestions (spec R2.2)', () => {
  it('derives the reminder from the peak hour minus 30 minutes', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 20));
    const remind = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reminder')!;
    expect(remind.title).toBe('Pick a reminder time');
    expect(remind.body).toBe('Meditate has no reminder. You usually check off habits around 8 pm — set 7:30 pm?');
    expect(remind.patch?.reminderTime).toBe('19:30');
    expect(remind.id).toBe('struggle:h1');
  });

  it('wraps midnight: a 00:00 peak suggests 23:30', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 0));
    const remind = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reminder')!;
    expect(remind.patch?.reminderTime).toBe('23:30');
    expect(remind.body).toContain('around 12 am — set 11:30 pm?');
  });

  it('stays silent when the derived time equals the current reminder', () => {
    const h = habit({ createdAt: createdDaysAgo(13), reminderTime: '19:30' });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 20));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'reminder')).toBe(false);
  });

  it('invents nothing with no completions in the trailing 30 days', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    expect(generateCoachInsights([h], [], TODAY).some((i) => i.category === 'reminder')).toBe(false);
  });

  it('uses the "move" copy variant when a reminder already exists', () => {
    const h = habit({ createdAt: createdDaysAgo(13), reminderTime: '09:00' });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 20));
    const remind = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reminder')!;
    expect(remind.title).toBe('Move your reminder');
    expect(remind.body).toContain('Meditate reminds you at 9:00 am');
    expect(remind.patch?.reminderTime).toBe('19:30');
  });

  it('resolves a mode-hour tie to the earliest hour (across all habits)', () => {
    const a = habit({ id: 'a1', name: 'Slippery', createdAt: createdDaysAgo(13) });
    const b = habit({ id: 'b1', name: 'Morning Pages', createdAt: createdDaysAgo(13) });
    const entries = [
      ...['2026-09-21', '2026-09-22', '2026-09-23'].map((d) => entry(a.id, d, 1, 20)),
      ...['2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(b.id, d, 1, 8)),
    ];
    const remind = generateCoachInsights([a, b], entries, TODAY).find(
      (i) => i.category === 'reminder' && i.habitId === 'a1',
    )!;
    expect(remind.patch?.reminderTime).toBe('07:30');   // 8 − 30min wins the 3-vs-3 tie
  });
});

describe('coach: habit stacking (spec R2.3)', () => {
  it('stacks against the steadiest habit sharing a scheduled day', () => {
    const a = habit({ id: 'a1', name: 'Slippery', createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });
    const b = habit({ id: 'b1', name: 'Meditate', createdAt: createdDaysAgo(13) });
    const c = habit({ id: 'c1', name: 'Couch Time', createdAt: createdDaysAgo(13) });
    const entries = [
      ...Array.from({ length: 14 }, (_, i) => entry(b.id, addDays('2026-09-21', i))),
      ...['2026-09-21', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']
        .map((d) => entry(c.id, d)),
    ];
    const stack = generateCoachInsights([a, b, c], entries, TODAY).find((i) => i.category === 'stack')!;
    expect(stack.body).toBe('Stack it: do Slippery right after Meditate — your steadiest habit.');
    expect(stack.patch).toBeUndefined();                 // text-only (spec Q2)
    expect(stack.id).toBe('struggle:a1');
  });

  it('needs a shared scheduled weekday', () => {
    const a = habit({ id: 'a1', createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });  // Tue/Thu/Sat
    const c = habit({ id: 'c1', createdAt: createdDaysAgo(13), frequency: [0, 2, 4] });  // Sun/Wed/Fri
    const out = generateCoachInsights([a, c], [], TODAY);
    expect(out.some((i) => i.category === 'stack')).toBe(false);
  });

  it('gives up with only one habit', () => {
    const a = habit({ createdAt: createdDaysAgo(13) });
    expect(generateCoachInsights([a], [], TODAY).some((i) => i.category === 'stack')).toBe(false);
  });

  it('breaks an anchor tie by streak, then alphabetically', () => {
    const a = habit({ id: 'a1', name: 'Slippery', createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });
    const b = habit({ id: 'b1', name: 'Alpha', createdAt: createdDaysAgo(13) });          // rate 5/14, streak 0
    const d = habit({ id: 'd1', name: 'Zen', createdAt: createdDaysAgo(13) });            // rate 5/14, streak 5
    const entries = [
      ...['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].map((x) => entry(b.id, x)),
      ...['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((x) => entry(d.id, x)),
    ];
    const stack = generateCoachInsights([a, b, d], entries, TODAY).find(
      (i) => i.category === 'stack' && i.habitId === 'a1',
    )!;
    expect(stack.body).toContain('after Zen');           // equal rate → higher streak beats the A…Z tiebreak
  });
});
```

Run: 10 fail (categories don't exist yet).

### Implementation — additions to `src/lib/coach.ts`

1. Import line 2 gains the streak primitive; add lookup constants:

```ts
import { isCompleted, isScheduled } from './stats';
import { habitStreaks } from './streaks';   // ← add (streaks are composed, never recomputed)

const REMIND_LOOKBACK = 30;
const STACK_MIN_SLOTS = 7;
```

2. New helpers (place after `frequencyInsight`):

```ts
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
 *  (spec R2.2). Ties resolve to the earliest hour; no entries → null and the
 *  reminder suggestion stays silent (I3: nothing invented). */
function peakHour(entries: Entry[], today: string): number | null {
  const from = addDays(today, -(REMIND_LOOKBACK - 1));
  const counts = new Map<number, number>();
  for (const e of entries) {
    if (e.date < from || e.date > today) continue;
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

function reminderInsight(habit: Habit, entries: Entry[], today: string): CoachInsight | null {
  const peak = peakHour(entries, today);
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
```

3. Inside `generateCoachInsights`, before the loop, compute streaks once:

```ts
  const streaks = habitStreaks(habits, entries, today);
```

4. Inside the `if (rate !== null)` block, after the frequency push:

```ts
      const remind = reminderInsight(habit, entries, today);
      if (remind) rows.push({ insight: remind, rate });
      const stack = stackInsight(habit, habits, values, streaks, today);
      if (stack) rows.push({ insight: stack, rate });
```

### Gates → commit

`npm test` (481 green) → typecheck → lint → build. Stage `src/lib/coach.ts`, `src/lib/coach.test.ts`, ledger.
**Commit:** `feat(coach): reminder derivation (peak −30min) and habit-stack suggestions`

---

## Task 3 — Engine part 3: success signals (spec R2.4–2.8)

**Files:** `src/lib/coach.ts`, `src/lib/coach.test.ts`

### Tests first (red)

Append to `src/lib/coach.test.ts`:

```ts
describe('coach: level-up (spec R2.4–2.5)', () => {
  it('an easy habit with streak 7 suggests medium', () => {
    const h = habit({ createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const entries = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => entry(h.id, d));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'difficulty')!;
    expect(level.patch?.difficulty).toBe('medium');
    expect(level.body).toBe('7-day streak on Meditate. Ready for Medium?');
    expect(level.id).toBe('levelup:h1:difficulty');
  });

  it('medium needs streak 14 before suggesting hard', () => {
    const h = habit({ createdAt: createdDaysAgo(20), difficulty: 'medium' });
    const entries = ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29',
                     '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => entry(h.id, d));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'difficulty')).toBe(false);
  });

  it('medium with streak 14 suggests hard', () => {
    const h = habit({ createdAt: createdDaysAgo(20), difficulty: 'medium' });
    const entries = Array.from({ length: 14 }, (_, i) => entry(h.id, addDays('2026-09-20', i)));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'difficulty')!;
    expect(level.patch?.difficulty).toBe('hard');
    expect(level.body).toBe('14-day streak on Meditate. Ready for Hard?');
  });

  it('legacy habits (no difficulty stored) read as medium', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 14 }, (_, i) => entry(h.id, addDays('2026-09-20', i)));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'difficulty')!;
    expect(level.patch?.difficulty).toBe('hard');          // undefined → medium → hard (streak 14 ✓)
  });

  it('legacy habits below streak 14 suggest nothing', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 8 }, (_, i) => entry(h.id, addDays('2026-09-26', i)));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'difficulty')).toBe(false);
  });

  it('hard is terminal', () => {
    const h = habit({ createdAt: createdDaysAgo(40), difficulty: 'hard' });
    const entries = Array.from({ length: 30 }, (_, i) => entry(h.id, addDays('2026-09-04', i)));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'difficulty')).toBe(false);
  });

  it('quantity targets bump by 10%', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'quantity', target: 10000, unit: 'steps' });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 10000));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'target')!;
    expect(level.patch?.target).toBe(11000);
    expect(level.body).toBe('10,000 steps for 7 days straight. Try 11,000?');
    expect(level.id).toBe('levelup:h1:target');
  });

  it('drops an empty unit from the quantity copy', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'quantity', target: 10000, unit: '' });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 10000));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'target')!;
    expect(level.body).toBe('10,000 for 7 days straight. Try 11,000?');
  });

  it('timer targets bump to the next whole minute of +10%', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'timer', target: 900 });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 900));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'target')!;
    expect(level.patch?.target).toBe(1020);
    expect(level.body).toBe('7-day streak at 15 minutes. Try 17?');
  });

  it('stays quiet when a timer bump would round to the current value', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'timer', target: 90 });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 90));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'target')).toBe(false);
  });
});

describe('coach: rewards (spec R2.6–2.8)', () => {
  it('fires a streak milestone at exactly 7', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i)));
    const ms = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reward-streak')!;
    expect(ms.id).toBe('reward:h1:streak:7');
    expect(ms.body).toBe(`7 days of Meditate in a row. That's a habit now.`);
  });

  it('stays silent at streak 8 (milestones fire exactly)', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 8 }, (_, i) => entry(h.id, addDays('2026-09-26', i)));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'reward-streak')).toBe(false);
  });

  it('fires a perfect day when every scheduled habit is done today', () => {
    const a = habit({ id: 'a1', name: 'Meditate', createdAt: createdDaysAgo(13) });
    const b = habit({ id: 'b1', name: 'Read', createdAt: createdDaysAgo(13) });
    const entries = [entry('a1', TODAY), entry('b1', TODAY)];
    const out = generateCoachInsights([a, b], entries, TODAY);
    expect(out.find((i) => i.category === 'reward-day')).toMatchObject({
      id: `reward:perfectday:${TODAY}`,
      body: 'Every habit checked off today. Perfect day.',
    });
  });

  it('stays silent while one habit is still open', () => {
    const a = habit({ id: 'a1', createdAt: createdDaysAgo(13) });
    const b = habit({ id: 'b1', createdAt: createdDaysAgo(13) });
    const entries = [entry('a1', TODAY)];
    expect(generateCoachInsights([a, b], entries, TODAY).some((i) => i.category === 'reward-day')).toBe(false);
  });

  it('stays silent when nothing is scheduled today', () => {
    const h = habit({ createdAt: createdDaysAgo(13), frequency: [1] });   // Mondays only
    const entries = [entry('h1', TODAY)];
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'reward-day')).toBe(false);
  });

  it('encourages at two more completions than last week', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',          // last week: 3
                     '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01', '2026-10-02'].map((d) => entry(h.id, d));   // this week: 5
    const out = generateCoachInsights([h], entries, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'encourage:2026-09-28',
      body: 'You logged 2 more completions than last week. Keep that going.',
    });
  });

  it('stays silent at only one more completion than last week', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',          // last week: 3
                     '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01'].map((d) => entry(h.id, d));          // this week: 4
    expect(generateCoachInsights([h], entries, TODAY)).toEqual([]);
  });
});
```

Run: 17 fail (categories/ids not implemented yet).

### Implementation — additions to `src/lib/coach.ts`

1. **Imports** — extend the two existing lines:

```ts
import { addDays, mondayOf, weekdayIndex } from './dates';
import { buildDayStats, completionRate, isCompleted, isScheduled, weekWindows } from './stats';
```

2. **Constants** (after the struggle constants):

```ts
// Spec R1 success rules — level-ups need a real streak AND a strong week.
const LEVELUP_MIN_STREAK = 7;
const LEVELUP_HARD_STREAK = 14;
const LEVELUP_RATE = 0.8;
const MILESTONES = [7, 14, 30, 50, 100, 200, 365];
const ENCOURAGE_DELTA = 2;
```

3. **New generators** (after `stackInsight`):

```ts
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
```

4. **Loop** — replace the two Task-3 comment lines inside/outside the habit loop with:

```ts
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
```

(`rate: 0` marks non-struggle rows as irrelevant to Task 4's worst-first rule —
they never compare against rank-0 rows.)

### Gates → commit

`npm test` (498 green) → typecheck → lint → build. Stage `src/lib/coach.ts`, `src/lib/coach.test.ts`, ledger.
**Commit:** `feat(coach): level-up, milestone, perfect-day and encouragement signals`

---

## Task 4 — Engine part 4: ranking + dismissal storage (spec R1 I1/I4, dismissal contract)

**Files:** `src/lib/coach.ts`, `src/lib/coach.test.ts`

### Tests first (red)

Append to `src/lib/coach.test.ts`; extend the vitest import to
`import { beforeEach, describe, expect, it } from 'vitest';` and the coach import to
`import { dismissSuggestion, generateCoachInsights, liveDismissals, visibleInsights } from './coach';`.

```ts
describe('coach: ranking + determinism (spec R1 I1/I4)', () => {
  it('orders struggle → level-up → reward → encouragement', () => {
    // s1: 0/14 struggling; reminder pre-set so the global peak (12:00 from
    // l1's entries) equals it and stays silent — ids stay predictable.
    const s = habit({ id: 's1', name: 'Slippery', createdAt: createdDaysAgo(13), reminderTime: '11:30' });
    const l = habit({ id: 'l1', name: 'Lifter', createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('l1', addDays('2026-09-27', i)));
    const ids = generateCoachInsights([s, l], entries, TODAY).map((i) => i.id);
    expect(ids).toEqual([
      'struggle:s1',             // frequency (rate 0, first category)
      'struggle:s1',             // stack against l1 (≥7 slots, shared days)
      'levelup:l1:difficulty',   // rank 1
      'reward:l1:streak:7',      // rank 2
      'encourage:2026-09-28',    // rank 3
    ]);
  });

  it('orders struggling habits worst-rate first', () => {
    const a = habit({ id: 'a1', name: 'Never', createdAt: createdDaysAgo(13) });       // 0%
    const b = habit({ id: 'b1', name: 'Sometimes', createdAt: createdDaysAgo(13) });   // 6/14 = 43%
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry('b1', d));
    // Input order deliberately reversed — only the rate sort can fix it.
    const freqOrder = generateCoachInsights([b, a], entries, TODAY)
      .filter((i) => i.category === 'frequency').map((i) => i.habitId);
    expect(freqOrder).toEqual(['a1', 'b1']);
  });

  it('within a rank, categories follow catalog order (difficulty before target)', () => {
    const e = habit({ id: 'e1', name: 'Stretch', createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const q = habit({ id: 'q1', name: 'Steps', createdAt: createdDaysAgo(20),
                      type: 'quantity', target: 1000, unit: 'steps' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('e1', addDays('2026-09-27', i), 1))
      .concat(Array.from({ length: 7 }, (_, i) => entry('q1', addDays('2026-09-27', i), 1000)));
    const ids = generateCoachInsights([q, e], entries, TODAY).map((i) => i.id);   // input reversed
    expect(ids.indexOf('levelup:e1:difficulty')).toBeLessThan(ids.indexOf('levelup:q1:target'));
  });

  it('same inputs return deep-equal output (I1)', () => {
    const s = habit({ id: 's1', name: 'Slippery', createdAt: createdDaysAgo(13), reminderTime: '11:30' });
    const l = habit({ id: 'l1', name: 'Lifter', createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('l1', addDays('2026-09-27', i)));
    const run = () => generateCoachInsights([s, l], entries, TODAY);
    expect(run()).toEqual(run());
  });
});

describe('coach: dismissal storage (7-day TTL, spec §4)', () => {
  beforeEach(() => localStorage.clear());

  it('treats corrupt storage as empty', () => {
    localStorage.setItem('habibit:coach-dismissals', '{not json');
    expect(liveDismissals()).toEqual({});
  });

  it('dismissSuggestion records the id with a timestamp', () => {
    const now = Date.now();
    dismissSuggestion('struggle:h1', now);
    expect(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!))
      .toEqual({ 'struggle:h1': now });
  });

  it('prunes expired dismissals on write', () => {
    const now = Date.now();
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({
      old: now - 8 * 86_400_000, fresh: now - 86_400_000,
    }));
    dismissSuggestion('new:id', now);
    expect(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!))
      .toEqual({ fresh: now - 86_400_000, 'new:id': now });
  });

  it('liveDismissals drops expired entries', () => {
    const now = Date.now();
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({
      old: now - 8 * 86_400_000, fresh: now - 86_400_000,
    }));
    expect(liveDismissals(now)).toEqual({ fresh: now - 86_400_000 });
  });

  it('visibleInsights hides fresh dismissals and brings expired ones back', () => {
    const now = Date.now();
    const insights = ['a', 'b'].map((id) => ({
      id, kind: 'struggle' as const, category: 'frequency' as const,
      habitId: id, title: 't', body: 'b',
    }));
    expect(visibleInsights(insights, { a: now - 1000, b: now - 8 * 86_400_000 }, now).map((i) => i.id))
      .toEqual(['b']);
  });
});
```

Run: 9 fail (sort absent; helpers don't exist yet).

### Implementation — additions to `src/lib/coach.ts`

1. **Catalog order + rank** (top of file, after the `CoachInsight` interface):

```ts
// Catalog order from spec §4 — the tiebreaker inside a rank band.
const CATEGORY_ORDER: Record<CoachCategory, number> = {
  frequency: 0, reminder: 1, stack: 2, difficulty: 3, target: 4,
  'reward-streak': 5, 'reward-day': 6, encouragement: 7,
};

/** Struggle (0) > level-up (1) > reward (2) > encouragement (3) — spec §3 ranking. */
const rankOf = (c: CoachCategory): number =>
  c === 'encouragement' ? 3 : CATEGORY_ORDER[c] >= 5 ? 2 : CATEGORY_ORDER[c] >= 3 ? 1 : 0;
```

2. **Sort before returning** in `generateCoachInsights` (replaces the "Task 4 sorts" comment):

```ts
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
```

3. **Dismissal storage** (append after `generateCoachInsights` — UI-layer helpers,
   kept out of the engine function itself per I1):

```ts
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
```

### Gates → commit

`npm test` (507 green) → typecheck → lint → build. Stage `src/lib/coach.ts`, `src/lib/coach.test.ts`, ledger.
**Commit:** `feat(coach): ranked assembly and 7-day dismissal storage`

---

## Task 5 — CoachSection + shared CoachRow (spec R4.3)

**Files:** `src/components/CoachSection.tsx` (new), `src/components/CoachSection.test.tsx` (new)

### Tests first (red)

`src/components/CoachSection.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listHabits, putHabit } from '@/lib/repo';
import type { CoachInsight } from '@/lib/coach';
import type { Habit } from '@/lib/types';
import { CoachSection } from './CoachSection';

const mk = (id: string, category: CoachInsight['category'], kind: CoachInsight['kind'],
            over: Partial<CoachInsight> = {}): CoachInsight => ({
  id, kind, category, habitId: 'h1', title: `${category} title`, body: `body for ${id}`, ...over,
});

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); localStorage.clear(); });

describe('CoachSection', () => {
  it('renders nothing when there is nothing to show', () => {
    render(<CoachSection habits={[]} insights={[]} />);
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument();
  });

  it('splits insights into the three exact group headings (spec R3)', () => {
    render(<CoachSection habits={[]} insights={[
      mk('struggle:h1', 'frequency', 'struggle'),
      mk('levelup:h1:difficulty', 'difficulty', 'success'),
      mk('encourage:2026-09-28', 'encouragement', 'success'),
    ]} />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Needs attention', 'Level up', 'Celebrate']);
    expect(headings[0].parentElement).toHaveTextContent('body for struggle:h1');
    expect(headings[1].parentElement).toHaveTextContent('body for levelup:h1:difficulty');
    expect(headings[2].parentElement).toHaveTextContent('body for encourage:2026-09-28');
  });

  it('caps the list at six insights (spec R3)', () => {
    const insights = Array.from({ length: 8 }, (_, i) =>
      mk(`struggle:h${i}`, 'frequency', 'struggle', { habitId: `h${i}` }));
    render(<CoachSection habits={[]} insights={insights} />);
    expect(screen.getAllByRole('button', { name: 'Dismiss suggestion' })).toHaveLength(6);
  });

  it("applies a row's patch through putHabit", async () => {
    const h = habit();
    await putHabit(h);
    render(<CoachSection habits={[h]} insights={[
      mk('struggle:h1', 'frequency', 'struggle', { patch: { frequency: [1] } }),
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(async () => {
      expect((await listHabits())[0].frequency).toEqual([1]);
    });
  });

  it('dismiss removes just that row and records its id', () => {
    render(<CoachSection habits={[]} insights={[
      mk('struggle:h1', 'frequency', 'struggle'),
      mk('levelup:h1:target', 'target', 'success'),
    ]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss suggestion' })[0]);
    expect(screen.queryByText('body for struggle:h1')).not.toBeInTheDocument();
    expect(screen.getByText('body for levelup:h1:target')).toBeInTheDocument();
    expect(Object.keys(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!)))
      .toEqual(['struggle:h1']);
  });

  it('hides the whole section when every insight is dismissed', () => {
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({ 'struggle:h1': Date.now() }));
    const { container } = render(<CoachSection habits={[]} insights={[
      mk('struggle:h1', 'frequency', 'struggle'),
    ]} />);
    expect(container.textContent).toBe('');
  });
});
```

Run: fails (no `./CoachSection`).

### Implementation — `src/components/CoachSection.tsx`

```tsx
'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { dismissSuggestion, liveDismissals, visibleInsights } from '@/lib/coach';
import type { CoachInsight } from '@/lib/coach';
import { putHabit } from '@/lib/repo';
import { reportWriteError } from '@/lib/writeError';
import type { Habit } from '@/lib/types';

const GROUPS: Array<{ heading: string; match: (i: CoachInsight) => boolean }> = [
  { heading: 'Needs attention', match: (i) => i.kind === 'struggle' },
  { heading: 'Level up', match: (i) => i.category === 'difficulty' || i.category === 'target' },
  { heading: 'Celebrate', match: (i) =>
      i.category === 'reward-streak' || i.category === 'reward-day' || i.category === 'encouragement' },
];

/** One suggestion row — shared by CoachSection and CoachCard (coach spec §3).
 *  py-2.5 on the row keeps the whole row ≥40px; the Apply and dismiss controls
 *  are h-10 (40px) per the house tap-target rule (tapTargets.test.ts pins both). */
export function CoachRow({ insight, applying, onApply, onDismiss }: {
  insight: CoachInsight;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{insight.title}</p>
        <p className="text-sm text-[var(--color-subtle)]">{insight.body}</p>
        {insight.patch && (
          <button type="button" onClick={onApply} disabled={applying}
                  className="btn-primary mt-2 h-10 px-4 text-sm">
            Apply
          </button>
        )}
      </div>
      <button type="button" aria-label="Dismiss suggestion" onClick={onDismiss}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-muted)]">
        <X size={16} />
      </button>
    </div>
  );
}

export function CoachSection({ insights, habits }: { insights: CoachInsight[]; habits: Habit[] }) {
  const [dismissed, setDismissed] = useState(() => liveDismissals());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // Cap across the whole list before grouping (spec R3: 6 rows max).
  const visible = visibleInsights(insights, dismissed).slice(0, 6);

  const apply = async (insight: CoachInsight) => {
    if (!insight.patch || !insight.habitId) return;      // text-only rows have no Apply
    const habit = habits.find((h) => h.id === insight.habitId);
    if (!habit) return;
    setApplyingId(insight.id);
    try {
      await putHabit({ ...habit, ...insight.patch });
    } catch (err) {
      reportWriteError(err);                             // shared banner (spec R4.3)
    } finally {
      setApplyingId(null);
    }
  };

  const dismiss = (id: string) => {
    dismissSuggestion(id);                               // persists + prunes (7-day TTL)
    setDismissed(liveDismissals());                      // immediate hide
  };

  if (visible.length === 0) return null;

  return (
    <div>
      {GROUPS.map(({ heading, match }) => {
        const rows = visible.filter(match);
        if (rows.length === 0) return null;              // empty groups render nothing
        return (
          <div key={heading}>
            <h2 className="mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
              {heading}
            </h2>
            <div className="glass-card px-4 py-1">
              {rows.map((insight, i) => (
                // `-i` disambiguates ids that legitimately repeat (all three
                // struggle categories share struggle:{habitId} — dismissing
                // one dismisses the whole struggle, spec I4).
                <CoachRow key={`${insight.id}-${i}`} insight={insight}
                          applying={applyingId === insight.id}
                          onApply={() => void apply(insight)}
                          onDismiss={() => dismiss(insight.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

Markup constraints (keep forever — they are what keeps existing screen tests green):
no `gap-6`, no `xl:grid-cols-4`, no `font-display`, no `md:columns-2`.

### Gates → commit

`npm test` (513 green, 51 files) → typecheck → lint → build.
Stage `src/components/CoachSection.tsx`, `src/components/CoachSection.test.tsx`, ledger.
**Commit:** `feat(coach): CoachSection groups suggestions in Insights`

---

## Task 6 — CoachCard (spec R4.2)

**Files:** `src/components/CoachCard.tsx` (new), `src/components/CoachCard.test.tsx` (new)

### Tests first (red)

`src/components/CoachCard.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, listHabits, putHabit } from '@/lib/repo';
import { addDays, todayKey } from '@/lib/dates';
import type { CoachInsight } from '@/lib/coach';
import type { Habit } from '@/lib/types';
import { CoachCard } from './CoachCard';

const insight = (over: Partial<CoachInsight> = {}): CoachInsight => ({
  id: 'struggle:h1',
  kind: 'struggle',
  category: 'frequency',
  habitId: 'h1',
  title: 'Lighten the schedule',
  body: 'Meditate is slipping — 3 of 14 scheduled days. Trim Saturday and Friday?',
  patch: { frequency: [0, 1, 2, 3, 4] },
  ...over,
});

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); localStorage.clear(); });

describe('CoachCard', () => {
  it('renders nothing when there are no insights', () => {
    render(<CoachCard insights={[]} habits={[]} date={todayKey()} />);
    expect(screen.queryByRole('region', { name: 'Coach' })).not.toBeInTheDocument();
  });

  it('shows only the first visible insight', () => {
    render(<CoachCard insights={[
      insight(),
      insight({ id: 'struggle:h1:stack', category: 'stack', title: 'Stack it', patch: undefined }),
    ]} habits={[]} date={todayKey()} />);
    expect(screen.getByText('Lighten the schedule')).toBeInTheDocument();
    expect(screen.queryByText('Stack it')).not.toBeInTheDocument();
  });

  it('skips insights dismissed earlier (spec §4)', () => {
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({ 'struggle:h1': Date.now() }));
    render(<CoachCard insights={[
      insight(),
      insight({ id: 'levelup:h1:difficulty', category: 'difficulty', kind: 'success', title: 'Level up' }),
    ]} habits={[]} date={todayKey()} />);
    expect(screen.queryByText('Lighten the schedule')).not.toBeInTheDocument();
    expect(screen.getByText('Level up')).toBeInTheDocument();
  });

  it('applies the patch through putHabit (one-tap, spec Q2)', async () => {
    const h = habit();
    await putHabit(h);
    render(<CoachCard insights={[insight()]} habits={[h]} date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(async () => {
      expect((await listHabits())[0].frequency).toEqual([0, 1, 2, 3, 4]);
    });
  });

  it('disables Apply while the write is in flight', async () => {
    const h = habit();
    await putHabit(h);
    const repo = await import('@/lib/repo');
    vi.spyOn(repo, 'putHabit').mockImplementation(() => new Promise<Habit>(() => { /* pending */ }));
    render(<CoachCard insights={[insight()]} habits={[h]} date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    vi.restoreAllMocks();
  });

  it('routes a failed apply to the shared write-error banner (spec R4.2)', async () => {
    const h = habit();
    await putHabit(h);
    const repo = await import('@/lib/repo');
    const spy = vi.spyOn(repo, 'putHabit').mockRejectedValue(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { NavShell } = await import('./NavShell');
    render(<NavShell><CoachCard insights={[insight()]} habits={[h]} date={todayKey()} /></NavShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByTestId('write-error')).toHaveTextContent(/couldn't save that change/i);
    spy.mockRestore();
    vi.restoreAllMocks();
  });

  it('dismiss hides the insight and persists the id for 7 days (spec §4)', () => {
    render(<CoachCard insights={[insight()]} habits={[]} date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss suggestion' }));
    expect(screen.queryByRole('region', { name: 'Coach' })).not.toBeInTheDocument();
    expect(Object.keys(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!)))
      .toEqual(['struggle:h1']);
  });

  it('never renders for a non-today date (spec R4.2)', () => {
    render(<CoachCard insights={[insight()]} habits={[]} date={addDays(todayKey(), -1)} />);
    expect(screen.queryByRole('region', { name: 'Coach' })).not.toBeInTheDocument();
  });

  it('text-only suggestions render no Apply button (spec Q2)', () => {
    render(<CoachCard insights={[insight({ category: 'stack', patch: undefined })]}
                      habits={[]} date={todayKey()} />);
    expect(screen.getByRole('region', { name: 'Coach' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });
});
```

Run: fails (no `./CoachCard`).

### Implementation — `src/components/CoachCard.tsx`

```tsx
'use client';

import { useState } from 'react';
import { todayKey } from '@/lib/dates';
import { liveDismissals, visibleInsights } from '@/lib/coach';
import type { CoachInsight } from '@/lib/coach';
import { putHabit } from '@/lib/repo';
import { reportWriteError } from '@/lib/writeError';
import type { Habit } from '@/lib/types';
import { CoachRow } from './CoachSection';

/** Home check-in surface (coach spec §3/R4.2): one priority suggestion,
 *  today-only, one-tap apply, dismiss persisted to localStorage.
 *  The parent screens own the generateCoachInsights useMemo — this component
 *  only renders what it is handed. */
export function CoachCard({ insights, habits, date }: {
  insights: CoachInsight[];
  habits: Habit[];
  date: string;
}) {
  const [dismissed, setDismissed] = useState(() => liveDismissals());
  const [applying, setApplying] = useState(false);
  const top = visibleInsights(insights, dismissed)[0];

  if (date !== todayKey() || !top) return null;          // past/future browsing → no coach

  const apply = async () => {
    if (!top.patch || !top.habitId) return;
    const habit = habits.find((h) => h.id === top.habitId);
    if (!habit) return;
    setApplying(true);
    try {
      await putHabit({ ...habit, ...top.patch });        // engine re-runs via live query
    } catch (err) {
      reportWriteError(err);                             // NavShell banner (spec R4.2)
    } finally {
      setApplying(false);
    }
  };

  const dismiss = () => {
    dismissSuggestion(top.id);
    setDismissed(liveDismissals());
  };

  return (
    <section aria-label="Coach" className="glass-card mb-3 px-4 py-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Coach</p>
      <CoachRow insight={top} applying={applying} onApply={() => void apply()} onDismiss={dismiss} />
    </section>
  );
}
```

Notes: the label is a `<p>`, never a heading — Home's `getAllByRole('heading', { level: 2 })`
test must keep seeing only category headings. `dismissSuggestion` needs importing:
add it to the coach value import (`dismissSuggestion, liveDismissals, visibleInsights`).

### Gates → commit

`npm test` (522 green, 52 files) → typecheck → lint → build.
Stage `src/components/CoachCard.tsx`, `src/components/CoachCard.test.tsx`, ledger.
**Commit:** `feat(coach): CoachCard brings one priority suggestion to the daily check-in`

---

## Task 7 — Wire both surfaces + tap-target pin (spec R3/R4)

**Files:** `src/components/HomeScreen.tsx`, `src/components/InsightsScreen.tsx`,
`src/components/HomeScreen.test.tsx`, `src/components/InsightsScreen.test.tsx`,
`src/components/tapTargets.test.ts`

### Tests first (red)

Append to `src/components/tapTargets.test.ts` (inside its top-level describe):

```ts
  it('coach rows keep py-2.5 and ≥40px controls (coach spec R3)', () => {
    // CoachRow is defined in CoachSection.tsx and shared by both surfaces.
    const s = src('CoachSection.tsx');
    expect(s).toContain('py-2.5');
    expect(s).toContain('btn-primary mt-2 h-10 px-4 text-sm');   // Apply = 40px
    expect(s).toMatch(/aria-label="Dismiss suggestion"[\s\S]{0,240}h-10 w-10/);
  });
```

Append to `src/components/HomeScreen.test.tsx` (new describe at end of file):

```tsx
// Coach spec R3: the card sits between the streak strip and the habit list,
// today-only.
describe('coach card (coach spec R3)', () => {
  const struggleHabit = () => habit({
    id: 'slip-1', name: 'Slippery',
    createdAt: Date.parse(`${addDays(todayKey(), -10)}T00:00:00`),   // 11 slots, 0 hits → struggle
  });

  it('renders between the streak strip and the habit list on today', async () => {
    await putHabit(struggleHabit());
    render(<HomeScreen date={todayKey()} />);
    const strip = await screen.findByRole('region', { name: 'Streak summaries' });
    const coach = await screen.findByRole('region', { name: 'Coach' });
    const matches = await screen.findAllByText('Slippery');
    const row = matches[matches.length - 1];              // the habit row (strip copy comes first)
    expect(strip.compareDocumentPosition(coach) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(coach.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stays off a past date', async () => {
    await putHabit(struggleHabit());
    render(<HomeScreen date={addDays(todayKey(), -1)} />);
    await screen.findAllByText('Slippery');
    expect(screen.queryByRole('region', { name: 'Coach' })).not.toBeInTheDocument();
  });
});
```

Append to `src/components/InsightsScreen.test.tsx` (new describe at end of file):

```tsx
// Coach spec R3: groups render directly after Year stats, before By intention.
describe('coach section (coach spec R3)', () => {
  it('shows coach groups after the Year stats block', async () => {
    await putHabit(habit({
      id: 'slip-1', name: 'Slippery',
      createdAt: Date.parse(`${addDays(todayKey(), -10)}T00:00:00`),
    }));
    render(<InsightsScreen />);
    const group = await screen.findByRole('heading', { name: 'Needs attention' }, WAIT);
    const yearStats = screen.getByText('Year stats');
    const byIntention = screen.getByText('By intention');
    expect(yearStats.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group.compareDocumentPosition(byIntention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
```

Run: all 4 fail (surfaces not wired; pin absent).

### Implementation

**`src/components/HomeScreen.tsx`:**

1. Imports:
```tsx
import { generateCoachInsights } from '@/lib/coach';
import { CoachCard } from './CoachCard';
```

2. After the `overallStreak` memo:
```tsx
  // Coach spec R3: one engine pass per data change. Other browsed dates skip
  // the pass entirely — their entry range is truncated and would mislead.
  const coach = useMemo(
    () => (habits && entries && date === today ? generateCoachInsights(habits, entries, today) : []),
    [habits, entries, date, today],
  );
```

3. After the `StreakStrip` block, before the habit-list conditional:
```tsx
      {habits !== undefined && entries !== undefined && habits.length > 0 && (
        <CoachCard insights={coach} habits={habits} date={date} />
      )}
```

**`src/components/InsightsScreen.tsx`:**

1. Imports:
```tsx
import { generateCoachInsights } from '@/lib/coach';
import { CoachSection } from './CoachSection';
```

2. After the `trend` memo (before the early `Loading…` return):
```tsx
  // Coach spec R3: allEntries spans minYear → today — the full windows the
  // engine needs (14/30/7 days + both week windows), year-independent.
  const coach = useMemo(
    () => generateCoachInsights(habits ?? [], allEntries ?? [], today),
    [habits, allEntries, today],
  );
```

3. After the Year-stats grid closes, before the `§10` comment above the By-intention grid:
```tsx
      <CoachSection insights={coach} habits={habits ?? []} />
```

### Predicted re-anchors (verify, don't guess)

| Existing test | Why it could touch the coach | Prediction |
|---|---|---|
| Home `groups habits by category` (`getAllByRole heading level 2`) | 0-entry fixtures struggle → card renders | **no change** — the card label is a `<p>` |
| Home masonry `grid.querySelectorAll('section')` = 2 | card is a `<section>` | **no change** — card renders outside the columns grid |
| Home `first .max-w-3xl` | card shell | **no change** — card uses `glass-card` only |
| Home `renderToString` SSR asserts | coach touches localStorage | **no change** — SSR renders `habits = []`, card never mounts |
| Insights `first [class*="gap-6"]` | CoachSection sits before the grid | **no change** — coach markup avoids `gap-6` |
| Insights `[class*="xl:grid-cols-4"]` = 2 | coach group lists | **no change** — coach avoids that class |
| Insights `.glass-card > 0`, `.font-display` null/not-null | coach uses `glass-card` | **no change** (`> 0` still true); coach never uses `font-display` |
| Any `findByText` exacts | coach bodies are long sentences | **no change** — exact-match queries can't collide |

If anything still fails: determine whether it is a genuine engine bug (fix the
code) or a fixture that now legitimately shows a coach surface (rewrite the
assertion to the new expectation — never loosen). Log every re-anchor in the ledger.

### Gates → commit

`npm test` (526 green, 52 files) → typecheck → lint → build.
Stage `src/components/HomeScreen.tsx`, `src/components/InsightsScreen.tsx`,
`src/components/HomeScreen.test.tsx`, `src/components/InsightsScreen.test.tsx`,
`src/components/tapTargets.test.ts`, ledger.
**Commit:** `feat(coach): wire both surfaces and pin the coach tap targets`

---

## Task 8 — Docs + V5/V6 verification

**Files:** `docs/superpowers/specs/2026-09-23-habibit-design.md`, `README.md`, ledger.

### Docs first

**Master spec** — insert `### 4.6 Adaptive coach (src/lib/coach.ts)` immediately
before `## 5. Today view` (line 128):

```markdown
### 4.6 Adaptive coach (`src/lib/coach.ts`)

Rule-based (no LLM, no network, no API) suggestion engine over the same
completion data stats uses. Struggling habits (14-day rate < 50% or three
missed scheduled days, ≥ 6 slots) get frequency-trim, reminder-time and
habit-stacking suggestions; succeeding habits (streak ≥ 7, strong week) get
level-up nudges, streak milestones, perfect-day and momentum notes.
Surfaces: one priority card on Today (today only, between the streak strip
and the habit list) and grouped rows in Stats after the year tiles
(`Needs attention` / `Level up` / `Celebrate`, 6-item cap). Structured
suggestions carry a one-tap `patch` applied via the existing `putHabit`
write path; dismissals live in `localStorage['habibit:coach-dismissals']`
(7-day TTL — device-local, like the theme: export/import/reset untouched).
Full rules and copy: `docs/superpowers/specs/2026-10-04-adaptive-coach-design.md`.
```

**README** — two edits:

1. In `## What's in the box`, after the Stats bullet:
```markdown
- **Coach** — reads your rhythm and nudges: trim a slipping habit, move a reminder, stack a habit, level up, celebrate a streak.
```
2. `### src/ map` row: `| \`src/lib/\` | The brains: dates, streaks, stats, coach, seed data, Dexie repo |`

### V5 — browser verification (real browser, prod build)

Restart the prod server against the fresh build (kill the old PID first if
port 3000 is taken — `EADDRINUSE` precedent):

1. **Surfaces render.** Open `http://localhost:3000/today` — no console errors;
   open `/stats` — no console errors.
2. **Natural success path.** On `/today`, the demo seed should surface a
   level-up (Read carries an 18-day streak with no stored difficulty →
   `18-day streak on Read. Ready for Hard?`). Verify the card shows **one**
   suggestion, click **Apply**, and confirm the difficulty now reads Hard in
   the edit form. If the seed's 7-day rate doesn't qualify at verification
   time, follow whichever natural suggestion *does* appear instead and note it.
3. **Struggle path (synthetic).** Settings → Export → edit the JSON: delete
   every `entry` for one habit (e.g. Meditate) → Import. Expect the Home card
   to show `Lighten the schedule` (`0 of 14 scheduled days`) and Insights to
   show a `Needs attention` group. Click **Apply** → the habit's schedule in
   the edit form shows the trimmed weekdays.
4. **Dismiss contract.** Click ✕ → suggestion disappears; `localStorage`
   contains `habibit:coach-dismissals` with the `struggle:{id}` key; reload →
   still hidden. Wait is not needed for TTL; instead pre-age the timestamp to
   8 days in devtools and reload → suggestion is back.
5. **Today-only.** Browse `/today/<yesterday>` → no Coach card.
6. **A11y/tone.** Tab reaches Apply then ✕ with a visible focus ring; both
   controls measure ≥ 40px (inspect); dark + light both legible; 360px
   viewport: no horizontal scroll, no overlap; suggestion conveyed by copy,
   not color alone.

### V6 — regression sweep

1. Reset data → empty app still works; `habibit:coach-dismissals` **survives**
   (device-local, theme-class — spec §4).
2. Export → import roundtrip unaffected by the coach (no schema change).
3. Completion toggle still raises the toast; forced write failure still shows
   the shared banner (unit-covered, spot-check in browser).
4. Full gates one final time: `npm test` (526) → `typecheck` → `lint` → `build`.

### Gates → commit

Record every V5/V6 observation in the ledger (what was seen, what differed,
re-anchors, deviations). Stage master spec, README, ledger.
**Commit:** `docs(coach): master spec §4.6 + README coach blurb`

---

## Done means

- All 8 tasks committed, 526 tests green, tsc/lint/build clean.
- Both surfaces verified in the browser per V5/V6, observations in the ledger.
- Zero deviations unlogged; any copy/threshold change escalated as a spec change.

## Out of scope (spec §8 — do not build)

Difficulty-downgrade suggestions, notification/OS reminders, dismiss-on-apply,
LLM/remote calls, coach config UI, changes to schema/export/import/reset.
