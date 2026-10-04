# Habibit — Design Spec

**Date:** 2026-09-23
**Status:** Approved by user (design sections 1–4 reviewed in chat)
**Path:** Architectural (new project)

## 1. Intent

Habibit is a local-only habit tracker that reproduces the Grit app's UX (per the
user's reference screenshots) as a Next.js web app, adapted for desktop and tablet
rather than being a stretched phone layout.

Success looks like:

- The three screenshots' visual language reproduced faithfully — layout, spacing,
  typography, border radius, icons, palette, component hierarchy all preserved.
- Runs identically on Windows and Mac in dev; deploys to Vercel with `vercel deploy`
  and zero configuration.
- No backend, no auth, no analytics, no third-party CDN calls. All data in
  Dexie/IndexedDB.
- Genuine three-tier responsiveness: 390px mobile, 768–1024px tablet, 1280px+ desktop.

**Source of truth:** there is no pre-existing code in this repository. "Preserve the
current UI" means the screenshots are the reference; the app is built to match them.

## 2. Decisions made during brainstorming

| Question | Decision |
|---|---|
| Category vs intention | **Two separate fields**, never merged. `category` = time/context (Morning, Health, Evening). `intention` = meaning/purpose (Study, Fix Bed, Take a Bath). One habit has both; they are independent. |
| Today grouping | Group by `category` **only**. Intention never affects Today's grouping. |
| Stats / note-view grouping | Group and color-code by `intention`, with a fixed color per intention used consistently everywhere it appears. |
| Heatmap shape | **True GitHub grid**: 7 weekday rows × week columns, single-hue intensity, month labels on top, weekday labels on the left, intensity legend, hover/tap tooltip. The per-intention rows are *not* the heatmap. |
| Seed depth | Seed habits **plus ~13 weeks of backdated history** so heatmap, streaks and stat tiles show believable numbers on first load. |
| Frequency | `number[]` of weekday indices (0–6). Presets: Every day / Weekdays / Weekends / custom. |
| Quote/note view entry | Reached from a **past date in the date strip**. Heatmap cells deep-link to it. No fourth tab — tab bar stays at three items. |
| Streak rule | A day is **active** if ≥1 scheduled habit was completed. Perfect day (all scheduled habits done) counted separately. Per-habit flame badges use each habit's own consecutive scheduled-and-completed count. |
| Architecture | **App Router routes + Dexie `useLiveQuery`** for all reads. |

### Assumptions (stated, not objected to)

- Theme follows the system by default, with a manual System/Light/Dark toggle in Settings.
- Future dates are visible in the date strip but disabled (cannot be checked).
- The daily quote is picked deterministically from a bundled array of ~50 quotes
  (`dayOfYear % quotes.length`) — stable across reloads, no network.
- Timer completion auto-marks the habit. No notifications, no sound, no permissions.
- The working directory starts empty except `opencode.json`.

## 3. Constraints

- Next.js (App Router) + Tailwind CSS, deployed free on Vercel, zero config.
- Dexie.js over IndexedDB for all persistence. No database service, no paid or
  rate-limited APIs.
- No analytics, no auth, no cloud sync, no third-party font or icon CDNs. Lucide
  icons ship in the local bundle.
- No OS-specific paths or tooling; identical dev experience on Windows and Mac.
- No infinite loops: no `useEffect` date-sync effects, no un-cleared intervals.
- Small components; derived stats memoized; minimal re-renders.
- Seed example habits on first load.

## 4. Architecture

### 4.1 Routes (all client components; `layout.tsx` renders the persistent nav shell)

| Route | Purpose |
|---|---|
| `/` | redirect → `/today` |
| `/today` | today's checkable habit list |
| `/today/[date]` | same component. `date` = `YYYY-MM-DD`. Past → read-only quote/note view; today → normal; future → redirect to `/today` |
| `/stats` | year nav, stat tiles, intention bars, GitHub heatmap, legend |
| `/settings` | habit CRUD, theme, export/import, reset |

Every screen is a client component because IndexedDB does not exist during SSR.
SSR provides the static shell only.

### 4.2 Data model (Dexie `habibit`, version 1)

```
habits:  'id, name, category, intention, type, order, createdAt'
  id          string   // generated client-side, no DB service
  name        string
  icon        string   // bundled Lucide icon name
  color       string   // hex; row fill + intention swatch
  category    string   // time/context: Morning, Health, Evening
  intention   string   // meaning/purpose: Study, Fix Bed, Take a Bath
  type        'boolean' | 'quantity' | 'timer'
  target      number   // quantity: cups/calories | timer: seconds
  unit        string   // quantity unit label ('cups', 'calories'); '' for boolean/timer
  frequency   number[] // 0-6 weekday indices
  order       number   // manual sort within a category
  createdAt   number

entries: 'id, habitId, date, value, timestamp'
  id          string
  habitId     string   // compound index '[habitId+date]' -> one row per habit/day
  date        string   // 'YYYY-MM-DD', local timezone (sole exception: the seed-marker row, date '')
  value       number   // boolean -> 0/1, quantity -> count, timer -> seconds done
  timestamp   number   // last write, drives undo
```

