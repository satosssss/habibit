# Habibit — Slice 1a: Bug Fixes (Design Spec)

**Date:** 2026-09-28 · **Status:** Approved 2026-09-28 (incl. §7/§8 amendments) · **Size:** S (one sitting)

Amends the parent spec [`2026-09-23-habibit-design.md`](./2026-09-23-habibit-design.md) at
**§5.4** (habit-row controls), **§7.2** (year-stats tiles), **§7.4** (heatmap cells/tooltip),
**§9** (habit form — intention field gains chips).
Everything else in the parent spec stands.

---

## 1. Context

Slice 1a is the first slice of the follow-up plan agreed in brainstorming:
**1a bug fixes → 1b storage safety → 2 celebrations → 3 onboarding → 4 retention → 5 romantic layer.**
It fixes six reported defects. It adds no features and changes no layout beyond the two
specified controls (habit-row ring center, one Stats tile).

Success = every fix has a failing test first, all gates stay green, and nothing else moves.

## 2. Constraints (carry-over from parent spec §3)

- Next.js (App Router) + Tailwind + Dexie/IndexedDB. **No new dependencies. No network calls. No analytics.**
- TDD: failing test → implementation → pass → commit per fix. Gate order: tests → typecheck → lint → build.
- SSR clock discipline: clock-derived DOM renders post-mount (existing mounted-gate pattern).
- Accessibility: tap targets at least as large as today; glyph + text, never color alone; `prefers-reduced-motion` respected.
- Tone: warm, never shaming. Copy strings in §4 and §8 are normative.
- Do not stage `.opencode/` or `opencode.json`.

---

## 3. R1 — One shared streak

**Problem.** The Today header shows `min(allTimeStreak, 41)`. `TodayScreen` builds day-stats over
`addDays(date, -40)` (40 days + today = a hard cap of 41) while Stats builds over all time.
Same function, different data windows. The same window also caps every **per-habit flame badge**
on Today at 41.

**Definition (normative — written once, used by both screens):**

> **Overall streak** (Today header flame + Stats "Current Streak") — the number of consecutive
> days, walking back from the reference date, with **at least one logged completion**
> (scheduled or off-schedule; §6). A day with **no completions ends the run only if at least one
> habit was scheduled** that day; days with nothing scheduled and nothing logged are **skipped —
> they neither count nor break**. The reference day (today) **never breaks** the streak while it
> is still in progress: an incomplete today leaves yesterday's run intact; a completed today
> extends it. Days before any habit existed have no completions and nothing scheduled, so they
> are skipped naturally.
>
> **Per-habit flame badge** — the same rules with "that habit" in place of "any": days the habit
> was completed count (even off-schedule), days it was not due and not completed are skipped, a
> due day without completion ends the run, and the reference day never breaks.

This confirms the agreed reading: *(a)* an incomplete today does not break the streak until the
day ends, and *(b)* the streak counts days with at least one completion.

**Change.**

- Today loads entries over the **full history** (window start → viewed date), not 40 days.
  Both screens derive the window from one shared pure helper `allTimeStart(habits)` =
  `${earliest habit createdAt year}-01-01` (Today falls back to a fixed early constant until
  habits have loaded, then refines — liveQuery re-subscribe is safe post-`ensureDb` fix).
- Header flame and per-habit badges both derive from that full range.
- **Equality scope:** with both screens referencing *today*, header and Stats "Current Streak"
  must render the same number for the same data. A past-dated Today view intentionally shows the
  streak *as of that date* — documented behavior, not a defect.

**Tests (failing first):** unbroken 90-day fixture → header reads 90, not 41; per-habit badge
exceeds 41; Today header equals the Stats tile on a shared fixture; existing past-date pins stay
green. Add `data-testid="header-streak"` (test-only, no visual change).

---

## 4. R2 — Completed state for quantity & timer rows

Amends parent §5.4 (only boolean rows currently render a check; `done` for quantity is computed
but never shown, and the timer ring always shows `+`).

**Rule.** When `done` (quantity or timer: `value >= target`):

- quantity ring center: percent (`100`) → **Check icon**
- timer ring center: **Plus → Check icon**

Over-target stays done (water 9/8). Steppers, ring tap behavior (value sheet / timer modal),
row fill, subtext: **unchanged**.

**Accessible names (normative, pinned by tests):**

- quantity ring, done: `Set exact value for Learn Spanish, 45 of 45 minutes, completed`
- timer ring, done: `Open timer for Meditate, 15 of 15 minutes, completed`
- Value phrasing: quantity `{value} of {target} {unit}`; timer `{m} of {m} minutes`.
- Not-done labels unchanged (`Set exact value for …` / `Open timer for …` without the suffix).
- Boolean labels unchanged — `Mark X done` / `Mark X not done` already announce state.

