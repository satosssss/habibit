# Habibit Slice 1a — Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six slice-1a defects (R1–R6) with failing-test-first TDD — one commit per fix, every gate green after every task, nothing else moving.

**Spec:** `docs/superpowers/specs/2026-09-28-slice-1a-bugfixes-design.md` — this plan argues from the spec; executors must read both. Copy strings in spec §4/§8 are normative (character-exact: `’`, `↑ ≈ ↓`, `…`, `·`).

**Where:** directly on `main` (the spec commits `50dc4be` + `4996e0b` already live there; no worktree). The spec commits and this plan doc are already on `main`; the six fix commits land on top of it.

**Scope check:** one subsystem (the existing Habibit app), six small independent fixes → one plan. No new files beyond one test file (`src/lib/labels.test.ts`).

**Architecture (the delta this plan builds):**

- **One streak definition, one window (R1).** A shared pure helper `allTimeStart(habits)` becomes the entry-range and day-stats window for both Today and Stats, replacing Today's 40-day cap. Header flame, per-habit badges and the Stats tile all derive from the same data.
- **Two number families (R4).** `DayStat`/`HeatCell` gain `bonus` = completions of habits *not* scheduled that day. The all-completions family (Completions tile, active days, streaks, heatmap level floor) includes `bonus`; the scheduled-slot family (`X of Y`, rate, intention bars, scheduled tooltips) never does. Streak walks check "any completion" before "was due".
- **Completed states (R2)** live in `HabitRow`'s ring centers + normative aria names. **Auto-scroll (R3)** is one post-mount effect in `Heatmap`. **Chips (R5)** are computed in `HabitForm` from a pure `intentionSuggestions` helper. **Weekly trend (R6)** is three pure helpers in `stats.ts` (`weekWindows`, `trendCopy`, `weekTrend`) rendered through `StatTile`'s new optional `sub` line.

## Global Constraints (carry-over from spec §2–§3)

- **TDD per step:** write the test → run and watch it FAIL for the right reason → write the implementation → run and watch it PASS. Never write an implementation before its test.
- **Gates green in this order before every commit:** `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
- **One commit per fix.** Stage the task's exact file list — never `git add .`; never stage `.opencode/` or `opencode.json`.
- **No new dependencies, no network calls, no analytics.** `TZ=America/Los_Angeles` vitest pin untouched. No seed-data changes.
- Keep the dark design language and existing code style. No layout change beyond the two specified controls (habit-row ring center, one Stats tile).
- Accessibility: tap targets unchanged; glyph + text, never color alone; `prefers-reduced-motion` respected.

## Spec coverage map

| Spec | Task | Tests (failing first) |
|---|---|---|
| §3 R1 shared streak | 2 | `allTimeStart` ×2 · uncapped 90-day header + badge · header == Stats tile |
| §4 R2 completed rings | 3 | quantity names done/not-done/over-target · steppers while done · timer check swap |
| §5 R3 heatmap auto-scroll | 4 | current-year edge scroll · reduced-motion · past year · SSR · once + re-apply |
| §6 R4 off-day completions | 1 | matrix rows ×4 · §9.1 frequency-edit pin · bonus in current + longest streak · heatmap level floor ×2 · per-habit badge off-schedule · bonus tooltip/aria |
| §7 R5 intention chips | 5 | suggestion helper ×2 · chips dedup/order/tap/✓/placeholder · custom typing · `intentionColor` case pin |
| §8 R6 weekly trend tile | 6 | `weekWindows` · `trendCopy` variants + 3.99/4.00 boundary + precedence · 10 integration renders · `Completion Rate` caption swapped |

## Plan-level decisions not pinned by the spec (flagged for the reviewer)

1. **Bonus-only cells get a matching aria-label** (`{date}: {n} completed (off schedule)`). Spec §6 names only the tooltip; leaving the cell's screen-reader name at `0 of 0` while it renders level-1 color would contradict it.
2. **Longest Streak joins the all-completions family.** §6 lists "streaks" (plural) there; a bonus day therefore extends the longest run exactly as it extends the current streak.
3. **A scheduled day with only off-schedule completions renders level 1.** Level = `max(levelFor(ratio, completed), bonus > 0 ? 1 : 0)` — §6's "level ≥ 1" floor wins; the matrix row "scheduled, none done → 0" is read as *nothing completed at all*.
4. **The Combobox `placeholder` prop already exists** (`Combobox.tsx:12`) — R5 passes `placeholder="Type your own…"` at the intention call site; no component change (spec's "added as a prop" is already satisfied by current code).
5. **`weekTrend` reads the year-independent `allEntries` query**, so windows that cross into December (early January) always have data with no query changes.
6. **The Δ is rounded to 2 decimal percentage points before the ±4.0 comparison.** Binary floats make `0.87 − 0.83 = 3.9999…`; rounding first makes it exactly 4.00. Pinned by the 3.99/4.00 boundary tests.
7. **`mondayOf` is added to `src/lib/dates.ts`** (+ `dates.test.ts`) — week-window arithmetic belongs with the other date helpers.
8. **R6 integration tests fake only `Date`** (`vi.useFakeTimers({ toFake: ['Date'] })`, pinned to Wed 2026-09-30) so window fixtures are weekday-independent while async/`findBy` keep real timers.

## Review Focus

Inputs/conditions the spec implies that no single happy-path test exercises. Each line is pinned by a test in the named task.

1. **Header and Stats tile must agree only when both reference today** → Task 2, `matches the Stats Current Streak tile on the same data`.
2. **Today's entry window must refine when habits finish loading** (rangeStart changes → liveQuery re-subscribe) → Task 2; every Today test awaits `findBy` post-load, plus the 90-day test.
3. **Equal-elapsed windows ≠ whole weeks** — a fixture where the whole-week reading would say `↑` but the elapsed reading says `↓` → Task 6, `compares identical elapsed windows, not whole weeks`.
4. **Counts can rise while the rate falls** (mid-week habit creation) → Task 6, `compares rates, not counts, when a habit starts mid-week`.
5. **The 4.00pp float boundary** — `0.87 − 0.83` must read as an arrow, `3.99pp` as Same → Task 6, `pins the 4pp tolerance boundary`.
6. **Rule precedence** quiet → first week → just getting started → tolerance → Task 6, `pins precedence…`.
7. **A bonus raises Completions/Active Days but never the rate or `X of Y`** — asserted together → Task 1 matrix row 3 (unit) + Task 6 tile test (integration).
8. **Frequency edits reinterpret history (§9.1)** — pinned explicitly → Task 1, `pins a frequency edit to §9.1…`.
9. **SSR must never scroll or leak today-derived payloads** → Task 4 `does not scroll during server render` + Task 1's existing heatmap prerender tests stay green.
10. **Data arrival must not re-scroll the user's viewport**; returning to the current year must re-apply → Task 4, `scrolls on mount, ignores data arrivals, and re-applies when returning…`.
11. **Seed numbers must not move** (every seed day is scheduled → `bonus` is always 0) → Task 1's full-suite gate runs `seed.test.ts` untouched.

## Known edges flagged for later slices (reviewer addition)

- **N = 10 reads as "Just getting started" most mornings for a small habit set.** With 2–3 daily habits a Monday-start window holds only 6–9 scheduled slots, so the trend tile shows `Just getting started · All year: X%` every week until Wednesday-ish crosses ten slots — the spec §8 rule is working as written, but for her likely habit count the comparison copy will rarely appear early in the week. Flagged for **slice 3 (retention)** to revisit the N threshold or the copy ladder for small sets. Not a slice-1a defect; no test or code change here.

## File structure

| File | Change | Task |
|---|---|---|
| `src/lib/stats.ts` | `DayStat.bonus`, `dayStat`, `countActiveDays`, `sumCompletions`, `currentStreak`, `longestStreak`, `heatmapCells`/`HeatCell` · `allTimeStart` · `weekWindows`, `trendCopy`, `weekTrend` | 1 · 2 · 6 |
| `src/lib/streaks.ts` | completed-first walk (off-schedule completions count) | 1 |
| `src/components/Heatmap.tsx` | bonus tooltip/aria branch · `hm-scroll` + scroll effect | 1 · 4 |
| `src/components/TodayScreen.tsx` | `rangeStart = allTimeStart(...)`, `overallStreak` window, `data-testid="header-streak"` | 2 |
| `src/components/StatsScreen.tsx` | `minYear` via `allTimeStart` · trend-tile swap | 2 · 6 |
| `src/components/HabitRow.tsx` | quantity/timer ring centers + normative aria | 3 |
| `src/components/HabitForm.tsx` | intention chips + `placeholder="Type your own…"` | 5 |
| `src/lib/labels.ts` | `intentionSuggestions` | 5 |
| `src/lib/dates.ts` | `mondayOf` | 6 |
| `src/components/StatTile.tsx` | optional `sub` line | 6 |
| `src/lib/stats.test.ts` | matrix, streaks, heatmap levels, `allTimeStart`, `weekWindows`, `trendCopy` | 1 · 2 · 6 |
| `src/lib/streaks.test.ts` | off-schedule badge | 1 |
| `src/components/Heatmap.test.tsx` | bonus tooltip · 5 scroll tests | 1 · 4 |
| `src/components/TodayScreen.test.tsx` | 90-day header/badge · header==tile | 2 |
| `src/components/HabitRow.test.tsx` | R2 names/states | 3 |
| `src/lib/labels.test.ts` | **create** — suggestion helper | 5 |
| `src/components/HabitForm.test.tsx` | chip behavior | 5 |
| `src/lib/colors.test.ts` | case-insensitive pin | 5 |
| `src/lib/dates.test.ts` | `mondayOf` | 6 |
| `src/components/StatsScreen.test.tsx` | caption swap + 10 trend-tile renders | 6 |

---

### Task 1: R4 — Off-schedule completions count, never penalize

**Files:**
- Modify: `src/lib/stats.ts`, `src/lib/streaks.ts`, `src/components/Heatmap.tsx`
- Test: `src/lib/stats.test.ts`, `src/lib/streaks.test.ts`, `src/components/Heatmap.test.tsx`

**Interfaces:**
- Consumes: existing `DayStat`, `HeatCell`, `isScheduled`, `isCompleted`, `levelFor`.
- Produces: `DayStat.bonus: number` and `HeatCell.bonus: number` = completions of habits *not* scheduled that date (entries whose habit is missing or not yet completed are ignored). `active = completed > 0 || bonus > 0`. `countActiveDays` = active days (any). `sumCompletions` = Σ(`completed + bonus`) over all days. `currentStreak`/`longestStreak`/`habitStreaks`: a day with any completion **counts** (even unscheduled); a day with nothing scheduled and nothing logged is **skipped**; a due day with no completion **ends** the run; the reference day never breaks. Heatmap `level = max(levelFor(ratio, completed), bonus > 0 ? 1 : 0)` for in-year non-future days. Tooltip/aria: `scheduled === 0 && bonus > 0` → `{n} completed (off schedule)` with no percent line. **Unchanged (scheduled-slot family):** `completionRate`, `countPerfectDays`, `perIntentionTotals`, scheduled-day tooltips, `levelFor` grading itself.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/stats.test.ts` (existing imports of `buildDayStats`, `countActiveDays`, `completionRate`, `currentStreak`, `longestStreak`, `heatmapCells`, `sumCompletions`, `habit`, `entry` all cover this):

