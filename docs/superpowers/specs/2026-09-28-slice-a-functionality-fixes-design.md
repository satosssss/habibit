# Slice A — Functionality Audit & Fixes — Design Spec

**Date:** 2026-09-28 · **Status:** approved design, pending user spec review
**Source:** read-only functionality audit of the codebase (50 findings, ~20 verified-healthy areas) conducted 2026-09-28.
**Supersedes:** the original habibit spec §4's "over target stays done (water 9/8)" rule — this slice introduces a hard cap invariant (R1) and rewrites the tests that pinned the old rule.

---

## 1. Context & scope

Habibit's first big post-slice-1a work item: make every existing feature demonstrably work. The audit found no ceiling anywhere in the app (steppers, exact-value modal, timer, import are all floor-only), a streak badge that swallows taps on the completion control, a modal that silently writes 0 or discards input, an import path that can crash render, dead code, missing loading/empty/error states, and functional a11y gaps (no focus trap, mouse-only reorder).

**Boundary (agreed with the user):** this slice fixes **behavior**; visual appearance and sizing are Slice D's (the glassmorphism redesign). Every fix here is behavior-complete but minimally styled; D restyles it later. Nothing gets fixed twice.

**Invariants carried from previous slices:** local-first only — no network calls, no third-party CDNs, no new runtime dependencies (hand-rolled solutions only); dark mode; large tap targets (sizes themselves deferred to D, see §10); no color-only meaning; `prefers-reduced-motion` respected; warm, never-shaming tone in all copy; TDD with gates in order (test → typecheck → lint → build) before every commit; exact file staging, never `git add .`; never stage `.opencode/` or `opencode.json`; `TZ=America/Los_Angeles` vitest pin unchanged.

---

## 2. R1 — Value cap invariant (normative)

> **For every habit, the entry value shown, stored, and imported always satisfies `0 ≤ value ≤ target`.** Boolean habits are `0` or `1`. The app never displays `11/8`, and no code path can make it possible.

Enforced at three layers (all three are required; each guards a different entry point):

### 2.1 Write boundary
- New shared pure helper `clampedValue(habit, value)` in `src/lib` (finite check, floor 0, ceiling `habit.target`).
- `repo.putEntry` looks up the habit and applies `clampedValue` before writing. If the habit no longer exists (orphan write), clamp to `≥ 0` only — orphans are pruned by the existing boot pass.
- Because every screen writes through `putEntry`, all callers become safe by construction; UI-level clamps (2.2) exist so controls can show correct disabled states rather than silently no-op.

### 2.2 UI controls
- **Quantity steppers (HabitRow):** `+` is `disabled` when `value ≥ target`; `−` is `disabled` when `value ≤ 0`. Disabled state is visually evident (D refines) and exposed to AT via the native `disabled` attribute. Completion state is unchanged: `value ≥ target` renders the check.
- **ValueSheet (exact value):** input gets `max={habit.target}`; see R4 for validation behavior.
- **TimerModal:** `duration` clamps to `[60s, target]` — tap steppers, hold-repeat ±5 min, and the `+5 minutes` pill all disable at the cap. Persisted value = `min(elapsed, duration)` (never above target). Completion fires when `elapsed ≥ duration` and persists **the session's duration**, not blindly `habit.target` — the log must reflect what was actually done (a 10-minute session on a 15-minute habit logs 10 and stays incomplete). Completion still writes exactly once; the existing no-double-write behavior is preserved. Gradient ratio clamps to `[0,1]` before `conic-gradient`.
- **Ring/labels:** ring ratio already clamps `0..1`; displayed percent **floors** (`Math.floor`) so "100% but not done" is impossible; subtext shows the real value (`899 of 900 seconds`, never a rounded-up "15 of 15" while incomplete).

