# Calendar markers & Insights trends — design spec

**Date:** 2026-10-05
**Status:** Design approved in chat (three sections, all "looks right"); this written spec is the gate before planning.
**Scope:** Marker states on the Calendar page (completed / missed / streak break) and three dynamic trend charts on the Insights page (streak growth, consistency trends, behavioral patterns), in the house clean-minimal style, updating live from user logs.

**Precedents:** `2026-10-04-adaptive-coach-design.md` (Approach A structure, section component conventions), `2026-10-03-slice-e-ia-pages-templates-design.md` §7 R5 (calendar dot semantics — **amended by this spec**), `2026-09-30-slice-d-glassmorphism-design.md` (visual constraints), `Heatmap.tsx` (legend / chart-cell precedent).

---

## 1. Decisions (chat-approved)

| # | Question | Decision |
|---|----------|----------|
| Q1 | What counts as a **missed day**? | Past day with ≥1 scheduled habit and zero completions. Today and future are never missed (today = grace: pending, never failure). |
| Q2 | What is a **streak break**? | The aggregate all-habits active-day streak — the same run logic as the All-time `currentStreak` tile. One marker per cell; in a run of consecutive misses only the first day is marked as the break. |
| Q3 | What does the **behavioral patterns** chart show? | Weekday completion rates (Mon–Sun) **and** time-of-day distribution (24 hour buckets from `Entry.timestamp`). (Original question was interrupted; this recommendation was carried into design §2 and approved there.) |
| Q4 | Architecture | **Approach A** — shared pure derivation layer (`src/lib/trends.ts`) + two small chart primitives + one section component. `streakSeries` is the single source of truth shared by calendar markers and the growth chart. |
| Q5 | Chart interactions | **No hover tooltips in v1** — annotations and per-datum accessible text carry the numbers (Heatmap's tooltip pattern can come later). |

---

## 2. R1 — Calendar marker states

Evaluated per grid cell, **in this order** (first match wins):

| # | Condition | Marker | Meaning |
|---|-----------|--------|---------|
| 1 | `kind === 'future'` or no stat | none | neutral (unchanged) |
| 2 | `stat.perfect` | **filled dot** | all due habits done (unchanged) |
| 3 | `stat.active` | **hollow ring** | some due done, or a bonus completion on a free day (unchanged) |
| 4 | `kind === 'past'` && `stat.scheduled > 0` && series `broke !== null` | **break ×** (new) | this missed day ended a run of ≥1 |
| 5 | `kind === 'past'` && `stat.scheduled > 0` | **missed dash** (new) | ≥1 due, nothing done, run already 0 (or never started) |
| 6 | otherwise (today pending, nothing scheduled) | none | unchanged |

Rules:
- **R1.1** `perfect ⇒ active`, so rule 2 precedes 3; missed/break require `!active`, so they only fall out of rule 3's path.
- **R1.2** A break *is* the more specific missed state — rule 4 replaces rule 5's dash on that cell (one marker per cell).
- **R1.3** Consecutive misses: only the first carries `broke` (the run is 0 afterwards) → rule 5. This falls out of the series math; no special casing.
- **R1.4** Today (`kind === 'today'`) never reaches rules 4–5: pending today shows no missed/break marker, preserving "never implies failure for today or future".
- **R1.5** Shape-first encoding (R5's "shape + text, never color alone"). **No new color tokens.**

**Marker markup** (cell is `h-11 w-11` ≥44px, unchanged; every marker `aria-hidden` + `data-dot={state}` for tests):

| State | Markup |
|-------|--------|
| `filled` | `<span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />` (unchanged) |
| `hollow` | `<span className="h-1.5 w-1.5 rounded-full border border-[var(--color-subtle)]" />` (unchanged) |
| `missed` | `<span className="h-[3px] w-2 rounded-full bg-[var(--color-subtle)]" />` (new — a dash, distinct silhouette) |
| `break` | lucide `<X size={10} strokeWidth={3} className="text-[var(--color-accent-ink)]" />` (new — distinct shape **and** hue; `lucide-react` is already a dependency) |

## 3. R2 — Aria-labels & legend

**Labels** (`labelDate` prefix unchanged, e.g. `October 3`):

| Case | Label |
|------|-------|
| future | `{date}: upcoming` (unchanged) |
| break | `{date}: streak of {broke} ended` (new — `{broke}` = run length ≥1 from the series) |
| missed | `{date}: 0 of {scheduled} done — missed` (new; `completed` is always 0 by rule) |
| scheduled, otherwise (incl. today pending) | `{date}: {completed} of {scheduled} done, {pct}%` (unchanged) |
| else | `{date}: nothing scheduled` (unchanged) |

**Legend** — new row directly under the grid, rendered only when `mounted && stats`; mirrors the Heatmap legend (`data-testid="hm-legend"`): `data-testid="cal-legend"`, `mt-3 flex flex-wrap items-center justify-end gap-3 text-[10px] text-[var(--color-subtle)]`. Four items, in order, each = marker shape (exact cell markup, `aria-hidden`) + visible text: **Perfect · Partial · Missed · Streak break**.

## 4. R3 — Streak context (data widening)

Break detection needs the run *entering* the month, so the calendar's window widens to the shared all-time window (exact precedent: Insights' `allEntries`):

- **R4.1** `entriesFrom = habits && habits.length > 0 ? allTimeStart(habits) : monthStart`.
- **R4.2** Entries query becomes `useLiveQuery(() => loadRange(entriesFrom, monthEnd), [entriesFrom, monthEnd])` (was `[monthStart, monthEnd]`).
- **R4.3** Stats memo becomes `buildDayStats(habits, entries, { from: entriesFrom, to: monthEnd })`.
- **R4.4** `seriesMap = new Map(streakSeries(stats, today).map(p => [p.date, p]))` — O(1) per-cell lookup of `broke`.
- **R4.5** `allTimeStart` starts at Jan 1 of the earliest habit's creation year; `isScheduled` refuses days before a habit's creation, so the run entering that window is provably 0 — no context is lost.

---

## 5. R5 — Insights charts

**Placement:** a new `Trends` section inserted **between `<CoachSection/>` (InsightsScreen line 111) and the By-intention grid (line 115)**. Section h2 uses the existing micro-header class: `mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]`. Layout: `grid grid-cols-1 gap-6 md:grid-cols-2` — Streak growth | Consistency side by side at md+, the patterns card spans `md:col-span-2` with its two groups stacked on mobile / side by side (`md:flex-row`) at md+. Cards: `glass-card p-4`, title `h3 text-sm font-bold`.

All three charts are **year-scoped via YearNav** (past years render their full arc; the current year stops at today), driven by the existing `allEntries` (minYear → today, year-independent).

### 5.1 Streak growth (card: "Streak growth")
- Points: the year slice of `streakSeries(stats, today).streak` (series runs from `allTimeStart`, so a run entering Jan 1 renders at full value on Jan 1).
- Rendered by `TrendChart`; breaks read as the line dropping to 0 (no per-break dots — the calendar shows those; scope line Q5).
- Annotation: `Longest this year: {max}` (max over the slice).
- Empty (no active day in the year): card shows `No streaks in {year}.` instead of the chart.

### 5.2 Consistency (card: "Consistency")
- Points: `weeklyRates(stats, year).rate` — one per Monday-anchored week, `null` = gap.
- `TrendChart` with `max = 1` and y-ticks `100% / 50% / 0%`.
- Annotation: `Average: {Math.round(overall * 100)}%` where `overall = Σcompleted / Σscheduled` across the year's weeks — slot-weighted, identical math to the existing "All year" tile.
- **A zero-slot week is a gap (`null`), never a fake 0%**; a 0% week (slots existed, none done) renders at the baseline.
- Empty (Σscheduled = 0): card shows `Nothing scheduled in {year}.`.

### 5.3 When you show up (card: behavioral patterns)
Two groups inside one card, each with a small visible label (`text-xs font-semibold text-[var(--color-subtle)]`: "By weekday" / "By hour of day") and its own fallback line:

- **Weekday** — `PatternBars` over `weekdayRates(stats, year)` (Monday-first), `max = 1`. Visible labels: `M T W T F S S`. Per-bar accessible text: `Monday: 84% (21 of 25)` or `Monday: nothing scheduled`. Fallback: `Nothing scheduled in {year}.`.
- **Hour of day** — `PatternBars` over `hourHistogram(habits, entries, year)`, `max = max(1, counts)`. Visible tick labels at 0/6/12/18 only (`12a 6a 12p 6p`); per-bar accessible text `8 am: 14 completions`. Fallback: `No completions in {year}.`.

### 5.4 Section-level empty state
`habits.length === 0` → h2 + one `glass-card` containing `No habits yet.` (mirrors By-intention, InsightsScreen line 120). No charts rendered.

### 5.5 Live updates (no new plumbing)
Insights' existing `useLiveQuery` fetches (`habits` / `entries` / `allEntries`) refetch on every write; `TrendsSection`'s memos recompute — the same mechanism coach and heatmap already rely on. Calendar markers recompute the same way through R4's queries. One integration test proves a chart number changes after `putEntry`.

---

## 6. R6 — Data layer (`src/lib/trends.ts`, new, pure, no I/O)

Imports: `DayStat`, `buildDayStats`, `isCompleted`, `allTimeStart` from `@/lib/stats`; `mondayIndex` (see 6.0), `mondayOf` from `@/lib/dates`; `Habit`, `Entry` from `@/lib/types`.

### 6.0 `mondayIndex` export
`src/lib/dates.ts` line 75: promote the existing private `mondayIndex(key)` (Monday = 0 … Sunday = 6) to an export. `weekdayIndex` stays Sunday-based (`Habit.frequency` convention); display order is always Monday-first (month grid, heatmap).

### 6.1 `streakSeries(stats, today): Array<{ date: string; streak: number; broke: number | null }>`

Forward walk over `stats` in ascending date order, **stopping at `today`**:

```
run = 0
for each day with day.date <= today:
  if day.active:                          run += 1;            push {date, streak: run,   broke: null}
  else if day.scheduled === 0:                                 push {date, streak: run,   broke: null}   // neither counts nor breaks
  else if day.date === today:                                  push {date, streak: run,   broke: null}   // today never breaks (grace)
  else: /* past, scheduled > 0, not active — closes the run */
                                       push {date, streak: 0, broke: run > 0 ? run : null}; run = 0
```

- Semantics mirror `currentStreak` (stats.ts 131–142) exactly, forward — active counts, unscheduled days skip, today's incompleteness never breaks, a past due day ends the run.
- **Invariant (test-pinned):** when `stats` contains `today`, `series.at(-1).streak === currentStreak(stats, today)`.
- `broke` is `≥ 1` by construction (null when the run was already 0) → R1.3 falls out.

### 6.2 `weeklyRates(stats, year): Array<{ weekStart: string; completed: number; scheduled: number; rate: number | null }>`
- Bucket in-year stats days (`year-01-01 … year-12-31`) by `mondayOf(date)`; enumerate weeks `mondayOf(Jan 1) … mondayOf(Dec 31)`, step 7.
- `rate = scheduled > 0 ? completed / scheduled : null` — `null` renders as a gap (Q5/§5.2).
- Edge buckets (year starts mid-week) count in-year days only — honest partial weeks, same slot math as `completionRate` (stats.ts 116).

### 6.3 `weekdayRates(stats, year): Array<{ weekday: number; completed: number; scheduled: number; rate: number | null }>`
- Seven entries, `weekday` Monday = 0 … Sunday = 6 via `mondayIndex`; in-year days only; `rate = scheduled > 0 ? completed / scheduled : null`. Slots family — same math as the tiles.

### 6.4 `hourHistogram(habits, entries, year): number[]` (length 24)
- For entries with `e.date` in the selected year: `habit = byId.get(e.habitId)`; skip unless `isCompleted(habit, e.value)` — **the same completion test the coach peak-hour fix uses** (partial/untouched rows are never completions).
- Count `new Date(e.timestamp).getHours()`. Off-schedule (bonus) completions **are** counted — this is the all-completions family (heatmap floor precedent); `timestamp` is the write time (types.ts line 27).

### 6.5 Component contracts

```tsx
// TrendChart — minimal SVG line (used by §5.1 + §5.2)
type TrendChartProps = {
  points: (number | null)[];  // null = gap
  max: number;                // y-domain top
  ariaLabel: string;          // svg role="img" summary
  yTicks?: string[];          // HTML labels, top → bottom (e.g. ['100%','50%','0%'])
  testId: string;
};
```
- `viewBox="0 0 100 H"` + `preserveAspectRatio="none"` + `w-full h-24`; polyline uses `vector-effect="non-scaling-stroke"`, `stroke-width: 1.5`, `stroke: var(--color-accent)`.
- Contiguous non-null runs → one `<polyline>` each; a lone non-null point → a 3px circle (a bare polyline point renders nothing).
- Baseline rule in `var(--color-line)`; **no text inside the SVG** (labels/annotations are HTML siblings so non-uniform scaling can't distort them).
- `0` is a real value (baseline); only `null` is a gap.

```tsx
// PatternBars — div bars (used by §5.3 weekday + hour)
type BarDatum = { label: string; value: number | null; aria: string };  // label '' = no visible tick
type PatternBarsProps = { data: BarDatum[]; max: number; ariaLabel: string; testId: string };
```
- `<ul aria-label={ariaLabel}>` of `<li>`: visible bar (aria-hidden, height `value === null ? 0 : value/max * 100%` of an `h-20` track, `bg-[var(--color-accent)]`, rounded top) + visible short label + **visually-hidden full per-bar text** (`{aria}`) so screen readers announce each datum.

### 6.6 `TrendsSection` data flow

```tsx
<TrendsSection habits={habits} entries={allEntries} year={year} today={today} />
```
1. `chartEnd = min(`${year}-12-31`, today)` (lexicographic min).
2. `stats = buildDayStats(habits, entries, { from: habits.length ? allTimeStart(habits) : chartEnd, to: chartEnd })` — full history so the streak enters Jan 1 correctly; degenerate one-day range when there are no habits (avoids a 26-year empty walk against `EARLIEST_KEY`).
3. `series = streakSeries(stats, today)` filtered to `date >= `${year}-01-01``; `weeks / weekdays / hours` derive from the same `stats` + `entries`.
4. All memos keyed on `[habits, entries, year, today]`.

---

## 7. R7 — Testing & gates

**New files:** `src/lib/trends.test.ts`, `src/components/TrendChart.test.tsx`, `src/components/PatternBars.test.tsx`, `src/components/TrendsSection.test.tsx` (52 → 56 test files; suite 529 → ≈580+, exact counts pinned by the plan).

- **trends.test.ts:** streak growth (run increments), first-miss break records run length, consecutive miss → only first has `broke`, unscheduled gap preserves the run, today-grace (pending today never breaks; active today counts), **run entering a window from the previous month/year** (the calendar boundary case), **invariant `series.at(-1).streak === currentStreak`**, output stops at today; weeklyRates (Monday buckets, mid-week year edges, zero-slot → `null`, current partial week); weekdayRates (Mon-first order, slots family, unscheduled → `null`); hourHistogram (`isCompleted` filter excludes 0-value/partial rows, timestamp-hour bucketing, year window, bonus counted).
- **TrendChart.test:** segment splitting at nulls, lone-point circle, `max` scaling, zero-vs-null, aria label, yTicks.
- **PatternBars.test:** bar heights, `value: null` → 0, visible ticks vs `''`, sr-only per-bar text, region aria-label.
- **TrendsSection.test:** `Trends` heading + three card titles, `No habits yet.`, per-card and per-group fallbacks, both annotations, series→aria integration.
- **InsightsScreen.test (existing):** wiring — section sits between Coach and By intention; **dynamic test**: `putEntry` → a chart number/annotation changes (mirror the existing tile-dynamic test convention).
- **CalendarScreen.test (existing — one deliberate re-anchor):** the R5 pin "past due-but-untouched → no indicator" becomes missed-dash + `0 of N done — missed`; everything else (perfect/partial/future/unscheduled labels, Monday-first, month switching, frequency-aware labels) must pass **unchanged**. New pins: break × + `streak of {n} ended`, first-miss-only, today never missed, legend `cal-legend` (4 items), `data-dot` states, **widened range** (streak entering the month from before it → break renders).
- **dates.test (existing):** direct `mondayIndex` coverage (Mon = 0, Sun = 6).
- **Browser V-run (last):** seeded markers incl. a constructed break (toggle logs until a run ends), all three charts, YearNav to a past year, light/dark screenshots, 360px iframe no overflow, console 0 errors, aria spot-checks, reset → `No habits yet.` (export first, reset last, re-import).
- **Gates per commit:** `npm test` → `npm run typecheck` → `npm run lint` (baseline **exactly 3 warnings**: TimerModal.tsx + 2× stats.test.ts) → `npm run build`.

**Execution shape:** ≈8 TDD tasks (streakSeries → calendar markers → chart derivations → TrendChart → PatternBars → TrendsSection → Insights wiring → docs + browser verification), matching the coach phase's granularity.

---

## 8. R8 — Constraints & out of scope

- **No new dependencies** (lucide-react, SVG already in-tree); **no DB schema, export, import, or reset changes** — `loadRange` already supports arbitrary windows; local-first/offline preserved.
- **No new color tokens** (`--color-accent`, `--color-accent-ink`, `--color-subtle`, `--color-line` only); no glow/pulse; shape + text never color-alone; AA contrast pins stay green; cells stay ≥44×44.
- **Future and today never imply failure** (slice-E R5 preserved and narrowed: missed/break are past-only).
- **Out of scope v1:** hover tooltips, per-habit chart breakdowns, month-aggregate chips on the calendar, notification surfaces, chart animations.
- **Docs:** slice-E §7 R5 is a dated/historical spec — the delta lives in this document (tests pin the new behavior); execution's docs task adds a section to `2026-09-23-habibit-design.md` + a README bullet.
- Never stage `.opencode/` or `opencode.json`.