```ts
describe('off-schedule completions (spec §6 matrix)', () => {
  const daily = habit();                              // Every day, createdAt 0
  const weekdays = habit({ id: 'w', frequency: [1, 2, 3, 4, 5] });
  // Mon + Wed only — the off-schedule Tuesday for rows 3–4 (fixture correction:
  // the original [1,2,3,4,5] contradicted the rows' "Mon + Wed are due" comments
  // and their `scheduled: 0` / `{completed: 2, scheduled: 2}` assertions).
  const mwf = habit({ id: 'w', frequency: [1, 3] });

  it('row 1 — scheduled day with a completion: counts everywhere', () => {
    const stats = buildDayStats([daily], [entry('h1', '2026-09-21', 1)],
                                { from: '2026-09-21', to: '2026-09-21' });
    expect(stats.get('2026-09-21')).toMatchObject(
      { scheduled: 1, completed: 1, bonus: 0, active: true, perfect: true, ratio: 1 });
    expect(countActiveDays(stats)).toBe(1);
    expect(sumCompletions(stats)).toBe(1);
    expect(currentStreak(stats, '2026-09-21')).toBe(1);
  });

  it('row 2 — scheduled day, nothing done: not active, not perfect', () => {
    const stats = buildDayStats([daily], [], { from: '2026-09-21', to: '2026-09-21' });
    expect(stats.get('2026-09-21')).toMatchObject(
      { scheduled: 1, completed: 0, bonus: 0, active: false, perfect: false });
    expect(countActiveDays(stats)).toBe(0);
    expect(sumCompletions(stats)).toBe(0);
  });

  it('row 3 — unscheduled day with a completion: counts in Completions and active days, never in the rate', () => {
    // Mon + Wed are due; Tue was logged anyway (spec §6's bonus column).
    const stats = buildDayStats(
      [mwf],
      [entry('w', '2026-09-21', 1), entry('w', '2026-09-22', 1), entry('w', '2026-09-23', 1)],
      { from: '2026-09-21', to: '2026-09-23' },
    );
    expect(stats.get('2026-09-22')).toMatchObject(
      { scheduled: 0, completed: 0, bonus: 1, active: true, perfect: false, ratio: 0 });
    // The two families, asserted together (spec §6): the all-completions
    // family rises with the bonus; the scheduled-slot family never sees it.
    expect(countActiveDays(stats)).toBe(3);
    expect(sumCompletions(stats)).toBe(3);
    expect(completionRate(stats)).toEqual({ completed: 2, scheduled: 2, rate: 1 });
  });

  it('row 4 — unscheduled day, nothing logged: skipped everywhere', () => {
    const stats = buildDayStats([mwf], [], { from: '2026-09-21', to: '2026-09-22' }); // window Mon + Tue
    expect(stats.get('2026-09-22')).toMatchObject(
      { scheduled: 0, completed: 0, bonus: 0, active: false, ratio: 0 });
    expect(countActiveDays(stats)).toBe(0);
    expect(sumCompletions(stats)).toBe(0);
    expect(currentStreak(stats, '2026-09-22')).toBe(0); // skipped, not broken
  });

  it('counts a bonus day in the current streak (skips only empty days)', () => {
    // Fri 18 done, Sat 19 logged off-schedule, Mon 21 done and referenced.
    const stats = buildDayStats(
      [weekdays],
      [entry('w', '2026-09-18', 1), entry('w', '2026-09-19', 1), entry('w', '2026-09-21', 1)],
      { from: '2026-09-15', to: '2026-09-21' },
    );
    expect(currentStreak(stats, '2026-09-21')).toBe(3); // Mon + Sat-bonus + Fri
  });

  it('lets a bonus day extend the longest run', () => {
    const stats = buildDayStats(
      [weekdays],
      [entry('w', '2026-09-18', 1), entry('w', '2026-09-19', 1), entry('w', '2026-09-21', 1)],
      { from: '2026-09-15', to: '2026-09-21' },
    );
    expect(longestStreak(stats)).toBe(3); // Fri → Sat(bonus) → Mon, Sun skipped
  });

  it('pins a frequency edit to §9.1: the edited-away day counts in Completions, never in the rate', () => {
    // The entry was logged while the habit was daily; the owner later cut it
    // to weekdays. History is re-read against TODAY's frequency (no schedule
    // history is stored — spec §9.1): Sunday becomes a bonus, not a rate hit.
    const edited = habit({ id: 'e', frequency: [1, 2, 3, 4, 5] });
    const stats = buildDayStats([edited], [entry('e', '2026-09-20', 1)],
                                { from: '2026-09-20', to: '2026-09-21' }); // Sun + Mon
    expect(sumCompletions(stats)).toBe(1);
    expect(completionRate(stats)).toEqual({ completed: 0, scheduled: 1, rate: 0 }); // Mon owed, missed
    expect(currentStreak(stats, '2026-09-21')).toBe(1); // Sun's bonus counts; incomplete today never breaks
  });
});

describe('heatmap levels for off-schedule days (spec §6/§7.4)', () => {
  const weekdays = habit({ id: 'w', frequency: [1, 2, 3, 4, 5] });

  it('floors a bonus-only day at level 1 and leaves an untouched day at 0', () => {
    // Sat 13 logged off-schedule; Sun 14 untouched; Mon 15 due but not done.
    const cells = heatmapCells(2026, [weekdays], [entry('w', '2026-06-13', 1)], '2026-06-15');
    expect(cells.find((c) => c.date === '2026-06-13')).toMatchObject(
      { level: 1, bonus: 1, scheduled: 0, completed: 0 });
    expect(cells.find((c) => c.date === '2026-06-14')!.level).toBe(0);
    expect(cells.find((c) => c.date === '2026-06-15')!.level).toBe(0);
  });

  it('floors a scheduled day with only an off-schedule completion at level 1', () => {
    // Mon: swim is due and not done, but the weekend-only habit was logged —
    // the completion still colors the cell (flagged decision 3).
    const swim = habit({ id: 's', frequency: [1, 3, 5] });
    const weekend = habit({ id: 'x', frequency: [0, 6] });
    const cells = heatmapCells(2026, [swim, weekend], [entry('x', '2026-06-15', 1)], '2026-06-15');
    expect(cells.find((c) => c.date === '2026-06-15')).toMatchObject(
      { level: 1, scheduled: 1, completed: 0, bonus: 1 });
  });
});
```

Append to `src/lib/streaks.test.ts`:

```ts
  it('counts a completion on a day the habit was not scheduled (spec §6)', () => {
    const weekdayOnly = habit('w', [1, 2, 3, 4, 5]);
    // Fri 18 done, Sat 19 logged off-schedule, Mon 21 done, today Tue 22 done
    const streaks = habitStreaks(
      [weekdayOnly],
      [entry('w', '2026-09-18'), entry('w', '2026-09-19'), entry('w', '2026-09-21'), entry('w', '2026-09-22')],
      '2026-09-22',
    );
    expect(streaks.w).toBe(4);
  });
```