**Tests:** ring renders check at target and percent/plus below target for both types; exact aria
strings for done and not-done; steppers still present while done; existing row tests stay green.

---

## 5. R3 — Heatmap auto-scrolls to the current week

**Rules:**

- Auto-scroll only when viewing the **current year** (`year === Number(today.slice(0, 4))`).
  Past years keep the natural January position — today's week does not exist there.
- On mount (after the clock gate), scroll the horizontal container the minimal amount needed to
  make the column containing `today` fully visible (clamped ≥ 0). Applies again if YearNav
  returns to the current year.
- Motion: `scrollTo({ left, behavior: 'smooth' })`; under `prefers-reduced-motion: reduce` set
  `scrollLeft` directly (instant). Post-mount only — never during SSR.

**Tests:** stub `scrollWidth`/`clientWidth` (jsdom has no layout); current year → `scrollTo`
called with the expected left and `smooth`; reduced-motion → `scrollLeft` set directly and no
`scrollTo`; past year → no scroll; nothing scrolls pre-mount.

---

## 6. R4 — Off-day completions count, never penalize

*Reference day = today. `completed` = completions of scheduled habits; `bonus` = completions of
habits not scheduled that day.*

| Day situation | Overall streak | Habit badge | Active day | Completions tile | Rate / intention bars / weekly tile | Heatmap level |
|---|---|---|---|---|---|---|
| Scheduled, ≥1 completed | counts | counts habits done | yes | counts | numerator & denominator | ratio-graded |
| Scheduled, none done | ends run (never on reference day) | ends that habit's run | no | — | denominator only | 0 |
| Unscheduled, completion logged | counts (extends) | extends if that habit done | yes | counts | **excluded entirely** | ≥ 1 |
| Unscheduled, nothing logged | skipped | skipped | no | — | — | 0 |

**Two number families — intended divergence, documented:**

- **Scheduled-slot family:** weekly trend `X of Y`, heatmap tooltip (`x of y` + `%`), completion
  rate, intention bars — scheduled discipline only.
- **All-completions family:** Completions tile, active days, streaks, heatmap level floor.

The weekly trend tile can therefore legitimately differ from the Completions tile in the same
view (§8). Perfect days are unchanged (scheduled family). Parent **§7.4 amended:** "No scheduled
habits → empty cell" becomes "No scheduled habits **and no completions** → empty cell"; a
bonus-only day renders level **1**, with tooltip `date` + `{n} completed (off schedule)` and no
percent line. Scheduled-day tooltips are unchanged.

**Pins:** a habit created mid-year excludes pre-`createdAt` days from the rate denominator
(expected green — `isScheduled` already checks `createdAt`). A frequency edit is pinned to the
documented behavior in §9.1.

**Tests:** every matrix row; a bonus completion raises the Completions tile and active days but
not the rate (asserted together in one test); a bonus-only heatmap cell renders ≥ 1;
`unscheduled + nothing logged` days still skip the streak.

---

## 7. R5 — Intention chips

