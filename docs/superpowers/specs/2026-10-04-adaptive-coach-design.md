# Adaptive Habit Coach

**Date:** 2026-10-04 · **Status:** approved by user 2026-10-04 · **Supersedes:** nothing (new subsystem; builds on the add-habit `difficulty`/`reminderTime` fields and the existing stats/surfaces)

## 1. Goal

A coach that **analyzes user behavior and adjusts recommendations dynamically**:

- **When a user struggles** → suggest frequency reductions, new reminder times, and habit-stacking ideas.
- **When a user succeeds** → recommend leveling up, reward messages, and progress encouragement.
- **Integration surfaces** → inside Insights and the daily habit check-in (Home).

Recommendations recompute from live data on every render, so they appear, change, and disappear as behavior changes — the "adaptive" part comes from the data, not from a model.

### Locked conversation decisions

| # | Decision |
|---|---|
| Q1 | **Rule-based heuristics.** No LLM, no network, no API keys — deterministic rules over completion data with a curated copy library. Keeps the app local-first, free, and unit-testable. |
| Q2 | **One-tap apply.** Structured suggestions (frequency, reminder, difficulty, target) carry a `patch` applied via the existing `putHabit` + write-error-banner path. Habit-stacking, rewards, and encouragement are text-only (nothing to apply). |
| Q3 | **Level-up = difficulty + target bumps.** Boolean habits suggest the next difficulty (easy → medium → hard); quantity/timer habits suggest +10% targets. **Frequency stays the struggle-only lever** — one lever per direction. |
| Appr | **Approach 1: pure derived engine** mirroring `stats.ts`. No new DB tables; dismissals live in localStorage (theme-class: device-local, not exported, untouched by reset). |

### In scope

`src/lib/coach.ts` (+ `coach.test.ts`), `CoachCard` on Home, `CoachSection` in Insights (+ tests), a `tapTargets.test.ts` extension, master-spec and README doc updates.

### Out of scope (§8)

Everything deferred there: notifications, LLM wording, coach journal, threshold-tuning UI, difficulty downgrades.

## 2. Current state (what exists to build on)

- **No coach anywhere today** — repo grep for `coach|adaptive|recommend|habit stack` finds nothing.
- **Analysis primitives already exist** in `src/lib/stats.ts`: `isCompleted` (the completion truth), `completionRate`, `currentStreak`, `longestStreak`, `weekTrend`, `weekWindows`, `levelFor`. The coach composes these; it reimplements none of them.
- **Both surfaces exist**: Home = date strip + streak-summary strip + habit rows (the daily check-in); Insights = Year stats → By intention → heatmap → All time.
- **`difficulty` and `reminderTime`** just landed on `Habit` (add-habit work), including import repair — the level-up and reminder levers are real fields already.
- **Entries carry `timestamp`** — reminder suggestions can derive from the user's actual completion times.
- Seed habits predate `difficulty`, so they read as `medium` (the same default the form materialises).

## 3. R1 — Engine (invariants)

Module: `src/lib/coach.ts`, pure and synchronous.

```ts
generateCoachInsights(habits: Habit[], entries: Entry[], today: string): CoachInsight[]
interface CoachInsight { id: string; kind: 'struggle' | 'success'; category: Category;
  habitId?: string; title: string; body: string; patch?: Partial<Habit>; }
type Category = 'frequency' | 'reminder' | 'stack' | 'difficulty' | 'target'
  | 'reward-streak' | 'reward-day' | 'encouragement';
```

- **I1 — pure & deterministic.** Same inputs → same output, same order. No I/O, no `Date.now()` (`today` is a parameter, local-day semantics like `todayKey`), no `localStorage`. Dismissal filtering is the UI layer's job.
- **I2 — slot-aware.** All rates count only scheduled days after `createdAt`, using `isCompleted`. A habit's 14-day window has `slots` (scheduled days) and `hits` (completed days); `rate = hits / slots`.
- **I3 — silence is per-signal, not global.** Struggle needs **≥ 6 slots** in the 14-day window (a never-completed but well-established habit *does* struggle — 0/6 fires it; entries are not required for that signal). Rewards/encouragement require their data (entries, prior week). Reminder derivation requires ≥ 1 completion in the trailing 30 days — **no completions → no reminder suggestion, nothing invented**. No habits, all dismissed, or no signal firing → both surfaces render nothing (no empty box, no generic greeting).
- **I4 — stable ids are the dismissal contract.**

| Category | id |
|---|---|
| struggle (any of freq/reminder/stack) | `struggle:{habitId}` |
| level-up | `levelup:{habitId}:{difficulty\|target}` |
| streak milestone | `reward:{habitId}:streak:{n}` |
| perfect day | `reward:perfectday:{date}` |
| encouragement | `encourage:{isoWeek}` |