Append inside the main `describe('Heatmap')` in `src/components/Heatmap.test.tsx` (helpers `habit(id)`, `entry(..., value = 1)`, `render`, `fireEvent`, `screen`, `renderToString` already exist there):

```tsx
  it('shows an off-schedule completion with no percent line (spec §6)', () => {
    const weekdays: Habit = { ...habit('w'), frequency: [1, 2, 3, 4, 5] };
    render(<Heatmap year={2026} habits={[weekdays]} entries={[entry('w', '2026-06-13')]} today="2026-06-15" />);
    fireEvent.mouseEnter(screen.getByTestId('hm-cell-2026-06-13'));
    const tip = screen.getByTestId('hm-tooltip');
    expect(tip).toHaveTextContent('Jun 13, 2026');
    expect(tip).toHaveTextContent('1 completed (off schedule)');
    expect(tip).not.toHaveTextContent('%');
    // Flagged decision 1: the cell's screen-reader name mirrors the tooltip
    // instead of reading "0 of 0".
    expect(screen.getByTestId('hm-cell-2026-06-13'))
      .toHaveAttribute('aria-label', '2026-06-13: 1 completed (off schedule)');
  });
```

- [ ] **Step 2: Run the tests — confirm red**

```
npm test -- src/lib/stats.test.ts src/lib/streaks.test.ts src/components/Heatmap.test.tsx
```

Expect the new tests to fail (`bonus` is `undefined`, streaks short by the bonus day, tooltip/aria unchanged) and **every pre-existing test in these files to stay green** — if an old assertion fails, stop and check it against the §6 matrix before touching anything.

- [ ] **Step 3: Implement — `src/lib/stats.ts`**

Add `bonus` to the interface and compute it in `dayStat` (replace lines 4–53):

```ts
export interface DayStat {
  date: string;
  scheduled: number;
  completed: number;
  bonus: number;      // completions of habits NOT scheduled that day (spec §6)
  ratio: number;
  active: boolean;
  perfect: boolean;
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
```

Replace `countActiveDays` and `sumCompletions` (the `scheduledOnly` helper stays — `countPerfectDays` and `completionRate` still use it):

```ts
export function countActiveDays(stats: Map<string, DayStat>): number {
  return [...stats.values()].filter((s) => s.active).length;
}

export function sumCompletions(stats: Map<string, DayStat>): number {
  return [...stats.values()].reduce((sum, s) => sum + s.completed + s.bonus, 0);
}
```

Replace `currentStreak` (the `scheduled === 0` skip must now come *after* the active check) and `longestStreak`:

```ts
/**
 * Active-day streak walking back from `today`.
 * - Any completion counts, even off-schedule (spec §6).
 * - Days with no scheduled habits and nothing logged are skipped.
 * - An incomplete `today` does not break yesterday's streak (the day isn't over).
 */
export function currentStreak(stats: Map<string, DayStat>, today: string): number {
  let streak = 0;
  let cursor: string | undefined = today;
  while (cursor && stats.has(cursor)) {
    const day = stats.get(cursor)!;
    if (day.active) { streak++; cursor = prevDay(cursor); continue; }      // any completion counts (§6)
    if (day.scheduled === 0) { cursor = prevDay(cursor); continue; }       // neither counts nor breaks
    if (cursor === today) { cursor = prevDay(cursor); continue; }          // today isn't over yet
    break;                                                                 // a missed scheduled day ends the run
  }
  return streak;
}

export function longestStreak(stats: Map<string, DayStat>): number {
  let best = 0;
  let run = 0;
  for (const day of [...stats.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    if (day.active) { run++; best = Math.max(best, run); continue; } // completions count, incl. off-schedule
    if (day.scheduled === 0) continue;                               // skipped day: neither counts nor breaks
    run = 0;                                                          // missed scheduled day ends the run
  }
  return best;
}
```

In `heatmapCells`, add `bonus` to `HeatCell` (`bonus: number;` in the interface), populate it (`bonus: day?.bonus ?? 0,`), and replace the level line:

```ts
  for (let i = 0; i < daysNeeded; i++) {
    const date = nextDayShift(start, i);
    const inYearDay = inYear.includes(date);
    const day = inYearDay ? dayStat(date, habits, byDate) : null;
    const future = date > today;
    const level = !day || future
      ? 0
      : Math.max(levelFor(day.ratio, day.completed), day.bonus > 0 ? 1 : 0);
    cells.push({
      date,
      inYear: inYearDay,
      future,
      completed: day?.completed ?? 0,
      scheduled: day?.scheduled ?? 0,
      bonus: day?.bonus ?? 0,
      ratio: day?.ratio ?? 0,
      level: level as HeatCell['level'],
    });
  }
```

- [ ] **Step 4: Implement — `src/lib/streaks.ts`**

Replace the today-block and the walk loop (the `guard` and `cursor` mechanics stay):

```ts
    // Today only extends the streak; it never breaks it. Completions count
    // even on days the habit was not scheduled (spec §6).
    if (completedOn(cursor)) streak = 1;
    cursor = addDays(cursor, -1);

    for (let guard = 0; guard < 370; guard++, cursor = addDays(cursor, -1)) {
      if (completedOn(cursor)) { streak++; continue; } // counts even off-schedule (§6)
      if (scheduledOn(cursor)) break;                  // a missed due day ends the run
      // not due, not completed: skipped — neither counts nor breaks
    }
```

Update the function's doc comment to say "consecutive days the habit was completed (even off-schedule); due-but-missed days end the run; not-due days are skipped."

- [ ] **Step 5: Implement — `src/components/Heatmap.tsx`**

Tooltip: replace the two `<p>` payload lines inside the `tooltip &&` block with a branch (the date line above stays):

```tsx
            <p className="font-bold">{formatShort(tooltip.date)}, {tooltip.date.slice(0, 4)}</p>
            {tooltip.scheduled === 0 && tooltip.bonus > 0 ? (
              <p className="text-[var(--color-subtle)]">{tooltip.bonus} completed (off schedule)</p>
            ) : (
              <>
                <p className="text-[var(--color-subtle)]">
                  {tooltip.completed} of {tooltip.scheduled} completed
                </p>
                <p className="text-[var(--color-subtle)]">
                  {tooltip.scheduled ? Math.round((tooltip.completed / tooltip.scheduled) * 100) : 0}%
                </p>
              </>
            )}
```

Cell aria-label (the in-year `<button>` only; keep `suppressHydrationWarning` exactly where it is — the source-level test counts it):

```tsx
                      aria-label={
                        cell.scheduled === 0 && cell.bonus > 0
                          ? `${cell.date}: ${cell.bonus} completed (off schedule)`
                          : `${cell.date}: ${cell.completed} of ${cell.scheduled} completed`
                      }
```

- [ ] **Step 6: Run the tests — confirm green**

```
npm test -- src/lib/stats.test.ts src/lib/streaks.test.ts src/components/Heatmap.test.tsx
```

- [ ] **Step 7: Gates + commit**

```
npm test
npm run typecheck
npm run lint
npm run build
```

Full-suite watch-outs: `src/lib/seed.test.ts` must pass **untouched** (Review Focus 11 — every seed day is scheduled, so `bonus` is always 0). Existing `stats.test` streak/level/summary tests and `Heatmap.test` scheduled-tooltip/SSR tests are matrix-compatible and must stay green as written.

#### Before/after record (R4) — reviewer addition

Recorded here and carried into the commit message. Values are read off the fixtures the new matrix tests use; the red run displays the "before" numbers as `Received:` values.

| Fixture | Metric | Before T1 | After T1 |
|---|---|---|---|
| Row 3: Mon+Wed due, Tue logged anyway (Sep 21–23) | Completions tile | 2 | **3** |
| Row 3 | Active Days tile | 2 | **3** |
| Row 3 | Completion Rate | 100% (2/2) | **100% (2/2) — unchanged by design** |
| Fri done + Sat off-schedule + Mon done, today Mon | Current Streak | 2 | **3** |
| same fixture | Longest Streak | 2 | **3** |
| habitStreaks: Fri, Sat(off), Mon, today Tue | Per-habit badge | 3 | **4** |
| Seed data (13 weeks, `seed.test.ts`) | Completions / all streaks | — | **unchanged** — seed never logs an unscheduled day, so `bonus ≡ 0` and the file stays green untouched |

```
git add src/lib/stats.ts src/lib/streaks.ts src/lib/stats.test.ts src/lib/streaks.test.ts src/components/Heatmap.tsx src/components/Heatmap.test.tsx
git commit -m "fix(stats): off-schedule completions count in streaks, tiles and cells — never in the rate (R4)" -m "before/after: Row-3 Completions 2→3, Active 2→3, rate pinned 2/2; Current+Longest streak 2→3; habit badge 3→4; seed unchanged (bonus=0)"
```

---

### Task 2: R1 — One shared, uncapped streak window

**Files:**
- Modify: `src/lib/stats.ts`, `src/components/TodayScreen.tsx`, `src/components/StatsScreen.tsx`
- Test: `src/lib/stats.test.ts`, `src/components/TodayScreen.test.tsx`

