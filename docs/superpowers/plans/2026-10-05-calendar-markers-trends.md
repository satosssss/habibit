# Calendar Markers & Insights Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add past-day missed and streak-break markers to the Calendar, and three live trend charts (streak growth, consistency, behavioral patterns) to Insights — all derived from existing user logs.

**Architecture:** A new pure derivation layer (`src/lib/trends.ts`) whose `streakSeries` is the single source of truth for both the calendar's break markers and the growth chart; two stateless chart primitives (`TrendChart` SVG line, `PatternBars` div bars) composed by `TrendsSection` on Insights. Calendar widens its entries window to `allTimeStart` (the Insights precedent) so runs entering a month are visible. Everything recomputes through the existing `useLiveQuery` memos — no DB, export/import, dependency, or token changes.

**Tech Stack:** Next.js 15 App Router (client components), React 19, TypeScript, Tailwind v4 tokens, vitest + Testing Library + jest-dom, `lucide-react` (existing `X` icon), Dexie live queries (existing).

**Spec:** `docs/superpowers/specs/2026-10-05-calendar-markers-trends-design.md` (approved; R1–R8 are the requirements this plan implements).

## Global Constraints

- **No new dependencies; no DB schema, export, import, or reset changes; no new color tokens** — only `--color-accent`, `--color-accent-ink`, `--color-subtle`, `--color-line`.
- **Missed/break markers are past-only**: today and future days never imply failure (spec Q1, R1.4).
- One marker per cell; a break replaces the missed dash (R1.2); consecutive misses mark only the first day (R1.3).
- Shape + text, never color-alone; cells stay ≥44×44; no glow/pulse; AA contrast (existing `globals`/a11y tests must stay green).
- Lint baseline: **exactly 3 warnings** (TimerModal.tsx + 2× stats.test.ts). New warnings fail the gate.
- Suite baseline before this work: **529 tests / 52 files**; 4 new test files → 56 at the end.
- Gates before **every** commit: `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
- Never stage `.opencode/` or `opencode.json`.
- Dated specs stay historical: slice-E §7 R5 is amended by the 2026-10-05 spec — do not edit it.

## Review Focus

Spec-implied conditions most likely to bite a person using this software, each pinned to the task that owns the code:

1. **Today looks exactly like a missed past day** (due, nothing done) — it must stay pending, never missed/break. → Task 2, "never marks today as missed while it is still pending".
2. **A streak entering January must render at full value on Jan 1** — building the window at `yearStart` instead of `allTimeStart` would silently lie the chart low. → Task 6, "annotates the longest run, counting a streak that entered the year from December".
3. **The new Trends grid also matches `div[class*="gap-6"]`** and precedes the intention/heatmap grid, silently breaking the existing layout test's selector. → Task 7, rewritten selector step (whole suite must stay green).
4. **Zero-slot weeks vs zero-rate weeks**: no scheduled habits must be a gap (`null`), slots-but-nothing-done must draw at 0% — conflating them either invents failure or hides it. → Task 3, weeklyRates tests pin `rate === null` vs `rate === 0`.
5. **Break detection needs history before the visible month** — a run entering the month that dies inside it must still mark the break. → Task 2, "counts a streak that entered the month from before it".

---

### Task 1: `streakSeries` (forward mirror of `currentStreak`)

**Files:**
- Create: `src/lib/trends.ts`
- Test: `src/lib/trends.test.ts`

**Interfaces:**
- Consumes: `DayStat`, `currentStreak`, `buildDayStats` from `src/lib/stats.ts` (already exist).
- Produces: `export type SeriesPoint = { date: string; streak: number; broke: number | null }` and `export function streakSeries(stats: Map<string, DayStat>, today: string): SeriesPoint[]` — Tasks 2 and 6 consume both.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/trends.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from './types';
import { buildDayStats, currentStreak } from './stats';
import { streakSeries } from './trends';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const entry = (habitId: string, date: string, value: number): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

describe('streakSeries', () => {
  it('grows the run per active day and stops at today', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1), entry('h1', '2026-09-23', 1)],
      { from: '2026-09-15', to: '2026-09-30' }, // stats run past today…
    );
    const series = streakSeries(stats, '2026-09-23');      // …the series must not
    expect(series.at(-1)).toEqual({ date: '2026-09-23', streak: 3, broke: null });
    expect(series.find((p) => p.date === '2026-09-22')!.streak).toBe(2);
    expect(series.find((p) => p.date === '2026-09-21')!.streak).toBe(1);
    expect(series.some((p) => p.date > '2026-09-23')).toBe(false);
  });

  it('records the broken run length on the first missed day only', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-20', 1), entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-26' },
    );
    const series = streakSeries(stats, '2026-09-26');
    const at = (d: string) => series.find((p) => p.date === d)!;
    expect(at('2026-09-23')).toEqual({ date: '2026-09-23', streak: 0, broke: 3 }); // first miss closes the 3-day run
    expect(at('2026-09-24').broke).toBeNull();                                     // consecutive misses stay plain
    expect(at('2026-09-24').streak).toBe(0);
    expect(at('2026-09-26').broke).toBeNull();                                     // today (grace) never breaks
  });

  it('holds the run across unscheduled gaps', () => {
    const weekdays = habit({ id: 'w', frequency: [1, 2, 3, 4, 5] }); // Mon–Fri
    const stats = buildDayStats(
      [weekdays],
      [entry('w', '2026-09-18', 1), entry('w', '2026-09-21', 1)],    // Fri + Mon (2026-09-21 is a Monday)
      { from: '2026-09-18', to: '2026-09-21' },
    );
    const series = streakSeries(stats, '2026-09-21');
    const at = (d: string) => series.find((p) => p.date === d)!;
    expect(at('2026-09-18').streak).toBe(1);                                       // Fri active
    expect(at('2026-09-19')).toEqual({ date: '2026-09-19', streak: 1, broke: null }); // Sat skipped, run persists
    expect(at('2026-09-20').streak).toBe(1);                                       // Sun skipped
    expect(at('2026-09-21').streak).toBe(2);                                       // Mon continues the run
  });

  it('never breaks on an incomplete today', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-21', to: '2026-09-23' },
    );
    expect(streakSeries(stats, '2026-09-23').at(-1))
      .toEqual({ date: '2026-09-23', streak: 2, broke: null });
  });

  it('keeps the last point equal to currentStreak(stats, today)', () => {
    const growing = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-23' },
    );
    expect(streakSeries(growing, '2026-09-23').at(-1)!.streak)
      .toBe(currentStreak(growing, '2026-09-23')); // 2

    const broken = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-20', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-23' },
    );
    expect(streakSeries(broken, '2026-09-23').at(-1)!.streak)
      .toBe(currentStreak(broken, '2026-09-23')); // 1
  });

  it('carries a run that entered the window from before it', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2025-12-30', 1), entry('h1', '2025-12-31', 1), entry('h1', '2026-01-01', 1)],
      { from: '2025-12-01', to: '2026-01-01' },
    );
    expect(streakSeries(stats, '2026-01-01').at(-1))
      .toEqual({ date: '2026-01-01', streak: 3, broke: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/trends.test.ts`