- **I5 — patches are data, never actions.** `patch` holds only `frequency`, `reminderTime`, `difficulty`, `target` — never writes, never navigates. Applying is the user's click: `putHabit({ ...habit, ...patch })` through the existing write path.

### Analysis rules (thresholds locked)

| Signal | Rule |
|---|---|
| **Struggling** | trailing-14-day rate **< 50%** (with ≥ 6 slots) **OR** the last **3** consecutive scheduled days are all missed |
| **Level-up (boolean)** | streak ≥ 7 & 7-day rate ≥ 80% → next difficulty (`undefined` reads `medium`); **medium → hard requires streak ≥ 14**; `hard` is terminal |
| **Level-up (quantity/timer)** | streak ≥ 7 & 7-day rate ≥ 80% → target +10%: quantity `ceil(target × 1.1)`; timer `ceil(target × 1.1 / 60) × 60` (≥ +60 s) |
| **Reward — streak** | `currentStreak` hits **exactly** one of 7 / 14 / 30 / 50 / 100 / 200 / 365 today |
| **Reward — perfect day** | every scheduled habit done today, ≥ 1 scheduled |
| **Encouragement** | this week's completed count ≥ **last week's count + 2** (raw counts — midweek makes this conservative, which is the point) |

Ranking (Home takes the first; Insights caps at 6): **struggle > level-up > reward > encouragement**; struggles ordered by worst rate first; otherwise category order as listed. New habits (< 7 scheduled days in history) can't reach level-up or milestone signals — they simply have no streak yet.

## 4. R2 — Suggestion catalog (exact copy)

Dynamic slots in `{}`; times display friendly 12-hour (`7:30 pm`) while patches store 24-hour `HH:MM`; counts use thousands separators.

| # | Category | Fires when | Patch | Title · Body (exact) |
|---|---|---|---|---|
| 1 | `frequency` | Struggling & scheduled **> 3** days/week | Remove up to 2 worst weekdays (ranked by hits asc in the window; ties → later weekday first); never below 3 days; if only 1 day removable, single-day copy | `Lighten the schedule` · `{Name} is slipping — {hits} of {slots} scheduled days. Trim {Day1} and {Day2}?` / `… Trim {Day1}?` |
| 2 | `reminder` | Struggling & derived ≠ current (incl. absent) & ≥ 1 completion in 30d | `reminderTime` = mode completion hour − 30 min (midnight wraps: hour 0 → `23:30`); mode-hour ties → earliest | `Pick a reminder time` / `Move your reminder` · `{Name} has no reminder. You usually check off habits around {peak} — set {time}?` / `{Name} reminds you at {current}, but you usually finish habits around {peak} — try {time}?` |
| 3 | `stack` | Struggling & ≥ 2 habits & some other habit shares a scheduled weekday | *none* — anchor = highest 30-day rate with ≥ 7 slots (tie → higher streak → name asc) | `Stack it` · `Stack it: do {Name} right after {Anchor} — your steadiest habit.` |
| 4 | `difficulty` | Boolean; streak ≥ 7 (medium → hard ≥ 14) & 7-day rate ≥ 80%; not `hard` | `difficulty: 'medium' \| 'hard'` | `Level up` · `{n}-day streak on {Name}. Ready for {next}?` |
| 5 | `target` | Quantity/timer; streak ≥ 7 & 7-day rate ≥ 80% | `target` per +10% rule above | `Raise the target` · quantity: `{current} {unit} for {n} days straight. Try {next}?` (drop `{unit} ` when empty) / timer: `{n}-day streak at {currentMin} minutes. Try {nextMin}?` |
| 6 | `reward-streak` | Streak hits exactly 7/14/30/50/100/200/365 today | *none* | `Streak milestone` · `{n} days of {Name} in a row. That's a habit now.` |
| 7 | `reward-day` | Perfect day today | *none* | `Perfect day` · `Every habit checked off today. Perfect day.` |
| 8 | `encouragement` | This week ≥ last week + 2 completions | *none* | `Momentum` · `You logged {delta} more completions than last week. Keep that going.` |

**Dismissal storage:** `localStorage['habibit:coach-dismissals']` = JSON `{ [id]: dismissedAtEpoch }`; UI hides dismissed insights whose timestamp is **< 7 days old** (nag at most once per week; still-relevant suggestions return after TTL). Writes prune expired entries; corrupt/non-numeric JSON is treated as empty (try/catch, never crash). Buttons: `Apply` (native, `py-2.5`); dismiss control `aria-label="Dismiss suggestion"`. Group headings (Insights): `Needs attention` · `Level up` · `Celebrate`. Home card label: `Coach`.