**Interfaces:**
- Consumes: `Habit.createdAt`.
- Produces: `allTimeStart(habits): string` — `${earliest habit createdAt year}-01-01`, or the fixed early constant `2000-01-01` for an empty list. Today's `rangeStart` = `allTimeStart(habits ?? [])` feeds both `loadRange(rangeStart, date)` and `buildDayStats(..., { from: rangeStart, to: date })`; Stats' `minYear` derives from the same helper. Header flame span gains `data-testid="header-streak"` (test-only).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/stats.test.ts` (add `allTimeStart` to the existing `./stats` import):

```ts
describe('allTimeStart', () => {
  it('is Jan 1 of the earliest habit creation year (shared by Today and Stats)', () => {
    expect(allTimeStart([
      habit({ createdAt: Date.parse('2024-05-06T10:00:00') }),
      habit({ createdAt: Date.parse('2026-01-02T00:00:00') }),
    ])).toBe('2024-01-01');
  });

  it('falls back to the fixed early constant before habits exist', () => {
    expect(allTimeStart([])).toBe('2000-01-01');
  });
});
```

Append to `src/components/TodayScreen.test.tsx` (file already imports `render, screen, within`, `putHabit, putEntry`, `addDays, todayKey`, `habit`, `TodayScreen`):

```tsx
// Spec §3 (R1): one shared, uncapped streak window for Today and Stats.
describe('shared all-time streak (R1)', () => {
  const longFixture = async () => {
    const h = habit({ name: 'Meditate' });
    h.createdAt = Date.parse(`${addDays(todayKey(), -89)}T09:00:00`);
    await putHabit(h);
    for (let i = 0; i < 90; i++) await putEntry(h.id, addDays(todayKey(), -i), 1);
    return h;
  };

  it('shows an uncapped 90-day streak in the header and on the habit badge', async () => {
    await longFixture();
    render(<TodayScreen />);
    // Old code capped both at 41 (a 40-day window + today).
    expect(await screen.findByTestId('header-streak')).toHaveTextContent('90');
    expect(screen.getByTestId('flame-badge')).toHaveTextContent('90');
  });

  it('matches the Stats Current Streak tile on the same data', async () => {
    await longFixture();
    render(<TodayScreen />);
    const header = await screen.findByTestId('header-streak');

    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    const tile = (await screen.findByText('Current Streak')).closest('div')!;
    const tileValue = within(tile).getByText('90');
    expect(header.textContent?.trim()).toBe(tileValue.textContent?.trim());
  });
});
```

- [ ] **Step 2: Run the tests — confirm red**

```
npm test -- src/lib/stats.test.ts src/components/TodayScreen.test.tsx
```

`allTimeStart` does not exist (import error = red) and `header-streak` is never found. Existing tests in both files stay green.

- [ ] **Step 3: Implement**

`src/lib/stats.ts` — append:

```ts
const EARLIEST_KEY = '2000-01-01';

/**
 * The one window both screens share (spec §3/R1): Jan 1 of the earliest
 * habit's creation year. Empty list → a fixed early constant, so Today's
 * entry query can subscribe before habits have loaded, then refine.
 */
export function allTimeStart(habits: Habit[]): string {
  if (habits.length === 0) return EARLIEST_KEY;
  const earliest = Math.min(...habits.map((h) => h.createdAt));
  return `${new Date(earliest).getFullYear()}-01-01`;
}
```

`src/components/TodayScreen.tsx`:

1. Import: `import { allTimeStart, buildDayStats, currentStreak } from '@/lib/stats';` and drop `addDays` from the `@/lib/dates` import (it becomes unused).
2. Replace the 40-day window (lines 65–68):

```tsx
  const habits = useLiveQuery(() => listHabits(), []);
  // Spec §3/R1: full history — the same window Stats uses. Before habits
  // load this is the fixed early constant; liveQuery re-subscribes when the
  // earliest createdAt year refines it.
  const rangeStart = allTimeStart(habits ?? []);
  const entries = useLiveQuery(() => loadRange(rangeStart, date), [rangeStart, date]);
```

3. Replace the `overallStreak` memo body's window and deps:

```tsx
  const overallStreak = useMemo(() => {
    if (!habits || !entries) return 0;
    const stats = buildDayStats(habits, entries, { from: rangeStart, to: date });
    return currentStreak(stats, date);
  }, [habits, entries, date, rangeStart]);
```

4. Header flame span (line ~152) gains the test id (no visual change):

```tsx
          <span data-testid="header-streak" className="flex items-center gap-1 text-sm font-bold">
```

`src/components/StatsScreen.tsx` — import `allTimeStart` alongside the other `@/lib/stats` imports and replace the `minYear` effect body (same math, now shared):

```tsx
  useEffect(() => {
    if (!habits?.length) return;
    setMinYear(Math.min(Number(allTimeStart(habits).slice(0, 4)), maxYear));
  }, [habits, maxYear]);
```

- [ ] **Step 4: Run the tests — confirm green**

```
npm test -- src/lib/stats.test.ts src/components/TodayScreen.test.tsx
```

- [ ] **Step 5: Gates + commit**

```
npm test
npm run typecheck
npm run lint
npm run build
git add src/lib/stats.ts src/lib/stats.test.ts src/components/TodayScreen.tsx src/components/TodayScreen.test.tsx src/components/StatsScreen.tsx
git commit -m "fix(today): header and habit streaks read from the full shared history window (R1)"
```

Watch-outs: `TodayScreen` SSR test (`emits clock-independent HTML…`) must stay green — `habits` is `undefined` server-side, so `rangeStart` is the constant and the body still renders `Loading`. `StatsScreen`'s tile/caption tests are untouched by the `minYear` refactor.

---

### Task 3: R2 — Completed state for quantity & timer rows

**Files:**
- Modify: `src/components/HabitRow.tsx`
- Test: `src/components/HabitRow.test.tsx`

**Interfaces:**
- Consumes: existing `done` flag (`boolean ? value > 0 : ratio >= 1`), `ProgressRing`, lucide `Check`.
- Produces (normative, spec §4): quantity ring center = `Check` when done (percent otherwise); timer ring center = `Check` when done (`Plus` otherwise). Aria names: quantity done → `Set exact value for {name}, {value} of {target} {unit}, completed`; timer done → `Open timer for {name}, {m} of {m} minutes, completed` (`m = target / 60`). Not-done and boolean labels unchanged. Steppers, ring-tap targets, fill, subtext unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/HabitRow.test.tsx` (helpers `qtyHabit`, `timerHabit`, `base`, `render/screen`, `vi` exist):

```tsx
  // Spec §4 (R2): quantity and timer rows must show a completed state.
  it('uses the normative done and not-done names on the quantity ring (R2)', () => {
    const spanish = { ...qtyHabit, name: 'Learn Spanish', target: 45, unit: 'minutes' };
    const { rerender } = render(<HabitRow habit={spanish} value={44} onToggle={vi.fn()} {...base} />);
    const notDone = screen.getByRole('button', { name: 'Set exact value for Learn Spanish' });
    expect(notDone).toHaveTextContent('98'); // percent center below target (44/45)

    rerender(<HabitRow habit={spanish} value={45} onToggle={vi.fn()} {...base} />);
    const done = screen.getByRole('button', {
      name: 'Set exact value for Learn Spanish, 45 of 45 minutes, completed',
    });
    expect(done).not.toHaveTextContent(/\d/); // check replaces the percent
    expect(done.querySelector('svg.lucide-check')).toBeInTheDocument();

    // Over target stays done (spec §4).
    rerender(<HabitRow habit={spanish} value={50} onToggle={vi.fn()} {...base} />);
    expect(screen.getByRole('button', {
      name: 'Set exact value for Learn Spanish, 50 of 45 minutes, completed',
    })).toBeInTheDocument();
  });

  it('keeps the quantity steppers while done (R2)', () => {
    const spanish = { ...qtyHabit, name: 'Learn Spanish', target: 45, unit: 'minutes' };
    render(<HabitRow habit={spanish} value={45} onToggle={vi.fn()} {...base} onStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add one minutes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove one minutes/i })).toBeInTheDocument();
  });

  it('swaps the timer plus for a check and announces completion (R2)', () => {
    const { rerender } = render(<HabitRow habit={timerHabit} value={300} onToggle={vi.fn()} {...base} />);
    const notDone = screen.getByRole('button', { name: 'Open timer for Meditate' });
    expect(notDone.querySelector('svg.lucide-plus')).toBeInTheDocument(); // not-done name + plus unchanged

    rerender(<HabitRow habit={timerHabit} value={900} onToggle={vi.fn()} {...base} />);
    const done = screen.getByRole('button', {
      name: 'Open timer for Meditate, 15 of 15 minutes, completed',
    });
    expect(done.querySelector('svg.lucide-check')).toBeInTheDocument();
    expect(done.querySelector('svg.lucide-plus')).toBeNull();
  });
```

(`svg.lucide-*` is the proven lucide assertion pattern — `IntentionBar.test.tsx:29` uses it.)

- [ ] **Step 2: Run the tests — confirm red**

```
npm test -- src/components/HabitRow.test.tsx
```

