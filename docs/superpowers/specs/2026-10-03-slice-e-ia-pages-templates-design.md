# Slice E — Pages, Dashboard & Habit Templates (IA Expansion)

**Date:** 2026-10-03 · **Status:** awaiting spec review · **Supersedes:** nothing (builds on slice D design system)

## 1. Goal

Grow Habibit from a 3-tab app (Today / Stats / Settings) into a five-destination
information architecture — **Home, Habits, Calendar, Insights, Settings** — with a
dedicated **Add habit** flow backed by a curated **template library**
(Good · Health · Bad · To-do), and a Home dashboard that shows today's habits plus
streak summaries at a glance.

### Locked conversation decisions

| # | Decision |
|---|---|
| Q1 | **Consolidate.** The five pages *are* the new structure: `/` becomes Home (today's content + streak strip), `/stats` evolves into `/insights`, `/settings` stays, `/habits`, `/add-habit`, `/calendar` are net-new. No overlapping duplicate pages. |
| Q2-A | Bottom bar = Home · Habits · Calendar · Insights · Settings. **Add habit is not a tab**: floating **+** button on Home and Habits (mobile), prominent button in the desktop sidebar. |
| Q3-A | Tapping a template **prefills `HabitForm`** — no second creation path; user reviews/edits, then saves through the existing repo write path. |
| Q4-A | **Bad = abstinence booleans.** No inverted/limit semantics anywhere; streaks, completion, counters (0..target) are untouched. |
| Appr. | **Approach 1** — house pattern: thin `page.tsx` + tested screen component under `src/components/`, existing glass system, static curated templates, single spec. |

### In scope
Five routes + redirects, nav restructure (bottom bar, sidebar, FAB), Home streak
summary strip, habit-management move out of Settings, template catalog + gallery
prefill flow, calendar month grid, insights relocation.

### Out of scope (deferred, recorded in §10)
User-editable templates; "already added" detection on template tiles; any new
analytics beyond current Stats content; inverted/limit habit semantics; onboarding
(slice B) and rewards (slice C) remain separate slices.

## 2. Routes

| Route | Rendering | Content |
|---|---|---|
| `/` | client page in `NavShell` | **Home** = `HomeScreen` (today's content + `StreakStrip`) |
| `/habits` | client page in `NavShell` | **Habits** = `HabitsScreen` (header + `HabitsPanel`) |
| `/add-habit` | client page in `NavShell` | **Add Habit** = `AddHabitScreen` (template gallery + scratch) |
| `/calendar` | client page in `NavShell` | **Calendar** = `CalendarScreen` (month grid) |
| `/insights` | client page in `NavShell` | **Insights** = `InsightsScreen` (relocated stats) |
| `/settings` | unchanged | Settings minus its Habits panel |
| `/today/[date]` | unchanged route, renders `HomeScreen date={…}` | per-day detail view (DateStrip + calendar target) |
| `/today` | **server** `redirect('/')` | bookmark compatibility |
| `/stats` | **server** `redirect('/insights')` | bookmark compatibility |

Root `/` stops redirecting *to* `/today` and renders Home directly. All five real
pages are statically prerendered (they are client components — same as today's
`/today`, `/stats`). Redirects are server components using `next/navigation`'s
`redirect()` (no client shell needed for a redirect).

## 3. R1 — Navigation

**Bottom bar (mobile, `md:hidden`):** exactly five tabs — Home (`Home` icon),
Habits (`ListChecks`), Calendar (`CalendarDays`), Insights (`BarChart3`),
Settings (`Settings`) — same link styling, `aria-current="page"`, and sizing
patterns as today's three tabs (5 × flex-1 fits a phone; icon + 11px label each).
Icon names must be verified against the installed `lucide-react` at build time
(typecheck fails loudly if an export moved).

**Desktop/tablet sidebar:** same five entries (icon rail `md`, labelled `xl`) plus a
prominent **Add habit** button (`btn-primary`, `Plus` icon) under the wordmark —
label visible at `xl`, icon-only with `title` + `aria-label="Add habit"` at `md`.

**Floating action button (mobile only, `md:hidden`):** circular `Plus` button fixed
above the bottom bar (right side, `z` above content, below Sheet/Toast z-indexes),
`aria-label="Add a habit"` (distinct from the header button's pinned
`aria-label="Add habit"`), routes to `/add-habit`. Visible **only** when
`pathname === '/' || pathname.startsWith('/today') || pathname === '/habits'` —
never on Calendar, Insights, Settings, or Add Habit itself. Minimum 44×44 px.

**Active-tab rules (special case):** the generic `isActive` (`=== href ||
startsWith(href + '/')`) cannot work for `/`. Home is active when
`pathname === '/' || pathname.startsWith('/today')` (the date view *is* Home with a
different anchor, and keeps the Home tab lit). All other tabs keep the generic rule.
`/add-habit` lights no tab.

**MenuDrawer:** untouched (its light/dark toggle stays; its Settings shortcut is
now redundant with the tab but harmless).

## 4. R2 — Home (`/`) dashboard

`TodayScreen` is renamed **`HomeScreen`** (file, component, tests) and keeps every
current behavior: header (menu / `Today` title / header streak flame /
`Add habit` `+`), `DateStrip`, `IntentionBar`, category masonry, row interactions,
sheets, completion toast, loading/empty states.

Changes:

1. **`StreakStrip`** — new section between `IntentionBar` and the category masonry,
   rendered only when habits exist. A row of three glass mini-cards, all computed
   from data `HomeScreen` already loads (`habitStreaks(habits, entries, today)` and
   `buildDayStats(...)`):
   - **Best current streak** — habit name + `N days` + `FlameBadge`; when every
     streak is 0: `0 days` with sub-copy `Start today — streaks build as you go`.
   - **On a streak** — `N of M habits on a streak` (`streak > 0`).
   - **Today** — `X of Y done` where Y = due-today count (frequency-aware via
     `dayStat.scheduled`); when Y = 0: `Nothing scheduled today`.
   - Zero-shaming is forbidden; the copy above is exact.
2. **Header `+`** (`aria-label="Add habit"` — frozen A2 pin) changes from opening the
   inline form to `router.push('/add-habit')`. `HomeScreen` drops its now-unused
   `HabitForm`/`blankHabit` create state (editing stays on `/habits`).
3. **`DateStrip`**: selecting today navigates to `/` (was `/today`); other days keep
   `/today/${key}`.
4. **Empty state CTA**: `Create your first habit` button links to `/add-habit`
   (was `/settings`).
5. Header flame (`overallStreak`, active-day run) is unchanged.

## 5. R3 — Habits (`/habits`)

- New thin **`HabitsScreen`**: `h1` "Habits" + `HabitsPanel` below it (the panel
  keeps its own `H2` heading, list, reorder, delete, and inline `HabitForm` sheet).
- `HabitsPanel` is **removed from `SettingsScreen`** (Settings keeps everything
  else). Its "New habit" button now routes to `/add-habit` instead of opening the
  blank form — one creation destination everywhere (Q2-A); the panel's edit/delete/
  reorder flows are unchanged.
- Empty state: `No habits yet — create one.` becomes a link/button to
  `/add-habit` (copy stays warm; test assertion rewritten to expect the new target).
- `blankHabit()` stays exported from `HabitsPanel.tsx` (it seeds the prefill flow).

## 6. R4 — Add Habit (`/add-habit`)

**`AddHabitScreen`** = `h1` "Add habit" + two entry paths:

1. **Template gallery** — a segmented control of the four groups
   (`Good · Health · Bad · To-do`, `aria-pressed` per segment, matches `HabitForm`
   chip patterns) and, for the active group, a tile grid (icon + name buttons,
   ≥44 px). Tapping a tile:
   - builds a full `Habit` draft: `id = newId()`, `createdAt = Date.now()`,
     `order = 0`, `frequency = [0,1,2,3,4,5,6]`, plus the template's
     name/icon/color/category/intention/type/target/unit (§9);
   - opens the existing **`HabitForm`** prefilled (Q3-A) with `categories` =
     union(existing habit categories, the four group names) and `intentions` =
     in-use intentions from `listHabits()` (same memoization `HabitsPanel` uses);
   - on save: `putHabit` via the existing repo path (`reportWriteError` on failure,
     form behavior identical to `HabitsPanel.save`), then **`router.push('/habits')`**
     so the user sees the added habit.
2. **Start from scratch** — card below the gallery; opens `HabitForm` with
   `blankHabit()` (today's Settings flow), same save/navigation rules.

Gallery state resets sensibly across renders (active group defaults to `Good`);
there is no prefill state leak when the sheet closes without saving.

## 7. R5 — Calendar (`/calendar`)

- **`CalendarScreen`**: `h1` "Calendar", month header (`‹ October 2026 ›` switcher
  + `Today` shortcut), Monday-first weekday headers (consistent with the heatmap,
  spec slice D §8/R6).
- **Grid**: new pure helper **`monthGrid(year, month): Array<string | null>`** in
  `src/lib/dates.ts` — rows of 7 Monday-first, `null` for days outside the month;
  `month` is **1-based** (1 = January), `year` is the calendar year.
- **Cells**: date number + completion indicator from
  `buildDayStats(habits, entries, { from, to })` over the visible month (entries via
  `repo.loadRange`), and `classifyDate(key, today)`:
  - **Rule** (pure functions of `DayStat` + `classifyDate`), evaluated for
    past/today cells only — **future cells are neutral and `aria-disabled`
    (not interactive)**; absence of data is never presented as failure:
    - `dayStat.perfect` → **filled** dot (every due habit done);
    - `dayStat.active` but not `perfect` (partial progress *or* an
      off-schedule/bonus completion on a free day) → **hollow ring** dot;
    - otherwise (due-but-untouched, or nothing scheduled, or no data) → **no**
      indicator;
  - **today** cell also carries an accent ring (`aria-current="date"`);
  - every cell has an `aria-label` with full context — shape + text, never color
    alone: scheduled > 0 → `September 30: 7 of 8 done, 88%` (percentage =
    `Math.round(ratio * 100)`); scheduled = 0 → `October 1: nothing scheduled`;
    future → `October 5: upcoming`;
  - cells are ≥44×44 px.
- **Interaction**: tapping a past/today cell navigates to `/today/${key}` (existing
  detail view). No writes, no new data paths.

## 8. R6 — Insights (`/insights`)

`StatsScreen` is renamed **`InsightsScreen`** (file, component, tests) and
relocated wholesale: year stats, heatmap, by-intention tiles, stat tiles, trend
copy, streaks — behavior unchanged. `/stats` redirects here. No new analytics
(§1 out of scope). The screen keeps its existing internal headings — no new `h1`
is imposed on it (behavior freeze).

## 9. R7 — Template catalog (`src/lib/templates.ts`)

Static, code-only, no user editing. Export:

```ts
export interface TemplateHabit {
  name: string; icon: IconName; color: string; category: string;
  intention: string; type: HabitType; target: number; unit: string;
}
export interface TemplateGroup { key: 'good' | 'health' | 'bad' | 'todo';
  label: string; habits: TemplateHabit[] }
export const TEMPLATE_GROUPS: readonly TemplateGroup[];
```

Rules: every `icon` is an existing `ICONS` key; every `color` is in
`HABIT_COLORS`; timer targets are stored in **seconds** (≥60) and displayed in
minutes by the form; quantity targets ≥ 1 with non-empty units; boolean targets
are 1 with empty units; names are trimmed, non-empty, unique **within a group**;
`category` = the group label; all templates default to daily frequency (set by the
prefill, §6). Group intentions: **Health → `Health`** (preset), **Good → `Growth`**
(preset), **Bad → `Discipline`**, **To-do → `Focus`** (free text; they enter the
in-use suggestions after first use).

Exact catalog (name — type/target/unit — icon — color):

**Good** (intention `Growth`)
| Habit | Type | Icon | Color |
|---|---|---|---|
| Meditate | timer 600 s (10 min) | `flower2` | `#c026d3` |
| Reading | quantity 20 minutes | `bookOpen` | `#14b8a6` |
| Journal | quantity 5 minutes | `pen` | `#f59e0b` |
| Gratitude | boolean | `heart` | `#ec4899` |
| Deep Work | timer 1500 s (25 min) | `brain` | `#6366f1` |
| Wake Early | boolean | `sunrise` | `#f97316` |
| Practice Language | quantity 15 minutes | `languages` | `#22d3ee` |

**Health** (intention `Health`)
| Habit | Type | Icon | Color |
|---|---|---|---|
| Steps | quantity 10000 steps | `workout` | `#22c55e` |
| Run | quantity 5 km | `flame` | `#f97316` |
| Cycle | quantity 10 km | `sun` | `#22d3ee` |
| Swim | quantity 30 minutes | `bath` | `#3b82f6` |
| Stretch | quantity 10 minutes | `flower2` | `#14b8a6` |
| Workout | quantity 30 minutes | `dumbbell` | `#c026d3` |
| Sleep | quantity 8 hours | `bed` | `#6366f1` |

**Bad** (intention `Discipline` — all abstinence booleans, Q4-A)
| Habit | Type | Icon | Color |
|---|---|---|---|
| No Junk Food | boolean | `popcorn` | `#ef4444` |
| No Smoking | boolean | `triangleAlert` | `#f97316` |
| No Soda | boolean | `droplet` | `#3b82f6` |
| No Late-Night Scrolling | boolean | `moon` | `#6366f1` |
| No Impulse Buying | boolean | `wallet` | `#f59e0b` |
| No Oversleeping | boolean | `alarmClock` | `#ec4899` |

**To-do** (intention `Focus`)
| Habit | Type | Icon | Color |
|---|---|---|---|
| Plan Tomorrow | boolean | `calendarCheck` | `#6366f1` |
| Review Goals | boolean | `target` | `#22c55e` |
| Inbox Zero | boolean | `check` | `#3b82f6` |
| Prep Meals | boolean | `coffee` | `#14b8a6` |
| Tidy Up | quantity 10 minutes | `showerHead` | `#f59e0b` |
| Weekly Review | boolean | `graduation` | `#c026d3` |

Overlap with the 8 seed habits is accepted (both are user-visible, editable,
deletable; dedupe belongs with deferred "already added" detection, §10).

## 10. R8 — States, tone, and preserved behavior

- **Empty/zero states** (exact copy): Home `Create your first habit` → `/add-habit`;
  Habits `No habits yet — create one.` → `/add-habit`; streak strip zero-copies per
  R2; Calendar future/empty months render neutral; Add Habit gallery is never empty
  (static catalog).
- **Loading**: same skeleton pattern (`skeleton` class) while `useLiveQuery` is
  undefined; no SSR/ hydration mismatches (date-derived text only after mount, the
  existing `mounted` pattern).
- **Errors**: all writes go through `repo` → `WriteErrorBanner`; degraded-storage
  banner is `NavShell`-global, so new pages inherit both.
- **Tone**: warm, never shaming; **no color-only meaning** anywhere (shape/label
  always accompanies color).
- **Frozen pins** (must still hold): A2 aria-labels (`Add habit` header button,
  `Open menu`), toast `z-[60]`, DateStrip `h-11 w-11`, `habit-fill`, Sheet z-50,
  stylesheet pins in `globals.test.ts`, lint baseline (2 warnings in
  `src/lib/stats.test.ts`), 402 existing test behaviors (assertions may be
  *rewritten* to the new expectations, never loosened).
- **No new dependencies.** Local-first only: no runtime network, fonts/vendored
  assets unchanged. Dark + light both apply via existing tokens; new components use
  existing glass classes (`glass-card`, `glass-nav`, `glass-input`) and the `reveal`
  system (honors `prefers-reduced-motion`).

## 11. R9 — Testing requirements (TDD, full gates per commit)

Unit/component (Vitest + Testing Library), new or moved:

1. `templates.test.ts` — exactly 4 groups with the four labels/order; every habit
   satisfies the §9 rules (icon key exists, color in `HABIT_COLORS`, timer ≥ 60 s,
   quantity ≥ 1 + unit, boolean target 1 + empty unit, unique names per group, no
   blank fields); catalog contents pinned (spot-check ≥1 habit per group incl.
   `Steps`).
2. `dates.test.ts` — `monthGrid` Monday-first alignment, leading/trailing nulls,
   28/29/30/31-day months, December/January year rollover.
3. `HomeScreen.test.tsx` (moved from TodayScreen) — existing behavior + streak-strip
   cards (values derived from `habitStreaks`/day stats; zero-state copy), header `+`
   routes to `/add-habit`, DateStrip today → `/`, empty CTA → `/add-habit`.
4. `HabitsScreen` / `HabitsPanel` / `SettingsScreen` tests — panel visible on
   `/habits`, absent from Settings (assertion rewritten), New-habit button routes
   to `/add-habit`, empty-state target.
5. `AddHabitScreen.test.tsx` — segment switching; tile tap opens `HabitForm`
   **prefilled** (assert name, icon, color, category, intention, type, target, unit,
   frequency); scratch opens blank form; save calls `putHabit` and routes to
   `/habits`; write failure keeps global banner behavior.
6. `CalendarScreen.test.tsx` — month switching, Monday-first headers, frequency-aware
   indicators (due vs not-due vs perfect vs future), `aria-label`s, today ring,
   future cells non-interactive, past/today tap → `/today/${key}`.
7. `NavShell.test.tsx` (rewritten) — five tabs in order with correct hrefs/labels;
   `isActive` special case (Home lit on `/today/2026-10-03`, no tab on
   `/add-habit`); FAB visibility matrix (shown on `/`, `/today/[date]`, `/habits`;
   hidden elsewhere) + `aria-label="Add a habit"`; sidebar Add button present.
8. Redirects — `/today` and `/stats` page modules call `redirect('/')` /
   `redirect('/insights')` (asserted via mocked `next/navigation`).
9. `tapTargets.test.ts` — extended: FAB ≥ 44 px, calendar cell ≥ 44 px.
10. Existing suites stay green (pins above); `npm run build` shows all five routes
    as static `○` and both redirects generated.

## 12. Verification gates

- **V1** `npm test` → all suites green (402 existing + new), zero failures.
- **V2** `npm run typecheck` → 0 errors.
- **V3** `npm run lint` → baseline (2 known warnings only).
- **V4** `npm run build` → green; `/`, `/habits`, `/add-habit`, `/calendar`,
  `/insights` static; `/today` + `/stats` redirects present.
- **V5 (manual/e2e on `npm run start`)** — walk the first-time flow: Home shows
  streak strip + today's habits; FAB → Add Habit; tap *Steps* → form prefilled →
  save → lands on `/habits` with Steps listed under Health; Home now groups it;
  Calendar month cells show indicators, tap a past day → detail view, back on
  Home tab; Insights renders the full stats content; `/today` and `/stats` URLs
  redirect; Settings no longer contains the habits panel; bottom bar + sidebar show
  five destinations; FAB hidden on Calendar/Insights/Settings/Add Habit.
- **V6 (a11y/responsive spot-check)** — keyboard reach + focus rings on all new
  controls; screen-reader labels on tabs/FAB/calendar cells; 360 px phone: five
  tabs fit, no horizontal scroll; dark **and** light themes verified; FAB does not
  cover the last habit row; `prefers-reduced-motion` still disables blob/reveal
  animation.
- **V7 (regression)** — complete/quantity/timer row flows, reorder, delete, import/
  export, theme toggle, sheets/toasts unchanged on Home vs pre-slice behavior.

## 13. Deferred (recorded, not built)

1. User-editable / user-created templates.
2. "Already added" detection on template tiles (each add already requires an
   explicit form confirm).
3. Deduping templates against seed habits (e.g. Steps vs Burn Calories).
4. Any inverted/limit habit semantics (explicitly rejected, Q4-A).
5. New insights/analytics beyond relocated Stats content.