`category` and `intention` are plain strings. Replacing Dexie with a real backend
later is a repository-layer change only: components never touch IndexedDB directly —
all access goes through `src/lib/repo.ts`.

### 4.3 Data flow

- A day's state is a single lookup: `loadDay(date)` returns a `Map<habitId, value>`.
  Today and the note view never N+1.
- All reads use `useLiveQuery`, so any write propagates automatically. There is no
  manual refetch and no second source of truth.
- Writes are optimistic where it matters (toggling a boolean); `liveQuery` confirms.

### 4.4 Derived stats (`src/lib/stats.ts`, pure functions)

`activeDays`, `perfectDays`, `completionRate`, `completions`, `currentStreak`,
`longestStreak`, `heatmapCells(year)`, `perIntentionTotals(year)` — computed from
`habits` + `entries` in one pass, wrapped in `useMemo` keyed on `[habits, entries]`.

### 4.5 Loop-prevention rules

- Date comes from the route param, never from `useState` synced in a `useEffect`.
  The date strip navigates with `router.push`, so there is no strip→list effect.
- Exactly one `setInterval` exists in the app (the timer), created inside an effect
  with explicit deps and cleared on unmount.
- Collapsed-section state lives in `localStorage`, not Dexie, so it does not churn
  the database or re-trigger data queries.

## 5. Today view

1. **Header** — hamburger (mobile), centered title ("Today", or the date such as
   `Sunday, May 24`), flame + current streak, `+` button → new-habit form.
2. **Date strip** — exactly 7 columns, mirroring the screenshot: **5 previous days +
   today + 1 disabled future preview** (Thu 6 → Wed 12, Tue 11 selected).
   Past days: small indigo filled circles joined by a connector line. Selected/today:
   larger indigo circle with an outer ring. Future preview: plain gray numeral,
   disabled. Memoized against a fixed anchor; no clock-tick effect.
3. **Sections by category** — one light-gray rounded panel per category, ordered by
   category then `order`. Header: category icon + name, collapse chevron inside a
   colored ring.
4. **Habit row** — one component, `variant` chosen by `type`. The row fill **is** the
   progress bar: saturated color from 0 → progress, pale tint of the same hue for the
   remainder. White text, white icon chip at left, control at right, per-habit flame
   badge top-right.
   - `boolean` — white circle, check when done; tap toggles.
   - `quantity` — `+`/`−` stepper inside a circular ring; tap-ring opens an exact-value
     sheet. Subtext `Every day, 4/8 cups`.
   - `timer` — circular progress ring; tap opens the timer modal. Subtext
     `Every day, 10 minutes/15 minutes`.
5. **Empty / unscheduled states** — no habits → prompt to create the first one;
   category with nothing scheduled today → section hidden entirely.

## 6. Timer modal

- Dark bottom sheet on mobile; centered dialog from 1024px up (same component, `Sheet`
  vs `Dialog` wrapper).
- Tick-marked countdown ring in the habit's color gradient, `−`/`+` around it
  (±1 min, ±5 when held), flame badge top-right.
- Bottom row: skip / reset / undo icon buttons + `+5 minutes` pill; full-width
  `▶ Start timer` → `Pause` → `Stop`.
- One `setInterval(1000)` created in `useEffect(() => {...}, [running, duration])`
  with cleanup; the ring animates from the same tick (no second loop).
- On completion: write `value = target`, close after a beat, `liveQuery` updates the row.
- Closing mid-run stops the interval but keeps elapsed seconds; reopening resumes.

## 7. Stats view

1. **Year nav** — `‹ 2026 ›`, clamped between the first habit's `createdAt` year and
   the current year.
2. **Year stats** — 2×2 tiles: Active Days, Perfect Days, Completion Rate, Completions.
   All-time: Current Streak, Longest Streak, Total Active Days, Total Perfect Days.
3. **By intention** — one row per intention: icon, name, thin colored progress bar in
   the intention's fixed color, `69/91` (completed / scheduled-so-far this year).
   Sorted by habit `order`.
   **Color note:** intention colors come from a deliberately *subtle* palette (muted
   orange, yellow, teal, blue — as in the screenshots) and are used consistently
   across Stats, the note view, and intention cards. They are a separate scale from
   the bright saturated habit-row fills; a habit's `color` and its intention's color
   are independent values and must not be conflated.