The three new tests fail (percent still renders, no `completed` suffix, `lucide-check` absent in rings); the seven existing row tests stay green.

- [ ] **Step 3: Implement — `src/components/HabitRow.tsx`**

Timer control (lines 79–86) becomes:

```tsx
        {habit.type === 'timer' && (
          <button type="button"
                  aria-label={done
                    ? `Open timer for ${habit.name}, ${Math.round(habit.target / 60)} of ${Math.round(habit.target / 60)} minutes, completed`
                    : `Open timer for ${habit.name}`}
                  onClick={onOpenTimer}
                  className="shrink-0 rounded-full">
            <ProgressRing size={40} stroke={4} progress={ratio} color={habit.color}>
              {done ? <Check size={18} color="#fff" strokeWidth={3} /> : <Plus size={18} color="#fff" />}
            </ProgressRing>
          </button>
        )}
```

Quantity ring control (lines 88–95) becomes:

```tsx
        {habit.type === 'quantity' && (
          <button type="button"
                  aria-label={done
                    ? `Set exact value for ${habit.name}, ${value} of ${habit.target}${habit.unit ? ` ${habit.unit}` : ''}, completed`
                    : `Set exact value for ${habit.name}`}
                  onClick={onOpenValue}
                  className="shrink-0 rounded-full">
            <ProgressRing size={40} stroke={4} progress={ratio} color={habit.color}>
              {done ? (
                <Check size={16} color="#fff" strokeWidth={3} />
              ) : (
                <span className="text-[10px] font-bold text-white">{Math.round(ratio * 100)}</span>
              )}
            </ProgressRing>
          </button>
        )}
```

The boolean block, both stepper blocks, `fill`, `subtext`, and `FlameBadge` are untouched.

- [ ] **Step 4: Run the tests — confirm green**

```
npm test -- src/components/HabitRow.test.tsx
```

- [ ] **Step 5: Gates + commit**

```
npm test
npm run typecheck
npm run lint
npm run build
git add src/components/HabitRow.tsx src/components/HabitRow.test.tsx
git commit -m "fix(row): quantity and timer rings show a completed state with announced names (R2)"
```

Watch-out: `clamps the visual ratio…` renders `value={8}` (done) but asserts only `habit-fill` width — it must stay green without edits.

---

### Task 4: R3 — Heatmap auto-scrolls to the current week

**Files:**
- Modify: `src/components/Heatmap.tsx`
- Test: `src/components/Heatmap.test.tsx`

**Interfaces:**
- Consumes: existing `weekColumn(key, year)` from `src/lib/dates.ts`, `CELL`(13) + `GAP`(3), the `mounted` clock gate.
- Produces: the scroll container div carries `data-testid="hm-scroll"` and a ref. One effect, post-mount only: when `year === Number(today.slice(0, 4))`, `left = max(0, weekColumn(today, year) * (CELL + GAP) + CELL - clientWidth)`; if `scrollLeft < left`, either `scrollTo({ left, behavior: 'smooth' })` or, under `prefers-reduced-motion: reduce`, assign `scrollLeft` directly. Effect deps: `[mounted, today, year, cellSize]` — never `entries`/`cells`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('Heatmap')` in `src/components/Heatmap.test.tsx`. Import updates first (the file has neither today): add `beforeEach, afterEach` to the `vitest` import (line 6) and add `import { weekColumn } from '@/lib/dates';` after the `@/lib/types` import. This block owns its DOM shims — restore them explicitly rather than `vi.restoreAllMocks()` so the file's `push` router mock keeps its behavior:

```tsx
  // Spec §5 (R3): bring today's column into view — current year only,
  // post-mount only, instant under prefers-reduced-motion.
  describe('auto-scroll', () => {
    const scrollTo = vi.fn();
    let savedScrollTo: PropertyDescriptor | undefined;
    let savedMatchMedia: typeof window.matchMedia;
    let clientWidthSpy: ReturnType<typeof vi.spyOn> | undefined;

    beforeEach(() => {
      scrollTo.mockClear();
      savedScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo');
      savedMatchMedia = window.matchMedia;
      Object.defineProperty(Element.prototype, 'scrollTo',
        { value: scrollTo, configurable: true, writable: true });
      // jsdom has no layout: stub the container width (Element owns clientWidth).
      clientWidthSpy = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100);
    });

    afterEach(() => {
      clientWidthSpy?.mockRestore();
      window.matchMedia = savedMatchMedia;
      if (savedScrollTo) Object.defineProperty(Element.prototype, 'scrollTo', savedScrollTo);
      else delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
    });

    const expectedLeft = (today: string, year: number) =>
      Math.max(0, weekColumn(today, year) * (13 + 3) + 13 - 100); // CELL 13 + GAP 3, clientWidth 100

    it("scrolls today's column to the edge on mount (current year)", () => {
      render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ left: expectedLeft('2026-09-30', 2026), behavior: 'smooth' });
    });

    it('sets scrollLeft directly under prefers-reduced-motion and never calls scrollTo', () => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes('reduce'), media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      })) as typeof window.matchMedia;
      render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(screen.getByTestId('hm-scroll').scrollLeft).toBe(expectedLeft('2026-09-30', 2026));
    });

    it('never scrolls a past-year view (it opens at January)', () => {
      render(<Heatmap year={2025} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does not scroll during server render', () => {
      renderToString(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls on mount, ignores data arrivals, and re-applies when returning to the current year', () => {
      const props = { year: 2026, habits: [habit('a')], entries: [] as Entry[], today: '2026-09-30' };
      const { rerender } = render(<Heatmap {...props} />);
      expect(scrollTo).toHaveBeenCalledTimes(1);

      rerender(<Heatmap {...props} entries={[entry('a', '2026-09-29')]} />);
      expect(scrollTo).toHaveBeenCalledTimes(1);   // data arrival must not re-scroll

      const el = screen.getByTestId('hm-scroll');
      el.scrollLeft = 0;                            // pretend the viewport sits at January
      rerender(<Heatmap {...props} year={2025} />);
      expect(scrollTo).toHaveBeenCalledTimes(1);    // past year: gated
      rerender(<Heatmap {...props} year={2026} />);
      expect(scrollTo).toHaveBeenCalledTimes(2);    // back to the current year: re-applies (spec §5)
    });
  });
```

- [ ] **Step 2: Run the tests — confirm red**

```
npm test -- src/components/Heatmap.test.tsx
```

All five new scroll tests fail (`hm-scroll` missing / no `scrollTo` call); every existing heatmap test stays green.

- [ ] **Step 3: Implement — `src/components/Heatmap.tsx`**

1. Import: add `weekColumn` to the `@/lib/dates` imports.
2. Add the ref next to `sectionRef`:

```tsx
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
```

3. Add the effect after the existing `useEffect`s (the mount gate at line 33 and the listener effect at line 52), before the return. The clock gate: `clock` is `''` pre-mount, so gate on `mounted` explicitly:

```tsx
  // Spec §5/R3: bring the column containing today fully into view — current
  // year only, post-mount only, instant under prefers-reduced-motion. Deps
  // exclude entries/cells so data arrivals never re-scroll the viewport.
  useEffect(() => {
    if (!mounted || year !== Number(today.slice(0, 4))) return;
    const el = scrollRef.current;
    if (!el) return;
    const left = Math.max(0, weekColumn(today, year) * (cellSize + GAP) + cellSize - el.clientWidth);
    if (el.scrollLeft >= left) return; // already visible — leave the user's position alone
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollLeft = left;
    } else {
      el.scrollTo({ left, behavior: 'smooth' });
    }
  }, [mounted, today, year, cellSize]);
```

4. Attach ref + testid to the horizontal scroll container (line ~103):

```tsx
          <div ref={scrollRef} data-testid="hm-scroll" className="min-w-0 flex-1 overflow-x-auto pb-1">
```

- [ ] **Step 4: Run the tests — confirm green**

```
npm test -- src/components/Heatmap.test.tsx
```

- [ ] **Step 5: Gates + commit**

```
npm test
npm run typecheck
npm run lint
npm run build
git add src/components/Heatmap.tsx src/components/Heatmap.test.tsx
git commit -m "fix(heatmap): auto-scroll to the current week, current year only (R3)"
```

Watch-outs: the source-level `suppressHydrationWarning` test and the SSR payload test must stay green — this task adds no date-derived DOM.

---

### Task 5: R5 — Intention suggestion chips

**Files:**
- Modify: `src/lib/labels.ts`, `src/components/HabitForm.tsx`
- Create: `src/lib/labels.test.ts`
- Test: `src/components/HabitForm.test.tsx`, `src/lib/colors.test.ts`

**Interfaces:**
- Consumes: `intentions?: string[]` prop (both call sites already pass it), Combobox's existing `placeholder` prop, the frequency-chip visual pattern.
- Produces: `intentionSuggestions(inUse: string[]): string[]` — in-use first (trimmed, deduped case-insensitively via a `trim().lowercase()` key, displayed in first-seen casing), then presets `Health, Calm, Growth, Joy` skipping anything already present. `HabitForm` renders them as `aria-pressed` buttons under the intention input (`aria-label` = the plain chip label so the `✓` never enters the accessible name); a selected chip renders a leading `✓` **in addition to** the accent fill. Intention input gets `placeholder="Type your own…"`; category input untouched. Grouping/migration untouched (§9/§10).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { intentionSuggestions } from './labels';

describe('intentionSuggestions', () => {
  it('lists in-use intentions first, deduped case-insensitively in first-seen casing', () => {
    expect(intentionSuggestions(['Study', 'study', ' Be Grateful ']))
      .toEqual(['Study', 'Be Grateful', 'Health', 'Calm', 'Growth', 'Joy']); // in-use first, then presets (fixture correction: the original expectation omitted them, contradicting this task's interface line, test 2 below, and the HabitForm chip test)
  });

  it('appends presets the user has not used yet, skipping already-used ones', () => {
    expect(intentionSuggestions(['health'])).toEqual(['health', 'Calm', 'Growth', 'Joy']);
    expect(intentionSuggestions([])).toEqual(['Health', 'Calm', 'Growth', 'Joy']);
  });
});
```