### 2.3 Import + migration
- Import: entry values are validated finite and `≥ 0`, then **clamped to the target of their habit** (older exports may legitimately contain over-target values — clamp, don't reject). Non-finite values become `0` (see R6 for reject-vs-repair rules).
- One-time boot migration `clampLegacyEntries()` runs alongside the existing `seedIfEmpty`/`pruneOrphans` pass in NavShell: any stored value above its habit's target is rewritten to the target; negative/non-finite values become `0`. Failures follow R3's write-failure path (banner, no crash). Idempotent; cheap (single pass over entries).

### 2.4 Spec reversal record
The original spec §4 and its pinned test ("over target stays done — water 9/8") are **deliberately reversed** by user requirement. Affected tests are rewritten to assert: stepper stops at `8/8`, `+` disabled, value never exceeds target via any control. `isCompleted = value ≥ target` is unchanged (equivalent to `===` once capped).

---

## 3. R2 — Broken/dead code & consistency

1. **FlameBadge** gets `pointer-events-none` so it can never swallow taps on the ring/check button (the user-reported "check button doesn't work" root cause). Visual repositioning (if still needed) is D's call.
2. TodayScreen empty-state CTA: raw `<a href="/settings">` → Next `<Link>` (no full document reload).
3. **Remove unreachable code:** TodayScreen's "That day hasn't happened yet." branch (routes redirect future dates) and the `isPast` title branch (past dates render NoteScreen). Tests exercising the past-title branch are updated to the reachable behavior.
4. **Single completion path:** extract `toggleEntry(habit, date, values)` used by both TodayScreen and NoteScreen (today: duplicated `boolean ? 1 : target : 0` logic). NoteScreen quantity/timer rows gain `value of target` subtext so toggling is no longer an invisible jump to full target.
5. **Display consistency:** NoteScreen intention groups sort by `order` (matching Stats); StatsScreen `minYear` is correct before first paint (no brief out-of-range year offer).

---

## 4. R3 — States & error feedback

### 4.1 Loading gates (no false data)
- TodayScreen grid: gated while `habits` **or** `entries` are `undefined` (today only `habits` is gated — rows flash `0/8` then jump).
- NoteScreen checklist: same gate (currently renders an empty checklist mid-load).
- StatsScreen tiles + "By intention": gated (today flashes `0` tiles and a false "No habits yet.").
- HabitsPanel list: gated while `habits === undefined`.
- While gated: neutral "Loading…" placeholder (visual skeleton = Slice D).

### 4.2 Empty states
- HabitsPanel with zero habits: "No habits yet — create one." (the create control stays visible).
- NoteScreen with nothing scheduled: "Nothing scheduled this day." after the quote/heatmap.

### 4.3 Write-failure feedback
- Shared transient error banner component: `role="alert"`, dismissible, current-theme surface (D restyles). Copy: **"Couldn't save that change — your browser storage may be full."**
- Every IndexedDB write gains `try/catch` feeding that banner: TodayScreen `setValue`/`saveHabit`, NoteScreen toggle, HabitsPanel save/delete/reorder (reorder also becomes **one Dexie transaction** instead of N independent writes), TimerModal's three persistence points, NavShell `seedIfEmpty`/`pruneOrphans`.
- NoteScreen `share()`: `try/catch` around `navigator.clipboard.writeText` plus a fallback when `navigator.clipboard` is undefined; transient status via `aria-live="polite"`: **"Link copied"** / **"Couldn't copy the link"**.
- `useLiveQuery` errors surface through the same banner instead of an infinite "Loading…".

---

## 5. R4 — ValueSheet (exact-value modal)

- **Empty/whitespace input:** rejected with inline error **without closing** (today: `Number('') === 0` silently wipes the day's progress).
- **Non-numeric input:** rejected with inline error **without closing** (today: silently discards and closes).
- **Out-of-range (`> target` or `< 0`):** rejected with the same inline error.
- Validation error copy: **"Enter a number from 0 to {target}{ unit}."** Persistent helper under the input: **"Maximum {target}{ unit}."** (`unit` = `habit.unit` with a leading space, omitted when empty).
- Enter saves only when valid; Save button enabled state reflects validity.
- **New test file `ValueSheet.test.tsx`** — the component currently has zero tests: covers valid save, empty, NaN, out-of-range (each: sheet stays open + error shown), Enter behavior, cap at target.

---

## 6. R5 — Forms, dialogs & keyboard reorder

### 6.1 HabitForm
- The fields become a real `<form>`: **Enter in "Habit name" submits** (subject to validation).
- Category and intention: trimmed; empty save blocked with inline **"Choose a category."** / **"Choose an intention."** (no more blank headings).
- Frequency: saving with zero weekdays blocked with inline **"Pick at least one day."** (no more invisible never-scheduled habits).
- Target field empty/invalid on save: inline **"Enter a target."**, save blocked (replaces the silent `1`/`600` fallback — those tests are rewritten).
- Type-switch conversion (draft-level, within the open form): timer→quantity converts seconds to minutes (`max(1, round(s/60))`); quantity→timer converts to seconds (`value × 60`, min 60s); the draft target is otherwise never destroyed by a type switch (a qty→boolean→qty round trip in the same session keeps the number; `target = 1` is coerced only at save time for boolean habits).

### 6.2 Sheet (shared modal shell — HabitForm, ValueSheet, TimerModal, MenuDrawer)
- On open: focus moves into the panel. Tab cycles within the dialog (focus trap). On close: focus restores to the opener. Background is `inert`/un-tabbable and body scroll is locked. Escape/backdrop close already works and is preserved.
- CategorySection collapse control gains `aria-controls` for the list it reveals (sizing still D).

### 6.3 Keyboard reorder
- HabitList rows gain move-up / move-down buttons (`aria-label` "Move {name} up / down") as a keyboard/touch alternative to drag; reordering persists through a single transaction (see R3.3) and announces politely ("{name} moved up").

---

## 7. R6 — Import hardening (crash-proof)

**Principle: repair when unambiguous, reject when structural; never crash render.**

- `isHabit` gains: `color` must match `#rrggbb`/`#rgb` else fall back to `#6366f1`; `icon` must be a known icon id else the default icon `'target'`; `category`/`intention` non-empty strings else `"Other"`; `name` non-empty else `"Untitled habit"`; `frequency` filtered to unique integers 0–6 — **if nothing usable remains, reject the file**; `target` coerced per type (boolean → 1, quantity ≥ 1, timer ≥ 60).
- `isEntry`: `value` must be a number; non-finite or negative values are repaired to `0`, then clamped to the habit's target as in R1.3 (only *habit-level* structural failures reject the file, per the principle above). Entries referencing habits absent from the file keep today's orphan behavior (pruned at boot).
- Structural failures reject the whole file with the existing DataPanel message pattern: **"That file contains values we can't import."** (input reset, dialog never stranded — behavior already test-pinned and preserved).
- Fixture tests: a hostile export (bad color, negative value, `Infinity`, empty frequency) imports without throwing, renders Today without an error boundary, and shows repaired values.

---

## 8. Copy rules (normative — exact strings)

| Surface | String |
|---|---|
| Write-failure banner | `Couldn't save that change — your browser storage may be full.` |
| Share status | `Link copied` / `Couldn't copy the link` |
| ValueSheet error | `Enter a number from 0 to {target}{ unit}.` |
| ValueSheet helper | `Maximum {target}{ unit}.` |
| HabitForm | `Choose a category.` / `Choose an intention.` / `Pick at least one day.` / `Enter a target.` |
| HabitsPanel empty | `No habits yet — create one.` |
| NoteScreen empty | `Nothing scheduled this day.` |
| Loading (while gated) | `Loading…` |
| Import structural failure | `That file contains values we can't import.` |

All copy warm and plain; no shaming; ASCII/typography follows existing file conventions (existing tests match substrings unless noted).

---

## 9. Testing & delivery requirements

- **TDD per fix:** red test → implementation → gates in order (`npm test` → `typecheck` → `lint` → `build`) all green **before every commit**; one commit per finding group below; exact staging only.
- **Planned commit groups:**
  1. Cap invariant (helper + `putEntry` clamp + stepper disables + rewritten over-target tests)
  2. ValueSheet rebuild + new test file
  3. TimerModal cap/persist/gradient fixes
  4. Import validation + boot migration
  5. Loading/empty gates + write-failure banner + share status
  6. HabitForm validation/conversions + Sheet focus management + keyboard reorder
  7. Dead-code removal + shared `toggleEntry` + consistency fixes
  8. FlameBadge tap fix + remaining functional-a11y bits
- **New/updated test files:** `ValueSheet.test.tsx` (new), `HabitsPanel.test.tsx` (new), TodayScreen quantity/timer write paths (currently untested), rewritten caps in `HabitRow.test.tsx`, rewritten fallback tests in `HabitForm.test.tsx`, migration + import fixtures.
- **Final verification:** all four gates green on the final tree; manual browser smoke of every screen (Today both modes, Note view, Stats, Settings/Habits, both modals, timer, import of a hostile fixture); `git status` clean except the untracked pair.

---

## 10. Out of scope (recorded, not dropped)

- **→ Slice D (appearance):** all touch-target sizing (32/36/40 → 44px, heatmap cell hit areas), DateStrip/heatmap human-readable aria labels, skeleton/shimmer visuals, banner/toast visual styling, hover/press/animation polish, glass styling, tooltip visual linkage, TimerModal countdown live region, and the "NoteScreen prev/next-day navigation" decision (made during D's first-time-user flow review).
- **→ Slice C (rewards):** live-region announcements of value/streak changes as encouraging feedback.
- **Won't fix (documented):** pre-mount blank frame during the SSR clock gate (deliberate trade-off, R1-adjacent docs exist), ThemePanel's unpressed "system" state in the drawer (documented intent).

## Appendix — audit finding dispositions

Findings 1–50 from the 2026-09-28 audit map as: **R1** — 16, 17, 18, 19 (timer/sheet caps) · **R2** — 1, 2, 3, 6, 9, 11, 12, 34, 36, 41 · **R3** — 4, 5, 20, 27, 28, 33, 35, 40, 42, 47, 48 · **R4** — 14, 15 · **R5** — 13, 21 (buttons only), 22, 23, 24, 25, 26, 29, 31 · **R6** — 45, 46 · **→ D** — 7, 8, 10, 21 (live region), 30, 37, 38, 39, 50 · **→ C** — 49 · **Won't fix** — 32, 43 · **Healthy (untouched):** date navigation, boolean toggle, category collapse, timer lifecycle, habit form create/edit, combobox, list edit/delete/reorder mechanics, DataPanel export/import flow, theme persistence, MenuDrawer→Settings, NavShell nav/banner, Sheet close mechanics, all stats/streaks/heatmap/trend behavior, note-view content, storage fallback, route guards.