Expected: FAIL — module `src/lib/trends.ts` not found (`Failed to resolve import`).

- [ ] **Step 3: Write the implementation**

Create `src/lib/trends.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/trends.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Full gate**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: suite green (535 tests / 53 files); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trends.ts src/lib/trends.test.ts
git commit -m "feat(trends): add streakSeries — forward mirror of currentStreak"
```

---

### Task 2: Calendar markers, labels, legend, widened window

**Files:**
- Modify: `src/components/CalendarScreen.tsx` (imports lines 3–9; queries/stats lines 29–37; cell label/dot/content lines 85–120; legend after line 140)
- Test: `src/components/CalendarScreen.test.tsx` (append a new `describe` block; all existing tests must pass unchanged — see spec §7)

**Interfaces:**
- Consumes: `streakSeries`, `SeriesPoint` from Task 1; `allTimeStart` from `@/lib/stats` (exists).
- Produces: marker states `data-dot="filled|hollow|missed|break"` on cell markers, `data-testid="cal-legend"` — Tasks 7/8 and the browser run rely on these; no lib interfaces change.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/CalendarScreen.test.tsx` (after the existing `describe`, reusing the file's `habit` helper, `WAIT`, `labelDate`, and mocks):

```tsx
describe('CalendarScreen markers (2026-10-05 spec R1/R2)', () => {
  it('marks a past due day with nothing done as missed', async () => {
    await putHabit(habit());                       // daily, createdAt 0 → always scheduled
    const d = fromKey(todayKey());
    const past = toKey(new Date(d.getFullYear(), d.getMonth() - 1, 15)); // fully in the past
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    const cell = await screen.findByLabelText(
      new RegExp(`^${labelDate(past)}: 0 of 1 done — missed$`), {}, WAIT);
    expect(cell.querySelector('[data-dot="missed"]')).toBeInTheDocument();
  });

  it('marks the day that ended a streak as a break, first miss only', async () => {
    const h = habit();
    await putHabit(h);
    const d = fromKey(todayKey());
    const day14 = toKey(new Date(d.getFullYear(), d.getMonth() - 1, 14));
    const day15 = toKey(new Date(d.getFullYear(), d.getMonth() - 1, 15));
    const day16 = toKey(new Date(d.getFullYear(), d.getMonth() - 1, 16));
    const day17 = toKey(new Date(d.getFullYear(), d.getMonth() - 1, 17));
    await putEntry(h.id, day14, 1);
    await putEntry(h.id, day15, 1);                // run of 2, then day16 untouched
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    const breakCell = await screen.findByLabelText(
      new RegExp(`^${labelDate(day16)}: streak of 2 ended$`), {}, WAIT);
    expect(breakCell.querySelector('[data-dot="break"]')).toBeInTheDocument();
    const nextCell = await screen.findByLabelText(
      new RegExp(`^${labelDate(day17)}: 0 of 1 done — missed$`), {}, WAIT); // run already 0
    expect(nextCell.querySelector('[data-dot="missed"]')).toBeInTheDocument();
    expect(nextCell.querySelector('[data-dot="break"]')).toBeNull();
  });

  it('never marks today as missed while it is still pending', async () => {
    await putHabit(habit());
    render(<CalendarScreen />);
    const cell = await screen.findByLabelText(
      new RegExp(`^${labelDate(todayKey())}: 0 of 1 done, 0%$`), {}, WAIT); // unchanged today label
    expect(cell.querySelector('[data-dot]')).toBeNull();
  });

  it('shows the four-item marker legend under the grid', async () => {
    render(<CalendarScreen />);
    const legend = await screen.findByTestId('cal-legend', {}, WAIT);
    for (const text of ['Perfect', 'Partial', 'Missed', 'Streak break']) {
      expect(legend).toHaveTextContent(text);
    }
  });

  it('counts a streak that entered the month from before it when spotting a break', async () => {
    const h = habit();
    await putHabit(h);
    const d = fromKey(todayKey());
    const viewY = d.getFullYear();
    const viewM = d.getMonth() - 6;                              // any month ≥5 back: always fully past
    const lastPrev = toKey(new Date(viewY, viewM, 0));            // last day of the month before view
    const dayBefore = toKey(new Date(viewY, viewM, -1));          // its predecessor
    const firstView = toKey(new Date(viewY, viewM, 1));
    await putEntry(h.id, dayBefore, 1);
    await putEntry(h.id, lastPrev, 1);                            // run of 2 crosses the month line
    render(<CalendarScreen />);
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    }
    const cell = await screen.findByLabelText(
      new RegExp(`^${labelDate(firstView)}: streak of 2 ended$`), {}, WAIT);
    expect(cell.querySelector('[data-dot="break"]')).toBeInTheDocument();
  });
});
```

Note: `new Date(y, m-6, 1)` with `m-6 < 0` rolls the year correctly (JS Date normalization), and `toKey` serializes it — no manual year math.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/CalendarScreen.test.tsx`
Expected: FAIL — 4 of the 5 new tests fail (missed label, break label, legend `cal-legend`, widened-range break); the today-pending pin already passes (it pins unchanged behavior). All existing tests still pass.

- [ ] **Step 3: Widen the data window and compute the series**

In `src/components/CalendarScreen.tsx`:

1. Extend the stats import (line 8) and add the trends + X imports:

```tsx
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
// …
import { allTimeStart, buildDayStats } from '@/lib/stats';
import { streakSeries } from '@/lib/trends';
```

2. Replace lines 29–37 (queries + stats memo) with:

```tsx
const habits = useLiveQuery(() => listHabits(), []);
// Spec R4: the window must reach back to the earliest habit so a streak that
// entered this month is known when a break happens inside it (allTimeStart is
// the same window Insights' allEntries uses). Before habits load, month-only.
const entriesFrom = habits && habits.length > 0 ? allTimeStart(habits) : monthStart;
const entries = useLiveQuery(() => loadRange(entriesFrom, monthEnd), [entriesFrom, monthEnd]);

const stats = useMemo(
  () => (habits && entries ? buildDayStats(habits, entries, { from: entriesFrom, to: monthEnd }) : undefined),
  [habits, entries, entriesFrom, monthEnd],
);
const seriesMap = useMemo(
  () => (stats ? new Map(streakSeries(stats, today).map((p) => [p.date, p] as const)) : undefined),
  [stats, today],
);
const grid = useMemo(() => monthGrid(cursor.y, cursor.m + 1), [cursor]);
```

- [ ] **Step 4: Marker precedence, labels, and marker markup**

Replace lines 88–120 (the `label`/`dot`/`content` block) with:

```tsx
const seriesPoint = kind === 'future' || !seriesMap ? undefined : seriesMap.get(key);
// Spec R1: past + scheduled + nothing done = missed; a `broke` on that point
// upgrades it to the break (one marker per cell; today/future never qualify).
const missed = kind === 'past' && !!stat && stat.scheduled > 0 && !stat.active;

// Spec R1 precedence: perfect → partial → break → missed → none.
const state: 'none' | 'filled' | 'hollow' | 'missed' | 'break' =
  kind === 'future' || !stat
    ? 'none'
    : stat.perfect
      ? 'filled'
      : stat.active
        ? 'hollow'
        : missed && seriesPoint?.broke
          ? 'break'
          : missed
            ? 'missed'
            : 'none';

// Spec R2 labels: break/missed get explicit text (shape + text, never color alone).
const label =
  kind === 'future'
    ? `${labelDate(key)}: upcoming`
    : stat && stat.scheduled > 0
      ? state === 'break' && seriesPoint?.broke
        ? `${labelDate(key)}: streak of ${seriesPoint.broke} ended`
        : state === 'missed'
          ? `${labelDate(key)}: ${stat.completed} of ${stat.scheduled} done — missed`
          : `${labelDate(key)}: ${stat.completed} of ${stat.scheduled} done, ${Math.round(stat.ratio * 100)}%`
      : `${labelDate(key)}: nothing scheduled`;

const content = (
  <>
    <span aria-hidden>{Number(key.slice(8))}</span>
    {state === 'break' && (
      <X aria-hidden data-dot="break" size={10} strokeWidth={3} className="text-[var(--color-accent-ink)]" />
    )}
    {state === 'filled' && (
      <span aria-hidden data-dot="filled" className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
    )}
    {state === 'hollow' && (
      <span aria-hidden data-dot="hollow" className="h-1.5 w-1.5 rounded-full border border-[var(--color-subtle)]" />
    )}
    {state === 'missed' && (
      <span aria-hidden data-dot="missed" className="h-[3px] w-2 rounded-full bg-[var(--color-subtle)]" />
    )}
  </>
);
```

The `const base = …` line and the future/Link branches below stay untouched (the old R5 comment at former lines 95–96 is replaced by the two comments above).

- [ ] **Step 5: Add the legend under the grid**

After line 140 (`)}` closing the skeleton/grid ternary), before the final `</div>`:

```tsx
{mounted && stats && (
  <div data-testid="cal-legend"
       className="mt-3 flex flex-wrap items-center justify-end gap-3 text-[10px] text-[var(--color-subtle)]">
    <span className="flex items-center gap-1">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />Perfect
    </span>
    <span className="flex items-center gap-1">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-[var(--color-subtle)]" />Partial
    </span>
    <span className="flex items-center gap-1">
      <span aria-hidden className="h-[3px] w-2 rounded-full bg-[var(--color-subtle)]" />Missed
    </span>
    <span className="flex items-center gap-1">
      <X aria-hidden size={10} strokeWidth={3} className="text-[var(--color-accent-ink)]" />Streak break
    </span>
  </div>
)}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/CalendarScreen.test.tsx`
Expected: PASS — all existing + 5 new tests (14 total).