Append to `src/components/HabitForm.test.tsx` (inside the existing `describe('HabitForm')`; `habit`, `render/screen`, `fireEvent`, `vi` exist):

```tsx
  // Spec §7 (R5): intention chips under the intention field.
  it('shows in-use intentions then presets as chips, deduped case-insensitively (R5)', () => {
    const { container } = render(
      <HabitForm habit={{ ...habit, intention: 'study' }} open onSave={vi.fn()} onClose={vi.fn()}
                 intentions={['Study', 'study', 'Be Grateful']} />
    );
    const chips = container.querySelectorAll('[data-field="intention"] button');
    expect([...chips].map((c) => c.getAttribute('aria-label'))).toEqual(
      ['Study', 'Be Grateful', 'Health', 'Calm', 'Growth', 'Joy'] // deduped, presets last
    );
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');     // draft 'study' ≡ chip 'Study'
    expect(chips[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('taps a chip into the intention with a non-color selected cue (R5)', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, intention: '' }} open onSave={onSave} onClose={vi.fn()}
                     intentions={['Study']} />);
    const chip = screen.getByRole('button', { name: 'Health' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip).not.toHaveTextContent('✓');
    fireEvent.click(chip);
    expect(screen.getByLabelText('Intention')).toHaveValue('Health');
    const pressed = screen.getByRole('button', { name: 'Health' });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(pressed).toHaveTextContent('✓'); // glyph + state, never color alone
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].intention).toBe('Health');
  });

  it('points the custom path at the input: placeholder + free typing still win (R5)', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, intention: '' }} open onSave={onSave} onClose={vi.fn()}
                     intentions={['Study']} />);
    expect(screen.getByLabelText('Intention')).toHaveAttribute('placeholder', 'Type your own…');
    expect(screen.getByLabelText('Category')).toHaveAttribute('placeholder', 'Choose or type category'); // untouched

    fireEvent.change(screen.getByLabelText('Intention'), { target: { value: 'Deep focus' } });
    for (const name of ['Study', 'Health'])
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].intention).toBe('Deep focus');
  });
```

Append to `src/lib/colors.test.ts` inside `describe('intentionColor')`:

```ts
  it('is case-insensitive across spellings (spec R5 pin)', () => {
    expect(intentionColor('study')).toBe(intentionColor('Study'));
  });
```

- [ ] **Step 2: Run the tests — confirm red**

```
npm test -- src/lib/labels.test.ts src/components/HabitForm.test.tsx src/lib/colors.test.ts
```

`labels.test` fails on the missing export; the three HabitForm tests fail (no chips/placeholder); the colors pin is **green already** (`colors.ts:29` already normalizes — the spec pinned it deliberately).

- [ ] **Step 3: Implement — `src/lib/labels.ts`**

Append:

```ts
const INTENTION_PRESETS = ['Health', 'Calm', 'Growth', 'Joy'];

/**
 * Chip row for the intention field (spec §7/R5): in-use intentions first —
 * trimmed, deduped case-insensitively, shown in first-seen casing — then the
 * presets the user hasn't used yet. Free text stays the input's job.
 */
export function intentionSuggestions(inUse: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...inUse, ...INTENTION_PRESETS]) {
    const value = raw.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
```

- [ ] **Step 4: Implement — `src/components/HabitForm.tsx`**

1. Import: `import { intentionSuggestions } from '@/lib/labels';`
2. Intention field block (`data-field="intention"`) — add `placeholder` to the Combobox and the chip row between it and the swatch paragraph:

```tsx
        <div data-field="intention">
          <Combobox label="Intention" value={draft.intention} options={intentions}
                    listId="habit-intention-list" placeholder="Type your own…"
                    onChange={(v) => set('intention', v)} />
          {/* Spec §7/R5: suggestion chips — the input above remains the custom path. */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {intentionSuggestions(intentions).map((suggestion) => {
              const active = draft.intention.trim().toLowerCase() === suggestion.toLowerCase();
              return (
                <button key={suggestion} type="button" aria-label={suggestion}
                        aria-pressed={active} onClick={() => set('intention', suggestion)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                          active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                                 : 'border-[var(--color-line)]'
                        }`}>
                  {active ? '✓ ' : ''}{suggestion}
                </button>
              );
            })}
          </div>
          <p className="mt-1 flex items-center gap-2 text-xs text-[var(--color-subtle)]">
            …unchanged swatch paragraph…
          </p>
        </div>
```

(The `✓` is decorative reinforcement; `aria-label` keeps the accessible name clean and `aria-pressed` carries the state — never color alone.)

- [ ] **Step 5: Run the tests — confirm green**

```
npm test -- src/lib/labels.test.ts src/components/HabitForm.test.tsx src/lib/colors.test.ts
```

- [ ] **Step 6: Gates + commit**

```
npm test
npm run typecheck
npm run lint
npm run build
git add src/lib/labels.ts src/lib/labels.test.ts src/components/HabitForm.tsx src/components/HabitForm.test.tsx src/lib/colors.test.ts
git commit -m "feat(form): intention suggestion chips with a custom-path placeholder (R5)"
```

Watch-outs: the `exposes every field, in order` test must stay green (chips live *inside* the intention div — `data-field` order unchanged); frequency-chip tests must stay green (no accessible-name collisions: no preset is a weekday/frequency label).

---

### Task 6: R6 — Weekly trend tile (replaces Completion Rate)

**Files:**
- Modify: `src/lib/dates.ts`, `src/lib/stats.ts`, `src/components/StatTile.tsx`, `src/components/StatsScreen.tsx`
- Test: `src/lib/dates.test.ts`, `src/lib/stats.test.ts`, `src/components/StatsScreen.test.tsx`

**Interfaces:**
- Consumes: `weekdayIndex` (0 = Sunday), `completionRate`, `buildDayStats`, the year-independent `allEntries` query in StatsScreen (flagged decision 5).
- Produces: `mondayOf(key)` → Monday of `key`'s week. `weekWindows(today)` → `{ thisFrom, thisTo, lastFrom, lastTo }` = Mon→today vs Mon→same weekday (equal elapsed days). `trendCopy(rateThis, slotsThis, rateLast, slotsLast)` → one of the six spec §8 strings (rule order: quiet → first week → just started → ±4.00pp tolerance on the 2-decimal-rounded Δ). `weekTrend(habits, entries, today)` → `{ completed, slots, copy }` for this window. `StatTile` gains `sub?: string` rendered as a small line beneath the caption. Current-year tile: `TrendingUp` / `{completed} of {slots}` / `This week` / sub `{copy} · All year: {rate}%`. Past-year tile: `Zap` / `{rate.completed} of {rate.scheduled}` / `Completed in {year}` / no sub.

- [ ] **Step 1: Write the failing tests**

`src/lib/dates.test.ts` — add `mondayOf` to the existing `./dates` import and append:

```ts
describe('mondayOf', () => {
  it('returns the Monday of the key’s week (Mon→itself, mid-week→back, Sun→back 6)', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(mondayOf('2026-09-30')).toBe('2026-09-28'); // Wednesday
    expect(mondayOf('2026-10-04')).toBe('2026-09-28'); // Sunday
  });
});
```

`src/lib/stats.test.ts` — import updates first: add `trendCopy` and `weekWindows` to the existing `./stats` import (lines 3–6); add `vi` (and `beforeEach`, `afterEach`) to the `vitest` import (line 1) for the fake-timer block; add `import { addDays, todayKey } from './dates';` for the timezone cross-check. Then append:

```ts
describe('weekWindows (spec §8: equal elapsed windows, Monday start)', () => {
  it('spans Mon→today against Mon→the same weekday', () => {
    expect(weekWindows('2026-09-30')).toEqual({          // a Wednesday
      thisFrom: '2026-09-28', thisTo: '2026-09-30',      // 3 days
      lastFrom: '2026-09-21', lastTo: '2026-09-23',      // 3 days
    });
  });
});