4. **GitHub-style heatmap**
   - 7 rows (Mon–Sun) × ~53 week columns, aligned to week boundaries, year clipped at
     both ends.
   - Single-hue intensity scale (5 levels) from that day's completion ratio
     `completed / scheduled`. No scheduled habits → empty cell.
   - Month labels along the top, weekday labels (`Mon Wed Fri`) down the left.
   - Legend bottom-right: `Less ▢▢▢▢▢ More`.
   - Tooltip on hover (desktop) or tap-to-pin (touch, so iPad works): date, e.g.
     `Aug 14, 2026`; `12 of 14 completed`; `86%`. Dismiss on `Escape` / tap outside.
   - Rendered as one memoized array of divs with a background color per level — no
     per-cell component; recomputed only when the year or entries change.
   - Click a cell → `router.push('/today/[date]')` → quote/note view.

## 8. Quote / note view (`/today/[date]`, past dates)

- Title = the date (`Sunday, May 24`); share icon top-right using the Web Share API
  when available, falling back to copying the link. No network.
- Daily quote from a bundled array of ~50 quotes, index = `dayOfYear % quotes.length`,
  with attribution underneath.
- Compact variant of the same heatmap component (smaller cells, fewer surrounding
  weeks shown) — same code path, a `compact` prop, not a second implementation.
- The day's checklist **grouped by intention**: big intention-colored cards with the
  intention name in caps and its habits as checked rows — matching the screenshot.
  Read-only overall, but checkboxes stay tappable so a missed entry can be corrected.

## 9. Settings view

- **Habits** — list grouped by category, drag-to-reorder (writes `order`), each row →
  edit form. `+ New habit` also available from the Today header.
- **Habit form**, in order: Name; **Category** (combobox — existing or new);
  **Intention** (combobox — existing or new, with color swatch); Icon (bundled Lucide
  grid); Color (palette drawn from the screenshot hues); Type (boolean / quantity /
  timer); Target (quantity → cups/calories, timer → minutes); Frequency (Every day /
  Weekdays / Weekends / weekday toggles). Delete requires confirmation.
- **Theme** — System / Light / Dark segmented control, applied via `data-theme` on
  `<html>`, persisted in `localStorage`.
- **Data** — Export/Import JSON (file download/upload, no network), Reset (clears
  Dexie to empty and stays empty — amended by the 2026-10-04 reset-to-empty spec;
  seeded examples only appear on first install).

## 10. Responsive layout

Three real layouts, one component tree, driven by Tailwind breakpoints plus CSS
`columns` for category masonry. No JS resize listeners, no `window.innerWidth`.

| | Mobile (390) | Tablet (768–1024) | Desktop (1280+) |
|---|---|---|---|
| Nav | Bottom tab bar | Left icon rail (72px) | Left sidebar with labels (240px) |
| Today | 1 column | 2 columns of category panels | 3 columns, masonry by category |
| Stats | Stacked | Tiles 2×2, bars + heatmap side by side | Tiles 4-across, heatmap full width |
| Timer | Bottom sheet | Bottom sheet until 1024px, then centered dialog (§6) | Centered dialog |

## 11. Seed data

Runs on first load when the seed marker is absent (fresh install).

- ~8 habits across Morning/Health/Evening and four intentions, matching the
  screenshot examples: Meditate, Record Weight, Take a Cold Shower, Burn Calories,
  Don't Snack, Learn Spanish, Drink Water, Read.
- ~13 weeks of backdated entries generated from a **seeded PRNG** so every fresh
  install gets identical history: realistic gaps, ~12% perfect days, live current
  streak.
- Seeding writes one seed-marker row (`id: '__seed__'` in `entries`, `date: ''`).
  It is skipped by every read, stat, and export path, written on first install
  and re-written by Reset, so seeding happens exactly once, never resurrects
  after habits are deleted, and boot never re-seeds after a Reset.
  Seeded rows also carry `createdAt`.

## 12. Error handling

- Corrupt or missing IndexedDB (private browsing) → catch on open, show an inline
  banner, and have the repository layer fall back to an in-memory implementation so
  the app stays usable for the session. Components are unaffected: they only ever
  call `repo.ts`.
- Import validation: reject JSON that fails the shape check with a readable message;
  never partially apply.
- Unknown habit id in an entry (deleted habit) → entries pruned on load, ignored by
  stats rather than throwing.
- Future/invalid `date` param → redirect to `/today`.

## 13. Testing

- **Vitest** for pure logic: `stats.ts` (streaks, completion %, heatmap bucketing,
  frequency filtering), `repo.ts` (seed determinism).
- Component tests for the three habit-row variants.
- Manual responsive pass at 390 / 768 / 1280.

## 14. Out of scope (YAGNI)

- Auth, sync, multi-device, sharing beyond the local link copy.
- Reminders/notifications, sounds, haptics.
- Tags, notes-per-entry, mood tracking, sub-habits.
- Times-per-week or every-N-days scheduling (weekday arrays only).
- Widgets (shown in reference screenshots but not requested).