**Change** (inside `HabitForm`, so both call sites — Today's `+` and Settings — receive it):

- Chip row beneath the intention field, styled like the existing frequency chips:
  1. **In-use intentions first**, deduped case-insensitively (`trim().lowercase()` key,
     displayed in first-seen casing);
  2. then presets **Health, Calm, Growth, Joy** (skipping any already in-use).
- Free text stays in the existing combobox input — **the input is the custom path**, so there is
  no separate "Custom…" chip (it would only focus the field above it). The intention input gets
  a placeholder that makes this obvious: **`Type your own…`** (added as a prop on the shared
  Combobox; the category input is untouched this slice).
- Chips are buttons with `aria-pressed` when normalized-equal to the draft intention; tapping
  sets the intention to the chip's exact string. Typed custom values save trimmed (unchanged).
- **Selected-chip state is never color-only:** a selected chip additionally renders a leading
  `✓` glyph; the accent fill/border only reinforces it.
- **Color hashing: no change — verified already normalized** (`intentionColor` does
  `trim().toLowerCase()` before hashing, `colors.ts:29`). Pinned with a case-insensitive test.
- Grouping (Stats bars, Today's intention list) stays exact-match until existing data is
  re-tagged by hand later — **no migration in this slice** (owner's decision).

**Tests:** habits with `Study` + `study` → one chip shown as `Study`; presets follow in-use and
are deduped; chip tap sets the value and toggles `aria-pressed`; selected chip renders the `✓`
non-color cue; intention input shows the `Type your own…` placeholder; custom typing unaffected;
`intentionColor('study') === intentionColor('Study')` pinned.

---

## 8. R6 — Weekly trend tile (replaces Completion Rate)

Amends parent **§7.2** — the `Year stats` row's fourth tile.

**Current-year view:**

- **Value:** `12 of 14` — **scheduled habit-slots**: numerator = scheduled slots *completed* in
  the window; denominator = scheduled slots *in the window*. Excludes days after today and days
  before a habit existed. Never includes off-schedule completions (§6).
- **Caption:** `This week`. **Icon:** `TrendingUp`.
- **Comparison line — rate over identical elapsed windows:** this week Monday → today vs last
  week Monday → the same weekday. Rates (not raw counts) are compared **because the denominators
  can differ when a habit is created or deleted mid-week** — counts would then show a lying
  arrow.
- **Decision rule, in order** (first match wins; `Δ` = this week's rate − last week's rate):
  1. this window has **0 scheduled slots** → `A quiet week`
  2. last window has **0 scheduled slots** → `First week`
  3. this window has **fewer than 10 scheduled slots** → `Just getting started`
     (**N = 10** — early Monday with 8 daily habits yields 8 slots, where one miss swings the
     rate by 12.5pp; below N the arrow is noise, so it stays hidden.)
  4. **|Δ| < 4.0 percentage points** → `≈ Same as last week`
     (**tolerance = 4pp** — at a full week of ~56 slots one flipped habit is ~1.8pp; small
     churn must not read as Stronger/Quieter. 83% vs 82% reads as Same.)
  5. Δ ≥ +4.0pp → `↑ Stronger than last week`
  6. Δ ≤ −4.0pp → `↓ Quieter than last week, that’s okay`
  - Glyph + text, never color alone.
- **Secondary line (`sub`):** `{comparison} · All year: {rate}%` — the all-time percentage is
  preserved here, demoted from headline (it exists nowhere else; heatmap tooltips are per-day).

**Past-year view (year < current year):**

- **Value:** `412 of 620` — the same scheduled-slot counts aggregated over that year.
- **Caption:** `Completed in 2025`. **Icon:** `Zap`.
- **No comparison line, no `All year` line** (both would duplicate what the counts already say).

**Change to `StatTile`:** gains an optional `sub` string rendered as one small line beneath the
caption. All lines are plain text nodes (screen-reader readable).

**Tests:**

1. Monday-start windows: fixture mid-week → this week Mon→today, last week Mon→same weekday
   (equal elapsed days).
2. Mid-week habit creation: denominators differ between windows; a fixture where raw counts rise
   but the rate falls must render the `↓` copy (pins rate-based comparison — your case).
3. All six copy variants (`↑`, `≈`, `↓`, `First week`, `Just getting started`, `A quiet week`).
4. Past year: counts value, `Completed in {year}` caption, **no** `All year`, **no** comparison.
5. Scheduled-slots only: an off-day bonus completion raises the Completions tile but **not** the
   weekly `X of Y` — both asserted in one test (your case).
6. Days after today never enter either window's denominator.
7. Existing `Completion Rate` tile assertions are replaced by the above.
8. **Tolerance boundary:** |Δ| = 3.99pp → `≈ Same as last week`; |Δ| = 4.00pp → arrow.
9. **Minimum-data boundary & precedence:** this-window denominator 9 → `Just getting started`;
   10 → comparison proceeds; 0 → `A quiet week`; this > 0 with last-window 0 → `First week`
   (rule order pinned: quiet → first week → just getting started → tolerance).

---

## 9. Known limitations (documented, accepted for this slice)

1. **Frequency edits reinterpret history.** Past days are re-evaluated against the habit's
   *current* frequency every time stats render; no schedule history is stored (deliberate — out
   of scope). With §6, entries landing on now-unscheduled days remain visible, count in the
   all-completions family, and never touch the rate. Pinned by a test.
2. **The two number families diverge by design** (§6): weekly `X of Y`, rate, tooltips, and
   intention bars are scheduled-slot numbers; the Completions tile counts everything done.
3. **Streak equality scope:** header == Stats tile only when both reference today; a past-dated
   Today view shows the as-of-date streak (intentional).
4. **Chips do not fix existing data:** grouping stays exact-match until intentions are re-tagged
   by hand (owner's plan; no migration).

## 10. Out of scope

Storage safety & backups (slice 1b) · celebrations · onboarding · retention features · romantic
layer · PWA/offline · intention data migration · schedule history · seed-data changes · copy
beyond the §4/§8 strings · layout changes beyond the two controls · new dependencies.

## 11. Testing & acceptance

- Every §3–§8 test written failing-first; one commit per fix.
- Gates green in order: tests (206 existing + new) → typecheck → lint → build.
- Manual spot-check on `npm run start`: header streak equals Stats; Meditate 15/15 shows the
  check and announces "completed"; heatmap opens scrolled to the current week; trend-tile copy
  variants; chips in both habit forms; heatmap still deep-links to note views.
- No new packages; no network calls; `TZ=America/Los_Angeles` pin unchanged.

## 12. Next step

Approve this spec → `writing-plans` produces the implementation plan → plan approval → code.
No code before both approvals.