describe('trendCopy (spec §8 decision rule)', () => {
  it('renders all six copy variants exactly', () => {
    expect(trendCopy(0, 0, 0, 0)).toBe('A quiet week');
    expect(trendCopy(0.5, 12, 0, 0)).toBe('First week');
    expect(trendCopy(0.5, 9, 0.5, 9)).toBe('Just getting started');
    expect(trendCopy(0.83, 56, 0.82, 56)).toBe('≈ Same as last week');
    expect(trendCopy(1, 12, 0.5, 12)).toBe('↑ Stronger than last week');
    expect(trendCopy(0.5, 12, 1, 12)).toBe('↓ Quieter than last week, that’s okay');
  });

  it('pins the 4pp tolerance boundary', () => {
    expect(trendCopy(0.8399, 100, 0.8, 100)).toBe('≈ Same as last week');     // 3.99pp
    expect(trendCopy(0.84, 100, 0.8, 100)).toBe('↑ Stronger than last week'); // exactly 4.00pp
    expect(trendCopy(0.8, 100, 0.84, 100)).toBe('↓ Quieter than last week, that’s okay');
    expect(trendCopy(0.87, 100, 0.83, 100)).toBe('↑ Stronger than last week'); // 0.87−0.83 is 3.9999… in floats → rounds to 4.00
  });

  it('pins precedence: quiet → first week → just getting started → tolerance', () => {
    expect(trendCopy(1, 0, 1, 10)).toBe('A quiet week');            // no slots this week wins
    expect(trendCopy(1, 5, 0, 0)).toBe('First week');               // no baseline beats N
    expect(trendCopy(1, 9, 1, 56)).toBe('Just getting started');    // baseline exists, too little data
    expect(trendCopy(1, 10, 0.5, 56)).toBe('↑ Stronger than last week'); // N = 10 proceeds
  });
});
```

`src/components/StatsScreen.test.tsx`:

1. Update imports: add `fireEffect`… precisely: add `fireEvent` to the `@testing-library/react` import and `afterEach` to the `vitest` import.
2. In the existing `shows the four year tiles…` test, replace `'Completion Rate'` with `'This week'` in the caption list (spec §8 test 7 — the old assertion dies with the old tile).
3. Append this describe (fixtures use the file's existing `habit()`, `putHabit`, `putEntry` helpers; `Date` pinned to a Wednesday — flagged decision 8):

```tsx
// Spec §8 (R6): the fourth year tile. Only Date is faked (toFake: ['Date']),
// so liveQuery/findBy keep real timers; the pinned Wednesday makes every
// Monday-start window fixture weekday-independent.
describe('weekly trend tile (R6)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('compares identical elapsed windows, not whole weeks (R6.1)', async () => {
    // 4 daily habits → 12 slots per window (≥ N = 10, so rule 3 doesn't fire).
    const habits = [habit({ name: 'A' }), habit({ name: 'B' }), habit({ name: 'C' }), habit({ name: 'D' })];
    for (const h of habits) await putHabit(h);
    // Last week: all 12 elapsed slots done (100%); Thu–Sun deliberately untouched.
    for (const d of ['2026-09-21', '2026-09-22', '2026-09-23'])
      for (const h of habits) await putEntry(h.id, d, 1);
    // This week: Mon+Tue done, Wed missed → 8/12 = 67%. A whole-week reading
    // would score last week 12/28 = 43% and claim "Stronger"; elapsed says ↓.
    for (const d of ['2026-09-28', '2026-09-29'])
      for (const h of habits) await putEntry(h.id, d, 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('8 of 12')).toBeInTheDocument();
    expect(await screen.findByText(/↓ Quieter than last week, that’s okay/)).toBeInTheDocument();
  });

  it('compares rates, not counts, when a habit starts mid-week (R6.2)', async () => {
    const habits = [habit({ name: 'A' }), habit({ name: 'B' }), habit({ name: 'C' }), habit({ name: 'D' })];
    for (const h of habits) await putHabit(h);
    // A fifth habit joins on Monday: this window gains slots (+3), last one doesn't.
    const fresh = await putHabit(habit({ name: 'Start small', createdAt: Date.parse('2026-09-28T00:00:00') }));
    for (const d of ['2026-09-21', '2026-09-22', '2026-09-23'])
      for (const h of habits) await putEntry(h.id, d, 1);   // last: 12/12 = 100%, counts 12
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30'])
      for (const h of habits) await putEntry(h.id, d, 1);
    await putEntry(fresh.id, '2026-09-28', 1);              // this: 13/15 = 87% — counts rose 12→13, rate fell
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('13 of 15')).toBeInTheDocument();  // denominators differ (12 vs 15)
    expect(await screen.findByText(/↓ Quieter than last week/)).toBeInTheDocument();
  });

  it('renders "A quiet week" when nothing is scheduled this window (R6.3)', async () => {
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('0 of 0')).toBeInTheDocument();
    expect(await screen.findByText('A quiet week · All year: 0%')).toBeInTheDocument(); // sub format pinned
  });

  it('renders "First week" without a baseline (R6.3)', async () => {
    const fresh = await putHabit(habit({ createdAt: Date.parse('2026-09-28T09:00:00') })); // Monday of this week
    await putEntry(fresh.id, '2026-09-29', 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText(/First week · All year/)).toBeInTheDocument();
  });

  it('renders "Just getting started" below ten slots (R6.3/§8 rule 3)', async () => {
    const daily = habit({});
    await putHabit(daily);
    await putEntry(daily.id, '2026-09-30', 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('1 of 3')).toBeInTheDocument(); // Mon+Tue+Wed, one done
    expect(await screen.findByText(/Just getting started · All year/)).toBeInTheDocument();
  });

  it('renders "≈ Same as last week" when both windows are untouched and ≥ 10 slots (R6.3)', async () => {
    for (const name of ['A', 'B', 'C', 'D']) await putHabit(habit({ name })); // 4 daily habits → 12 slots
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('0 of 12')).toBeInTheDocument();
    expect(await screen.findByText(/≈ Same as last week · All year/)).toBeInTheDocument();
  });

  it('renders "↑ Stronger than last week" when the rate jumps (R6.3/§8 rule 5)', async () => {
    const habits = [habit({ name: 'A' }), habit({ name: 'B' }), habit({ name: 'C' }), habit({ name: 'D' })];
    for (const h of habits) await putHabit(h);
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30'])
      for (const h of habits) await putEntry(h.id, d, 1); // this: 12/12; last: 0/12 → ↑
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('12 of 12')).toBeInTheDocument();
    expect(await screen.findByText(/↑ Stronger than last week · All year/)).toBeInTheDocument();
  });

  it('keeps days after today out of the windows (R6.6)', async () => {
    const daily = habit({});
    await putHabit(daily);
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
      await putEntry(daily.id, d, 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('3 of 3')).toBeInTheDocument(); // Mon–Wed only
    expect(screen.queryByText('5 of 5')).not.toBeInTheDocument();
  });

  it('shows a past year as counts with no All year and no comparison (R6.4)', async () => {
    const old = await putHabit(habit({
      frequency: [1],                                            // Mondays only
      createdAt: Date.parse('2025-12-01T09:00:00'),              // Dec 1 2025 is a Monday
    }));
    await putEntry(old.id, '2025-12-01', 1);
    await putEntry(old.id, '2025-12-08', 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Previous year' }));
    expect(await screen.findByText('Completed in 2025')).toBeInTheDocument();
    expect(screen.getByText('2 of 5')).toBeInTheDocument();       // Dec 1, 8, 15, 22, 29 — two done
    expect(screen.queryByText('All year')).not.toBeInTheDocument();
    expect(screen.queryByText(/Stronger|Quieter|Same as last|First week|Just getting|quiet week/i))
      .not.toBeInTheDocument();
  });

  it('rises in the tiles but not in the weekly slots or All year (R6.5 + R4 tiles)', async () => {
    const mwf = habit({ frequency: [1, 3], createdAt: Date.parse('2026-09-21T00:00:00') }); // Mon + Wed only
    await putHabit(mwf);
    await putEntry(mwf.id, '2026-09-28', 1);  // Mon — scheduled
    await putEntry(mwf.id, '2026-09-29', 1);  // Tue — OFF schedule (bonus)
    await putEntry(mwf.id, '2026-09-30', 1);  // Wed — scheduled
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('2 of 2')).toBeInTheDocument();          // weekly tile: slots only
    const activeDays = (await screen.findByText('Active Days')).closest('div')!;
    expect(within(activeDays).getByText('3')).toBeInTheDocument();          // Mon + Tue-bonus + Wed
    const completions = (await screen.findByText('Completions')).closest('div')!;
    expect(within(completions).getByText('3')).toBeInTheDocument();         // all three logged
    // Rate family: Mon+Wed since createdAt = 4 slots, 2 done → 50%. A leaked
    // bonus would read 75%, so this pins the exclusion (spec §6).
    expect(await screen.findByText(/All year: 50%/)).toBeInTheDocument();
  });
});
```

Note: `putHabit` returns the stored habit (`repo.ts:18`), so tests hold the id directly — no extra repo imports needed.

Second-timezone cross-check (reviewer addition) — append as a **top-level** `describe` in `src/lib/stats.test.ts` (outside the R6 describe, so no fake-timer `beforeEach` leaks in):

```ts
describe('timezone independence (Asia/Manila, second-tz pin)', () => {
  const withTZ = <T>(tz: string, fn: () => T): T => {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try { return fn(); } finally { process.env.TZ = prev; }
  };

  it('keeps a streak fixture on the same calendar days', () => {
    withTZ('Asia/Manila', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-09-28T03:00:00Z')); // Mon 11:00 Manila / Sun 20:00 LA
        // Guard: prove the override is live — under the LA pin this instant is Sep 27.
        expect(new Date('2026-09-28T03:00:00Z').getDate()).toBe(28);
        const today = todayKey();
        expect(today).toBe('2026-09-28');
        const stats = buildDayStats(
          [habit()],
          [entry('h1', today, 1), entry('h1', addDays(today, -1), 1), entry('h1', addDays(today, -2), 1)],
          { from: addDays(today, -6), to: today },
        );
        expect(currentStreak(stats, today)).toBe(3);
      } finally { vi.useRealTimers(); }
    });
  });

  it('opens the Monday week window on the same dates', () => {
    withTZ('Asia/Manila', () => {
      expect(weekWindows('2026-09-30')).toEqual({          // Wednesday
        thisFrom: '2026-09-28', thisTo: '2026-09-30',
        lastFrom: '2026-09-21', lastTo: '2026-09-23',
      });
      expect(weekWindows('2026-09-27')).toEqual({          // Sunday closes its own week
        thisFrom: '2026-09-21', thisTo: '2026-09-27',
        lastFrom: '2026-09-14', lastTo: '2026-09-20',
      });
    });
  });
});
```

Mechanism: a runtime `process.env.TZ` change does alter Date's local calendar inside vitest workers (verified by probe run on this machine, 2026-09-28); `withTZ` restores the `America/Los_Angeles` pin in `finally`, so no other test sees Manila. The guard assertion fails loudly if a future runtime stops honoring mid-process TZ changes instead of silently testing nothing. The streak-tz case pins behavior that already exists (it passes as soon as `stats.test` compiles); the weekWindows-tz case goes red with the rest of Task 6's imports.

- [ ] **Step 2: Run the tests — confirm red**

```
npm test -- src/lib/dates.test.ts src/lib/stats.test.ts src/components/StatsScreen.test.tsx
```

`mondayOf`/`weekWindows`/`trendCopy` don't exist (import red); all trend-tile renders fail (the tile still shows `Completion Rate` / percent); the caption-swap edit makes the old tile test red too — all correct reds.

- [ ] **Step 3: Implement — `src/lib/dates.ts`**

Append:

```ts
/** Monday of the week containing `key` (weeks start Monday — spec §8/R6). */
export function mondayOf(key: string): string {
  return addDays(key, -((weekdayIndex(key) + 6) % 7)); // Sun → -6, Mon → 0
}
```

- [ ] **Step 4: Implement — `src/lib/stats.ts`**

1. Add `mondayOf` to the `./dates` import.
2. Append:

```ts
export interface WeekWindows {
  thisFrom: string; thisTo: string; lastFrom: string; lastTo: string;
}