Tone: warm, never shaming, no color-only meaning — the house voice (`trendCopy` style).

## 5. R3 — Preserved behaviors & consistency

1. **No schema change.** Zero new IndexedDB tables; `resetToEmpty`, export, import, and the seed marker are untouched. Dismissals are device-local, theme-class — reset clears habits/entries, not the user's theme or dismissals.
2. **Existing structure stays.** Coach *inserts* only: Home keeps its date strip, streak strip, and rows; Insights keeps its four existing blocks in order (coach goes after Year stats).
3. **Existing write path only.** Apply = `putHabit` + `reportWriteError` banner; no new error mechanisms, no new navigation.
4. **Existing live data only.** Both surfaces reuse their current habits/entries live queries — the coach opens no new Dexie queries.
5. **Frozen house rules:** no new dependencies, no runtime network, tap targets ≥ 40 px (extended pin), dark + light via existing tokens, `prefers-reduced-motion` untouched, lint baseline (2 warnings in `stats.test.ts`), exact staging, full gates per commit.

## 6. R4 — Testing requirements (TDD, red first)

1. **`src/lib/coach.test.ts`** — fixture-driven, pure:
   - struggle: rate < 50% with ≥ 6 slots fires (incl. 0/6 never-done); missed-last-3 fires with an otherwise-good rate; ≥ 50% + no recent miss → silent; < 6 slots → silent.
   - frequency patch: removes the two worst weekdays, ties deterministic, never below 3, single-day variant at 4 days, no suggestion at ≤ 3.
   - reminder: peak − 30 min with midnight wrap; equals current → silent; zero completions → no reminder insight; absent vs present copy variants.
   - stack: shared-day requirement, no-anchor (single habit) silence, deterministic anchor tiebreak.
   - level-up: `easy`+7 → `medium`; `medium`+14 → `hard`; `easy`+13 → none; `hard` → none; `undefined` behaves as `medium`; quantity `10000 → 11000`; timer `900 → 1020`.
   - rewards: fires exactly at 7/14/30…, not at 8; perfect day with ≥ 1 scheduled & all done; guards otherwise.
   - encouragement: delta ≥ 2 fires, 1 does not.
   - ids match §4 exactly; priority ordering deterministic; same inputs → deep-equal output (I1).
2. **`CoachCard.test.tsx`** — renders nothing when empty; shows top-priority insight; Apply calls `putHabit` with the patch and disables in flight; write failure surfaces the existing banner (AddHabitScreen's NavShell pattern); dismiss writes the id and hides; hidden for non-today dates.
3. **`CoachSection.test.tsx`** — groups render with exact headings; ≤ 6 items; hidden when nothing to show; per-row Apply/dismiss.
4. **`tapTargets.test.ts`** — pin CoachCard's Apply/dismiss classes.
5. **Existing suites stay green** — demo-seed fixtures may legitimately trigger a card; re-anchor any Home/Insights query that assumed no coach (re-anchor, never weaken). Gates per commit: `npm test` → `typecheck` → `lint` → `build`.

## 7. Verification gates

- **V1–V4** — test / typecheck / lint (baseline warnings) / build, all green; route table unchanged.
- **V5 (manual, `npm run start`)** —
  1. Natural success path: demo Read streak (18 days, `undefined` → `medium`) should surface a **Level up** suggestion → `Apply` → row/edit form shows `hard`; Insights group updates live.
  2. Synthetic struggle: via console, delete recent entries for one habit so its 14-day rate < 50% → Home card shows a struggle insight; Insights shows `Needs attention`; **Apply frequency** → form shows trimmed schedule; **dismiss** → hides + `habibit:coach-dismissals` written; reload → still hidden.
  3. Past-date browse on Home → no coach card. Complete a day → encouragement/perfect-day path if data warrants.
  4. A11y/tone: keyboard-reachable buttons with visible focus, ≥ 40 px, dark **and** light, 360 px, no color-only meaning.
- **V6 (regression)** — import/export, reset, completion flows, theme, WriteErrorBanner unchanged; dismissals survive reset (theme-class) without crashing.

## 8. Deferred (recorded, not built)

1. LLM/personalised wording (rejected Q1) and any network call.
2. Notifications — `reminderTime` remains stored-only (per the add-habit ruling).
3. Difficulty **downgrade** suggestions (the struggle list is exactly frequency/reminder/stack).
4. Coach journal / history of suggestions (Approach 2 rejected).
5. Threshold-tuning UI or per-habit coach settings — thresholds are constants in `coach.ts`.
6. Per-row inline hints on Home; coach on past dates.
7. Exporting or syncing dismissals across devices.