- [ ] **Step 7: Full gate**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: suite green (540 tests / 53 files); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/CalendarScreen.tsx src/components/CalendarScreen.test.tsx
git commit -m "feat(calendar): missed and streak-break markers, legend, all-time window"
```

---

### Task 3: Chart derivations (`weeklyRates`, `weekdayRates`, `hourHistogram`) + `mondayIndex` export

**Files:**
- Modify: `src/lib/dates.ts:75` (export `mondayIndex`)
- Modify: `src/lib/trends.ts`
- Test: `src/lib/dates.test.ts` (import line 2–5 + new assertion), `src/lib/trends.test.ts`

**Interfaces:**
- Consumes: `DayStat`, `isCompleted` from `./stats`; `Habit`, `Entry` from `./types`.
- Produces:
  - `export function mondayIndex(key: string): number` (Monday = 0 … Sunday = 6) — Task 6 consumes via `@/lib/dates`.
  - `export type WeekRate = { weekStart: string; completed: number; scheduled: number; rate: number | null }`
  - `export type WeekdayRate = { weekday: number; completed: number; scheduled: number; rate: number | null }`
  - `export function weeklyRates(stats: Map<string, DayStat>, year: number): WeekRate[]`
  - `export function weekdayRates(stats: Map<string, DayStat>, year: number): WeekdayRate[]`
  - `export function hourHistogram(habits: Habit[], entries: Entry[], year: number): number[]` (length 24)

- [ ] **Step 1: Failing test for `mondayIndex`**

In `src/lib/dates.test.ts`: add `mondayIndex` to the import (lines 2–5), then append to the existing weekday describe (or a new one):

```ts
it('mondayIndex is Monday-first (Monday = 0 … Sunday = 6)', () => {
  expect(mondayIndex('2026-09-21')).toBe(0); // Monday
  expect(mondayIndex('2026-09-20')).toBe(6); // Sunday
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `mondayIndex` is not exported (import resolution error).

- [ ] **Step 3: Export `mondayIndex`**

`src/lib/dates.ts` line 75: change `function mondayIndex(key: string): number {` to `export function mondayIndex(key: string): number {` (the doc comment on line 74 stays).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS (whole file green).

- [ ] **Step 5: Commit the export**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat(dates): export mondayIndex (Monday-first weekday position)"
```

- [ ] **Step 6: Write the failing derivation tests**

1. Update the import at the top of `src/lib/trends.test.ts` (it currently imports only `streakSeries`) to:

```ts
import { hourHistogram, streakSeries, weekdayRates, weeklyRates } from './trends';
```

2. Add this `timed` helper next to the existing `entry` helper:

```ts
const timed = (habitId: string, date: string, value: number, hour: number): Entry => ({
  id: `${habitId}_${date}`, habitId, date, value,
  timestamp: Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00`),
});
```

3. Append these describes:

```ts
describe('weeklyRates', () => {
  it('buckets Monday-first, counts slots-but-nothing-done as 0 (not null)', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-14', 1), entry('h1', '2026-09-15', 1)],
      { from: '2026-09-14', to: '2026-09-27' }, // 2026-09-14 is a Monday
    );
    const weeks = weeklyRates(stats, 2026);
    expect(weeks).toHaveLength(53); // Monday of Jan 1 … Monday of Dec 31, 2026
    const w1 = weeks.find((w) => w.weekStart === '2026-09-14')!;
    expect(w1.completed).toBe(2);
    expect(w1.scheduled).toBe(7);
    expect(w1.rate).toBeCloseTo(2 / 7);
    const w2 = weeks.find((w) => w.weekStart === '2026-09-21')!;
    expect(w2.completed).toBe(0);
    expect(w2.scheduled).toBe(7);
    expect(w2.rate).toBe(0); // slots exist → real 0%, never a gap
  });

  it('reports null for weeks with no scheduled habits (gap, never a fake 0%)', () => {
    const stats = buildDayStats([habit({ frequency: [] })], [], { from: '2026-09-14', to: '2026-09-27' });
    expect(weeklyRates(stats, 2026).every((w) => w.rate === null)).toBe(true);
  });

  it('counts only in-year days at the year edge', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2025-12-30', 1), entry('h1', '2026-01-02', 1)],
      { from: '2025-12-29', to: '2026-01-04' },
    );
    const first = weeklyRates(stats, 2026).find((w) => w.weekStart === '2025-12-29')!;
    expect(first.scheduled).toBe(4); // Jan 1–4 only; Dec 29–30 belong to 2025
    expect(first.completed).toBe(1); // the Dec-30 entry does not leak into 2026
  });
});

describe('weekdayRates', () => {
  it('buckets Monday-first with the slots-family rate', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-14', 1), entry('h1', '2026-09-15', 1)],
      { from: '2026-09-14', to: '2026-09-20' }, // Mon … Sun
    );
    const days = weekdayRates(stats, 2026);
    expect(days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days[0].rate).toBe(1);        // Mon: 1 of 1
    expect(days[1].rate).toBe(1);        // Tue: 1 of 1
    expect(days[2].rate).toBe(0);        // Wed: slots, nothing done → 0
    expect(days[6].scheduled).toBe(1);   // Sun: slot untouched
  });

  it('reports null for weekdays with no scheduled habits', () => {
    const mwf = habit({ frequency: [1, 3] }); // Mon + Wed only
    const stats = buildDayStats([mwf], [], { from: '2026-09-14', to: '2026-09-20' });
    const days = weekdayRates(stats, 2026);
    expect(days[1].rate).toBeNull();   // Tuesday: nothing scheduled
    expect(days[0].scheduled).toBe(1); // Monday: 1 slot
  });
});

describe('hourHistogram', () => {
  it('buckets completed rows by local hour and ignores non-completions', () => {
    const entries = [
      timed('h1', '2026-09-21', 1, 8),
      timed('h1', '2026-09-22', 1, 21),
      timed('h1', '2026-09-23', 0, 8), // untouched row is not a completion
    ];
    const counts = hourHistogram([habit()], entries, 2026);
    expect(counts).toHaveLength(24);
    expect(counts[8]).toBe(1);
    expect(counts[21]).toBe(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('ignores other years and partial quantity rows', () => {
    const quantity = habit({ id: 'q', type: 'quantity', target: 3 });
    const entries = [
      timed('h1', '2025-12-31', 1, 10), // wrong year
      timed('q', '2026-09-21', 2, 9),   // 2 of 3 = not completed
      timed('q', '2026-09-21', 3, 9),   // 3 of 3 = completed
    ];
    const counts = hourHistogram([quantity], entries, 2026);
    expect(counts[9]).toBe(1);
    expect(counts[10]).toBe(0);
  });

  it('counts off-schedule (bonus) completions — the all-completions family', () => {
    const monOnly = habit({ id: 'm', frequency: [1] });  // Mondays only
    const entries = [timed('m', '2026-09-23', 1, 14)];   // Wednesday bonus
    expect(hourHistogram([monOnly], entries, 2026)[14]).toBe(1);
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run src/lib/trends.test.ts`
Expected: FAIL — `weeklyRates`, `weekdayRates`, `hourHistogram` are not exported.

- [ ] **Step 8: Implement the three derivations**

Append to `src/lib/trends.ts` (imports become):

```ts
import { mondayIndex, mondayOf } from './dates';
import type { DayStat } from './stats';
import { isCompleted } from './stats';
import type { Entry, Habit } from './types';
```

```ts
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
```

(`addDays` comes from `./dates` — add it to the dates import: `import { addDays, mondayIndex, mondayOf } from './dates';`.)

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/lib/trends.test.ts`
Expected: PASS — 14 tests (6 from Task 1 + 8 new).

- [ ] **Step 10: Full gate**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: suite green (549 tests / 53 files); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/lib/trends.ts src/lib/trends.test.ts
git commit -m "feat(trends): weeklyRates, weekdayRates, hourHistogram"
```

---

### Task 4: `TrendChart` (minimal SVG line primitive)

**Files:**
- Create: `src/components/TrendChart.tsx`
- Test: `src/components/TrendChart.test.tsx`

**Interfaces:**
- Consumes: nothing from this codebase (tokens only). No `'use client'` directive (stateless, `IntentionBar` precedent).
- Produces: `export type TrendChartProps = { points: (number | null)[]; max: number; ariaLabel: string; yTicks?: string[]; testId: string }` and `export function TrendChart(props: TrendChartProps): JSX.Element` — Task 6 consumes.

- [ ] **Step 1: Write the failing tests**

Create `src/components/TrendChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendChart } from './TrendChart';

describe('TrendChart', () => {
  it('splits the line at null gaps', () => {
    const { container } = render(
      <TrendChart points={[0.2, 0.3, null, 0.8, 0.9]} max={1} ariaLabel="t" testId="tc" />,
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
  });

  it('draws a zero value at the baseline instead of as a gap', () => {
    const { container } = render(<TrendChart points={[1, 0]} max={1} ariaLabel="t" testId="tc" />);
    expect(container.querySelectorAll('polyline')).toHaveLength(1);
  });

  it('scales values against max (0 at baseline, max at top)', () => {
    const { container } = render(<TrendChart points={[0, 1]} max={1} ariaLabel="t" testId="tc" />);
    expect(container.querySelector('polyline')!.getAttribute('points')).toBe('0,38 100,2');
  });

  it('draws a lone point as a round dot', () => {
    const { container } = render(
      <TrendChart points={[null, 0.5, null]} max={1} ariaLabel="t" testId="tc" />,
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    expect(container.querySelector('line[stroke-linecap="round"]')).not.toBeNull();
  });

  it('exposes the summary as an image label and renders HTML y ticks', () => {
    render(
      <TrendChart points={[0.5]} max={1} ariaLabel="Streak growth in 2026"
                  testId="trend-streak" yTicks={['100%', '50%', '0%']} />,
    );
    const svg = screen.getByTestId('trend-streak');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Streak growth in 2026');
    for (const t of ['100%', '50%', '0%']) expect(screen.getByText(t)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/TrendChart.test.tsx`
Expected: FAIL — `./TrendChart` not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/TrendChart.tsx`:

```tsx
export type TrendChartProps = {
  points: (number | null)[]; // one point per bucket; null = gap
  max: number;               // y-domain top (rates use 1, streaks use the peak)
  ariaLabel: string;         // role="img" summary
  yTicks?: string[];         // HTML labels, top → bottom
  testId: string;
};

// Fixed viewBox stretched with preserveAspectRatio="none" so the line fills any
// card width; vector-effect keeps strokes (and lone-point caps) screen-crisp
// instead of stretching. No text lives in the SVG for the same reason — labels
// are HTML siblings (spec §6.5). Plot area: y 2 (max) … 38 (baseline).
const VB = { w: 100, h: 40, top: 2, bottom: 38 } as const;

export function TrendChart({ points, max, ariaLabel, yTicks, testId }: TrendChartProps) {
  const px = (i: number) => (points.length <= 1 ? 50 : (i / (points.length - 1)) * 100);
  const py = (v: number) => VB.bottom - (max > 0 ? Math.max(v, 0) / max : 0) * (VB.bottom - VB.top);

  // Contiguous runs of non-null points → one polyline each; nulls break the line.
  const runs: Array<Array<{ i: number; v: number }>> = [];
  points.forEach((v, i) => {
    if (v === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1].i === i - 1) last.push({ i, v });
    else runs.push([{ i, v }]);
  });
  const lines = runs.filter((r) => r.length > 1);
  const solos = runs.filter((r) => r.length === 1).map((r) => r[0]);

  const chart = (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" role="img"
         aria-label={ariaLabel} data-testid={testId} className="h-24 w-full flex-1">
      <line x1={0} y1={VB.bottom} x2={VB.w} y2={VB.bottom}
            stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {lines.map((run, i) => (
        <polyline key={i} fill="none" stroke="var(--color-accent)" strokeWidth={1.5}
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  points={run.map((p) => `${px(p.i)},${py(p.v)}`).join(' ')} />
      ))}
      {/* A single point has no line to draw; a zero-length round-capped line
          renders a dot that non-scaling-stroke keeps circular at 3px. */}
      {solos.map((p) => (
        <line key={`s${p.i}`} x1={px(p.i)} y1={py(p.v)} x2={px(p.i)} y2={py(p.v) + 0.01}
              stroke="var(--color-accent)" strokeWidth={3} strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );

  if (!yTicks?.length) return chart;
  return (
    <div className="flex gap-2">
      <div aria-hidden className="flex h-24 flex-col justify-between text-[10px] text-[var(--color-subtle)]">
        {yTicks.map((t) => <span key={t}>{t}</span>)}
      </div>
      {chart}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/TrendChart.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Full gate**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: suite green (554 tests / 54 files); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/TrendChart.tsx src/components/TrendChart.test.tsx
git commit -m "feat(trends): TrendChart — minimal SVG line with gap support"
```

---

### Task 5: `PatternBars` (div-bars primitive)

**Files:**
- Create: `src/components/PatternBars.tsx`
- Test: `src/components/PatternBars.test.tsx`

**Interfaces:**
- Consumes: tokens only. Stateless, no directive.
- Produces: `export type BarDatum = { label: string; value: number | null; aria: string }` and `export function PatternBars({ data, max, ariaLabel, testId }: { data: BarDatum[]; max: number; ariaLabel: string; testId: string })` — Task 6 consumes.

- [ ] **Step 1: Write the failing tests**

Create `src/components/PatternBars.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PatternBars } from './PatternBars';

const data = [
  { label: 'M', value: 1, aria: 'Monday: 100% (1 of 1)' },
  { label: '', value: null, aria: 'Tuesday: nothing scheduled' },
  { label: '6a', value: 0.5, aria: '6 am: 4 completions' },
];

describe('PatternBars', () => {
  it('renders one list item per datum with its accessible text', () => {
    render(<PatternBars data={data} max={1} ariaLabel="By weekday" testId="pb" />);
    expect(screen.getByRole('list', { name: 'By weekday' })).toBeInTheDocument();
    expect(screen.getByText('Monday: 100% (1 of 1)')).toBeInTheDocument();
    expect(screen.getByText('Tuesday: nothing scheduled')).toBeInTheDocument();
  });

  it('scales bar heights against max and treats null as empty', () => {
    const { container } = render(<PatternBars data={data} max={1} ariaLabel="x" testId="pb" />);
    const bars = container.querySelectorAll<HTMLElement>('[data-bar]');
    expect(bars).toHaveLength(3);
    expect(bars[0].style.height).toBe('100%');
    expect(bars[1].style.height).toBe('0%');
    expect(bars[2].style.height).toBe('50%');
  });

  it('shows a visible tick label only where one is provided', () => {
    const { container } = render(<PatternBars data={data} max={1} ariaLabel="x" testId="pb" />);
    expect(screen.getByText('M')).toBeInTheDocument();
    const labels = container.querySelectorAll('[data-bar-label]');
    expect(labels).toHaveLength(3);
    expect(labels[1].textContent).toBe('');
  });

  it('exposes the testid on the region', () => {
    render(<PatternBars data={data} max={1} ariaLabel="x" testId="pattern-weekday" />);
    expect(screen.getByTestId('pattern-weekday')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/PatternBars.test.tsx`
Expected: FAIL — `./PatternBars` not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/PatternBars.tsx`:

```tsx
export type BarDatum = { label: string; value: number | null; aria: string };

export function PatternBars({ data, max, ariaLabel, testId }: {
  data: BarDatum[]; max: number; ariaLabel: string; testId: string;
}) {
  return (
    <ul aria-label={ariaLabel} data-testid={testId}
        className="flex h-24 items-end gap-1">
      {data.map((d, i) => {
        const pct = d.value === null || max <= 0 ? 0 : (d.value / max) * 100;
        return (
          <li key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            {/* Screen readers get the full datum; the bar itself is decoration. */}
            <span className="sr-only">{d.aria}</span>
            <div className="flex min-h-0 flex-1 items-end" aria-hidden>
              <div data-bar className="w-full rounded-t-[3px] bg-[var(--color-accent)]"
                   style={{ height: `${pct}%` }} />
            </div>
            <span data-bar-label aria-hidden
                  className="h-4 shrink-0 text-center text-[10px] text-[var(--color-subtle)]">
              {d.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/PatternBars.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Full gate**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: suite green (558 tests / 55 files); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/PatternBars.tsx src/components/PatternBars.test.tsx
git commit -m "feat(trends): PatternBars — accessible div-bar primitive"
```

---

### Task 6: `TrendsSection` (composition, annotations, empty states)

**Files:**
- Create: `src/components/TrendsSection.tsx`
- Test: `src/components/TrendsSection.test.tsx`

**Interfaces:**
- Consumes: `streakSeries`, `weeklyRates`, `weekdayRates`, `hourHistogram` (Tasks 1+3); `TrendChart` (Task 4); `PatternBars` + `BarDatum` (Task 5); `buildDayStats`, `allTimeStart` from `@/lib/stats`; `Habit`, `Entry` from `@/lib/types`.
- Produces: `export function TrendsSection({ habits, entries, year, today }: { habits: Habit[]; entries: Entry[]; year: number; today: string })` — Task 7 inserts it into InsightsScreen.

- [ ] **Step 1: Write the failing tests**

Create `src/components/TrendsSection.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from '@/lib/types';
import { TrendsSection } from './TrendsSection';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const entry = (habitId: string, date: string, value: number): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

const TIMED = Date.parse('2026-09-21T00:00:00'); // habit born Monday 2026-09-21

describe('TrendsSection', () => {
  it('renders the Trends heading and the three card titles', () => {
    render(<TrendsSection habits={[habit()]} entries={[]} year={2026} today="2026-09-23" />);
    expect(screen.getByRole('heading', { name: 'Trends', level: 2 })).toBeInTheDocument();
    for (const t of ['Streak growth', 'Consistency', 'When you show up']) {
      expect(screen.getByRole('heading', { name: t, level: 3 })).toBeInTheDocument();
    }
  });

  it('shows the neutral empty state when there are no habits', () => {
    render(<TrendsSection habits={[]} entries={[]} year={2026} today="2026-09-23" />);
    expect(screen.getByText('No habits yet.')).toBeInTheDocument();
    expect(screen.queryByText('Streak growth')).not.toBeInTheDocument();
  });

  it('annotates the longest run, counting a streak that entered the year from December', () => {
    const entries = [
      entry('h1', '2025-12-30', 1), entry('h1', '2025-12-31', 1), entry('h1', '2026-01-01', 1),
    ];
    render(<TrendsSection habits={[habit()]} entries={entries} year={2026} today="2026-01-01" />);
    expect(screen.getByText('Longest this year: 3')).toBeInTheDocument(); // full value at Jan 1
  });

  it('renders the consistency chart with y ticks and a slot-weighted average', () => {
    const entries = [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)];
    render(
      <TrendsSection habits={[habit({ createdAt: TIMED })]} entries={entries}
                     year={2026} today="2026-09-23" />,
    );
    expect(screen.getByTestId('trend-consistency')).toBeInTheDocument();
    for (const t of ['100%', '50%', '0%']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('Average: 67%')).toBeInTheDocument(); // 2 of 3 slots (Sep 21–23)
    expect(screen.getByText('Longest this year: 2')).toBeInTheDocument();
  });

  it('falls back per card when the year has no slots or completions', () => {
    render(<TrendsSection habits={[habit({ frequency: [] })]} entries={[]} year={2026} today="2026-09-23" />);
    expect(screen.getByText('No streaks in 2026.')).toBeInTheDocument();
    expect(screen.getAllByText('Nothing scheduled in 2026.')).toHaveLength(2); // consistency card + weekday group
    expect(screen.getByText('No completions in 2026.')).toBeInTheDocument();   // hour group
  });

  it('renders weekday bars with per-day accessible text', () => {
    const entries = [entry('h1', '2026-09-21', 1)]; // Monday done
    render(
      <TrendsSection habits={[habit({ createdAt: TIMED })]} entries={entries}
                     year={2026} today="2026-09-21" />,
    );
    const list = screen.getByRole('list', { name: 'Completion rate by weekday' });
    expect(within(list).getByText('Monday: 100% (1 of 1)')).toBeInTheDocument();
    expect(within(list).getByText('Tuesday: nothing scheduled')).toBeInTheDocument();
  });

  it('renders hourly bars with tick labels and completion counts', () => {
    const timed = (date: string, hour: number): Entry => ({
      id: `h1_${date}`, habitId: 'h1', date, value: 1,
      timestamp: Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00`),
    });
    const entries = [timed('2026-09-21', 8), timed('2026-09-22', 8)];
    render(
      <TrendsSection habits={[habit({ createdAt: TIMED })]} entries={entries}
                     year={2026} today="2026-09-23" />,
    );
    const list = screen.getByRole('list', { name: 'Completions by hour of day' });
    expect(within(list).getByText('8 am: 2 completions')).toBeInTheDocument();
    expect(within(list).getByText('6a')).toBeInTheDocument();  // tick at 06:00
    expect(within(list).getByText('12p')).toBeInTheDocument(); // tick at 12:00
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/TrendsSection.test.tsx`
Expected: FAIL — `./TrendsSection` not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/TrendsSection.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { allTimeStart, buildDayStats } from '@/lib/stats';
import { hourHistogram, streakSeries, weekdayRates, weeklyRates } from '@/lib/trends';
import type { Entry, Habit } from '@/lib/types';
import { PatternBars } from './PatternBars';
import { TrendChart } from './TrendChart';

const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOUR_TICK: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };
const hourLabel = (h: number) => {
  const suffix = h < 12 ? 'am' : 'pm';
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base} ${suffix}`;
};
const MICRO = 'mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]';
const SUBTLE = 'text-sm text-[var(--color-subtle)]';

export function TrendsSection({ habits, entries, year, today }: {
  habits: Habit[]; entries: Entry[]; year: number; today: string;
}) {
  // Full history → the streak entering Jan 1 is real; past years clamp to Dec 31.
  const chartEnd = useMemo(() => (`${year}-12-31` < today ? `${year}-12-31` : today), [year, today]);
  const stats = useMemo(
    () => buildDayStats(habits, entries, { from: habits.length ? allTimeStart(habits) : chartEnd, to: chartEnd }),
    [habits, entries, chartEnd],
  );
  const yearStart = `${year}-01-01`;
  const series = useMemo(
    () => streakSeries(stats, today).filter((p) => p.date >= yearStart),
    [stats, today, yearStart],
  );
  const weeks = useMemo(() => weeklyRates(stats, year), [stats, year]);
  const weekdays = useMemo(() => weekdayRates(stats, year), [stats, year]);
  const hours = useMemo(() => hourHistogram(habits, entries, year), [habits, entries, year]);

  const streakMax = series.reduce((m, p) => Math.max(m, p.streak), 0);
  const totals = weeks.reduce(
    (t, w) => ({ completed: t.completed + w.completed, scheduled: t.scheduled + w.scheduled }),
    { completed: 0, scheduled: 0 },
  );
  const average = totals.scheduled > 0 ? Math.round((totals.completed / totals.scheduled) * 100) : 0;
  const weekdaySlots = weekdays.reduce((n, d) => n + d.scheduled, 0);
  const hourTotal = hours.reduce((a, b) => a + b, 0);

  if (habits.length === 0) {
    return (
      <div>
        <h2 className={MICRO}>Trends</h2>
        <div className="glass-card px-4 py-2">
          <p className={`py-3 ${SUBTLE}`}>No habits yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="trends-section">
      <h2 className={MICRO}>Trends</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section aria-labelledby="trend-streak-title" className="glass-card p-4">
          <h3 id="trend-streak-title" className="mb-2 text-sm font-bold">Streak growth</h3>
          {streakMax === 0 ? (
            <p className={`py-3 ${SUBTLE}`}>No streaks in {year}.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[var(--color-subtle)]">Longest this year: {streakMax}</p>
              <TrendChart points={series.map((p) => p.streak)} max={streakMax}
                          ariaLabel={`Streak growth in ${year}, longest ${streakMax} days`}
                          testId="trend-streak" />
            </>
          )}
        </section>

        <section aria-labelledby="trend-consistency-title" className="glass-card p-4">
          <h3 id="trend-consistency-title" className="mb-2 text-sm font-bold">Consistency</h3>
          {totals.scheduled === 0 ? (
            <p className={`py-3 ${SUBTLE}`}>Nothing scheduled in {year}.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[var(--color-subtle)]">Average: {average}%</p>
              <TrendChart points={weeks.map((w) => w.rate)} max={1}
                          ariaLabel={`Weekly completion rate in ${year}, average ${average} percent`}
                          testId="trend-consistency" yTicks={['100%', '50%', '0%']} />
            </>
          )}
        </section>

        <section aria-labelledby="trend-patterns-title" className="glass-card p-4 md:col-span-2">
          <h3 id="trend-patterns-title" className="mb-3 text-sm font-bold">When you show up</h3>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">By weekday</p>
              {weekdaySlots === 0 ? (
                <p className={`py-3 ${SUBTLE}`}>Nothing scheduled in {year}.</p>
              ) : (
                <PatternBars
                  testId="pattern-weekday" max={1} ariaLabel="Completion rate by weekday"
                  data={weekdays.map((d, i) => ({
                    label: WEEKDAY_SHORT[i],
                    value: d.rate,
                    aria: d.rate === null
                      ? `${WEEKDAY_LONG[i]}: nothing scheduled`
                      : `${WEEKDAY_LONG[i]}: ${Math.round(d.rate * 100)}% (${d.completed} of ${d.scheduled})`,
                  }))}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">By hour of day</p>
              {hourTotal === 0 ? (
                <p className={`py-3 ${SUBTLE}`}>No completions in {year}.</p>
              ) : (
                <PatternBars
                  testId="pattern-hour" max={Math.max(1, ...hours)} ariaLabel="Completions by hour of day"
                  data={hours.map((count, h) => ({
                    label: HOUR_TICK[h] ?? '',
                    value: count,
                    aria: `${hourLabel(h)}: ${count} completion${count === 1 ? '' : 's'}`,
                  }))}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/TrendsSection.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Full gate**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: suite green (565 tests / 56 files); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/TrendsSection.tsx src/components/TrendsSection.test.tsx
git commit -m "feat(trends): TrendsSection — streak growth, consistency, patterns cards"
```

---

### Task 7: Wire into InsightsScreen (placement + layout-test selector + live update)

**Files:**
- Modify: `src/components/InsightsScreen.tsx` (imports lines 15–19; insert after line 111)
- Test: `src/components/InsightsScreen.test.tsx` (selector fix line 63; two new tests)

**Interfaces:**
- Consumes: `TrendsSection` from Task 6; InsightsScreen's existing `habits`, `allEntries`, `year`, `today` (all narrowed non-undefined after the line-86 loading gate).
- Produces: none (leaf wiring).

- [ ] **Step 1: Fix the layout-test selector (Review Focus #3)**

In `src/components/InsightsScreen.test.tsx`, replace lines 61–63:

```tsx
    // xl:grid-cols-1 is unique to the intention/heatmap grid: the new Trends
    // grid also carries gap-6 and comes first in document order, so the old
    // `div[class*="gap-6"]` selector would now return the wrong grid.
    const grid = container.querySelector<HTMLElement>('div[class*="xl:grid-cols-1"]');
```

(All assertions on `grid` below stay unchanged.)

- [ ] **Step 2: Run the existing Insights tests to confirm the selector fix holds**

Run: `npx vitest run src/components/InsightsScreen.test.tsx`
Expected: PASS — the layout test passes with the new selector; all other existing tests unchanged.

- [ ] **Step 3: Insert the section**

In `src/components/InsightsScreen.tsx`:

1. Add the import after line 18 (`import { StatTile } …`, alphabetical slot):

```tsx
import { TrendsSection } from './TrendsSection';
```

2. Insert between line 111 (`<CoachSection … />`) and line 113 (the `{/* Spec §10 … */}` comment):

```tsx
      {/* Trends (2026-10-05 spec R5): year-scoped charts, live via the queries above. */}
      <TrendsSection habits={habits ?? []} entries={allEntries ?? []} year={year} today={today} />
```

- [ ] **Step 4: Write the failing wiring tests**

Append a new test inside the main `describe` in `src/components/InsightsScreen.test.tsx`:

```tsx
  it('renders the Trends section between Coach and By intention', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, todayKey(), 1); // streak ≥ 1 → real chart, not the fallback
    const { InsightsScreen } = await import('./InsightsScreen');
    const { container } = render(<InsightsScreen />);
    const trends = await screen.findByText('Trends', {}, WAIT);
    expect(screen.getByText('By intention')).toBeInTheDocument();
    // Trends precedes By intention in document order
    expect(trends.compareDocumentPosition(screen.getByText('By intention'))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('trend-streak')).toBeInTheDocument();
    expect(screen.getByTestId('pattern-weekday')).toBeInTheDocument();
  }, 15_000);

  it('updates the trend charts when a completion is logged', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, todayKey(), 1);
    const { InsightsScreen } = await import('./InsightsScreen');
    render(<InsightsScreen />);
    expect(await screen.findByText('Longest this year: 1', {}, WAIT)).toBeInTheDocument();
    await putEntry(h.id, addDays(todayKey(), -1), 1); // extend the run through the live query
    expect(await screen.findByText('Longest this year: 2', {}, WAIT)).toBeInTheDocument();
  }, 15_000);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/InsightsScreen.test.tsx`
Expected: PASS — existing + 2 new tests (the `15_000` budget matches this file's house pattern for multi-wait live-query tests).

- [ ] **Step 6: Full gate**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: **entire suite green — 567 tests / 56 files, including the layout/tiles/coach tests** (selector regression watch); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/InsightsScreen.tsx src/components/InsightsScreen.test.tsx
git commit -m "feat(insights): render the Trends section between coach and by-intention"
```

---

### Task 8: Docs (master design + README) and browser verification

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-habibit-design.md` (new §4.7 after line 141)
- Modify: `README.md` (bullets at lines 49–52)

**Interfaces:**
- Consumes: everything from Tasks 1–7 (documentation + manual verification only).

- [ ] **Step 1: Add the master design section**

Insert after §4.6 (line 141, before `## 5. Today view`):

```markdown
### 4.7 Trends & calendar markers (`src/lib/trends.ts`)

Pure derivations over the same day-stats stats uses: `streakSeries` (the
forward mirror of `currentStreak` — one point per day carrying the running
active-day streak and the run length each break ends), `weeklyRates`
(Monday-anchored weekly completion rates; zero-slot weeks are gaps, never a
fake 0%), `weekdayRates` (Monday-first rate by weekday) and `hourHistogram`
(completed entries by local hour). Surfaces: the Calendar marks a past
due-but-untouched day with a dash and the day that ended a run with an ×
(past only — today and future never imply failure; four-item legend under the
grid, window widened to `allTimeStart` so runs entering the month count), and
Stats gets a `Trends` section (streak growth, consistency, when you show up)
between the coach rows and the by-intention grid — year-scoped via YearNav,
recomputed through the existing live queries. Full rules:
`docs/superpowers/specs/2026-10-05-calendar-markers-trends-design.md`.
```

- [ ] **Step 2: Update the README bullets**

Replace lines 49–50 of `README.md` with:

```markdown
- **Today** — check habits off, grouped by *category* (Morning / Health / Evening).
- **Calendar** — a month grid with per-day markers: perfect, partial, missed, and streak break.
- **Stats** — streaks, a year-at-a-glance activity heatmap, per-*intention* breakdowns, plus trend charts: streak growth, consistency, and when you show up.
```

- [ ] **Step 3: Full gate (docs-only change)**

Run each: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
Expected: suite green (567 tests / 56 files); typecheck clean; lint exactly 3 warnings; build succeeds.

- [ ] **Step 4: Commit docs**

```bash
git add docs/superpowers/specs/2026-09-23-habibit-design.md README.md
git commit -m "docs: master design §4.7 + README bullets for trends and calendar markers"
git status --porcelain
```
Expected: status shows only untracked `.opencode/` and `opencode.json` (never staged).

- [ ] **Step 5: Browser verification — seed a deterministic scenario**

Run `npm run dev` (background) and open `http://localhost:3000`. Then, through the UI:
1. Settings → **Export data** first (so Reset at the end can be undone by importing it back).
2. Add a daily habit; visit three consecutive past dates (`/today/<key>` — navigate from the calendar cell links) and check the habit off on the first two, leave the third untouched; also check off today.
3. Leave one more past due day untouched with no active run before it (second missed shape).

- [ ] **Step 6: Browser verification — /calendar checks**

- [ ] Expected: **filled** dot on the two fully-done days; **missed dash** on the untouched days with aria-label `… — missed`; **break ×** with `streak of 2 ended` on the first untouched day after the run; **hollow ring** never appears for fully-untouched days; today shows its normal pending label (`0 of N done, 0%`), never missed; legend row `Perfect / Partial / Missed / Streak break` under the grid; future cells neutral + `aria-disabled`.

- [ ] **Step 7: Browser verification — /stats checks**

- [ ] Expected: `Trends` heading between the coach rows and `By intention`; three cards (`Streak growth`, `Consistency`, `When you show up`) with annotation `Longest this year: 2` (or 3 with today); weekday bars + 24 hour bars with `12a 6a 12p 6p` ticks; YearNav back a year → charts render that year (or their empty fallbacks) without console errors.

- [ ] **Step 8: Browser verification — live update, responsive, a11y, console**

- [ ] Expected: check off an additional past day's habit → streak annotation/`Trend` line update **without reload**; switch theme light/dark → screenshots saved to `C:\Users\charl\AppData\Local\Temp\opencode\` (markers legible in both, no glow); 360px viewport → no horizontal scroll on `/calendar` or `/stats`; DevTools console shows **0 errors**; each chart `<svg>` has `role="img"` + `aria-label`; keyboard tab reaches calendar cells with visible focus.

- [ ] **Step 9: Browser verification — empty state (run LAST), then restore**

Settings → **Reset data** → `/stats` shows `No habits yet.` under `Trends`; `/calendar` shows an empty grid + legend. Then import the export from Step 5 to restore the data. Close the dev server.

- [ ] **Step 10: Final report**

Summarize for the user: commits made, final test count, verification results (with screenshot paths), and any deviations from this plan or the spec.