/**
 * Identical-length windows (spec §8/R6): this week Monday → today, against
 * last week Monday → the same weekday. Rates, not counts, are then compared,
 * so a mid-week habit creation cannot show a lying arrow.
 */
export function weekWindows(today: string): WeekWindows {
  const thisFrom = mondayOf(today);
  return { thisFrom, thisTo: today, lastFrom: addDays(thisFrom, -7), lastTo: addDays(today, -7) };
}

/**
 * The §8 copy rule. Rates are fractions; slots are scheduled-slot counts.
 * Order: quiet → first week → just getting started → ±4.00pp tolerance.
 */
export function trendCopy(rateThis: number, slotsThis: number, rateLast: number, slotsLast: number): string {
  if (slotsThis === 0) return 'A quiet week';
  if (slotsLast === 0) return 'First week';
  if (slotsThis < 10) return 'Just getting started';           // N = 10 (§8 rule 3)
  // Round to whole hundredths of a percentage point first: binary floats make
  // 0.87 − 0.83 = 3.9999…, but in decimal it is exactly 4.00 (§8 rule 4–6).
  const delta = Math.round((rateThis - rateLast) * 10_000) / 100;
  if (Math.abs(delta) < 4) return '≈ Same as last week';
  return delta > 0 ? '↑ Stronger than last week' : '↓ Quieter than last week, that’s okay';
}

export interface WeekTrend { completed: number; slots: number; copy: string; }

export function weekTrend(habits: Habit[], entries: Entry[], today: string): WeekTrend {
  const { thisFrom, thisTo, lastFrom, lastTo } = weekWindows(today);
  const now = completionRate(buildDayStats(habits, entries, { from: thisFrom, to: thisTo }));
  const prev = completionRate(buildDayStats(habits, entries, { from: lastFrom, to: lastTo }));
  return {
    completed: now.completed,
    slots: now.scheduled,
    copy: trendCopy(now.rate, now.scheduled, prev.rate, prev.scheduled),
  };
}
```

- [ ] **Step 5: Implement — `StatTile` + `StatsScreen`**

`src/components/StatTile.tsx` (whole file):

```tsx
import type { LucideIcon } from 'lucide-react';

export function StatTile({ icon: Icon, value, caption, sub }: {
  icon: LucideIcon; value: string | number; caption: string; sub?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-[var(--color-panel)] px-4 py-4 text-center">
      <span className="flex items-center gap-1.5 text-2xl font-extrabold tabular-nums">
        <Icon size={18} className="text-[var(--color-accent)]" /> {value}
      </span>
      <span className="text-[11px] text-[var(--color-subtle)]">{caption}</span>
      {sub && <span className="text-[11px] text-[var(--color-subtle)]">{sub}</span>}
    </div>
  );
}
```

`src/components/StatsScreen.tsx`:

1. Icon import gains `TrendingUp` (`Zap` stays — the Completions tile still uses it).
2. `@/lib/stats` import gains `weekTrend`.
3. After the `rate` memo, add:

```tsx
  // Spec §8/R6: current-year comparison lives in the tile; past years only
  // aggregate. allEntries is year-independent, so January-crossing windows
  // always have data (flagged decision 5).
  const trend = useMemo(
    () => (year === maxYear ? weekTrend(habits ?? [], allEntries ?? [], today) : null),
    [habits, allEntries, year, maxYear, today],
  );
```

4. Replace the third year tile (line 78):

```tsx
        {trend ? (
          <StatTile icon={TrendingUp} value={`${trend.completed} of ${trend.slots}`} caption="This week"
                    sub={`${trend.copy} · All year: ${Math.round(rate.rate * 100)}%`} />
        ) : (
          <StatTile icon={Zap} value={`${rate.completed} of ${rate.scheduled}`} caption={`Completed in ${year}`} />
        )}
```

- [ ] **Step 6: Run the tests — confirm green**

```
npm test -- src/lib/dates.test.ts src/lib/stats.test.ts src/components/StatsScreen.test.tsx
```

- [ ] **Step 7: Gates + commit**

```
npm test
npm run typecheck
npm run lint
npm run build
git add src/lib/dates.ts src/lib/dates.test.ts src/lib/stats.ts src/lib/stats.test.ts src/components/StatTile.tsx src/components/StatsScreen.tsx src/components/StatsScreen.test.tsx
git commit -m "feat(stats): weekly trend tile replaces Completion Rate (R6)"
```

Watch-outs: the tile-grid tests (`grid.children` length 4 × 2 grids) must stay green — `StatTile` root count is unchanged; the past-year `Zap` duplicates the Completions icon, which the spec mandates (§8).

---

## Final verification (spec §11)

- [ ] **All four gates green, in order, on the final tree:** `npm test` (206 pre-existing + all new, zero skips) → `npm run typecheck` → `npm run lint` → `npm run build`.
- [ ] **Six fix commits exist**, each touching only its task's files; `git status` clean except untracked `.opencode/` + `opencode.json` (never staged).
- [ ] **Manual spot-check on `npm run start`** (check port 3000 first — `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue` — background shells die on restart; restart with `npm run start` if dead):
  - Today header streak **equals** the Stats `Current Streak` tile on the same data.
  - `Meditate` at 15/15 shows the **check** in the ring; DevTools accessibility tree ends the name with `, completed`.
  - `/stats` heatmap opens **scrolled to the current week**; a past year opens at January; a cell still deep-links to its note view on second click.
  - Trend tile shows `This week` with its comparison line; copy matches §8 (glyph + text).
  - Intention chips appear in **both** forms (Today `+` and Settings); placeholder `Type your own…` visible; selected chip carries `✓` + `aria-pressed`.
- [ ] `git push origin main`.
- [ ] **Vercel picked up the push:** the production deployment for `main` reports Success and her URL serves the new build. Production URL: **https://habibit-five.vercel.app/today** (repo `satosssss/habibit`, production branch `main`). Her data is tied to the site's origin, so this one stable production URL is the only URL she ever uses — never a preview URL, and no domain change later without an export/import step. Check via the Vercel dashboard, `gh api repos/{owner}/{repo}/deployments`, or a direct fetch of the URL.
- [ ] **GitHub default branch is `main`** (switched during pre-execution setup; re-confirm it still points at `main` and Vercel's production branch setting still matches).
