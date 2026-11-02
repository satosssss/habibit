# Achievement badges — design (sub-project B)

Date: 2026-10-28
Status: binding for implementation
Depends on: challenges (sub-project A) for the three challenge-win badges.

## Goal

Give Habibit a permanent, cosmetic achievement layer: badges earned once from
all-time progress, shown in Insights, and celebrated with a short non-blocking
unlock toast.

## Non-goals

- No sharing, accounts, or server (that is sub-project D).
- No rewards/unlocks (themes, card frames) — badges are cosmetic.
- No new runtime dependencies; SVG/CSS only.

## Definitions

- **Badge**: a named threshold over all-time data. Once earned it is stored and
  never removed, even if the underlying streak breaks or data is edited.
- **Eligible**: current data meets the threshold.
- **Earned**: persisted in the `badges` store with `earnedAt`.
- **All-time**: `buildDayStats(habits, entries, { from: allTimeStart(habits), to: today })`.

## R1 — Catalog (exact ids, titles, thresholds)

| id | Title | Kind | Threshold | Locked copy |
|---|---|---|---|---|
| `streak-3` | Warming Up | streak | longest streak ≥ 3 | "3-day streak" |
| `streak-7` | One Week Strong | streak | ≥ 7 | "7-day streak" |
| `streak-14` | Two Weeks Running | streak | ≥ 14 | "14-day streak" |
| `streak-30` | Thirty Days | streak | ≥ 30 | "30-day streak" |
| `streak-100` | Century | streak | ≥ 100 | "100-day streak" |
| `perfect-1` | Perfect Day | perfect | perfect days ≥ 1 | "1 perfect day" |
| `perfect-7` | Perfect Week | perfect | ≥ 7 | "7 perfect days" |
| `perfect-30` | Flawless Month | perfect | ≥ 30 | "30 perfect days" |
| `completions-1` | First Step | completions | completions ≥ 1 | "1 completion" |
| `completions-10` | Getting Going | completions | ≥ 10 | "10 completions" |
| `completions-50` | Fifty Strong | completions | ≥ 50 | "50 completions" |
| `completions-100` | Centurion | completions | ≥ 100 | "100 completions" |
| `completions-365` | Year of Habit | completions | ≥ 365 | "365 completions" |
| `challenge-streak7` | Streak Champion | challenge | a won `streak7` challenge | "Win a 7-Day Streak challenge" |
| `challenge-weekend` | Weekend Warrior | challenge | a won `weekend` challenge | "Win a Weekend Warrior challenge" |
| `challenge-category7` | Category Master | challenge | a won `category7` challenge | "Win a Category Sprint challenge" |

- Streak = day-level active-day streak (`longestStreak`), the same number the
  Insights "Longest Streak" tile shows. Do not invent per-habit semantics.
- Perfect days = `countPerfectDays`; completions = `sumCompletions` (includes
  bonus, spec §6). Never reimplement these rules.

## R2 — Pure engine (`src/lib/badges.ts`)

- Exports `BADGES`, `badgeById(id)`, `badgeSnapshot({habits, entries, challenges, today})`,
  `badgeValue(def, snapshot)`, `earnedBadgeIds(snapshot)`.
- No React, no Dexie, no I/O. Deterministic for fixed inputs.
- `badgeValue` returns a number; challenges return 1/0. `earned = value >= threshold`.
- Snapshot computes stats once (not per badge).

## R3 — Persistence

- Dexie **v3** adds `badges: 'id, earnedAt'` (additive; v1/v2 untouched).
- `EarnedBadge = { id: string; earnedAt: number }`.
- `evaluateBadges(now = Date.now())`: load habits, all-time entries, challenges;
  compute eligible ids; insert only missing ids in one read-write transaction;
  return the newly inserted rows. Idempotent; never updates or deletes.
- Unknown ids in the store are ignored by the UI (forward compatibility).

## R4 — Evaluation points

Badges are evaluated wherever challenges already are, so a completion that
earns a badge celebrates immediately:

- boot (`NavShell`)
- Home write path
- Note write path
- Timer write path
- Challenges screen mount

Errors go through `reportWriteError`. Evaluation is fire-and-forget; it must
never block or fail the write.

## R5 — Insights grid

- New "Badges" section in Insights, after "All time" tiles.
- Shows all 16 badges, earned first (by `earnedAt` desc) then locked (catalog order).
- Earned: accent ring, full opacity, earned date (short format).
- Locked: reduced emphasis, progress text from R1 locked copy + current value
  (e.g. "3 / 7-day streak").
- Status is text, never color-only. Icons are `aria-hidden`; titles are text.
- Uses existing tokens only (`--color-accent`, `--color-subtle`, glass classes).

## R6 — Unlock toast

- Non-blocking, **top-center**, `z-[60]`, pointer-events-none region with a
  pointer-events-auto card (house CompletionToast posture).
- `role="status" aria-live="polite"`, `aria-atomic="true"`; no focus movement.
- Queue: one badge at a time, 4.5 s each, dismiss button (≥44px) advances.
- Content: medallion icon + "Badge unlocked" + title.
- Motion: medallion pop + one shimmer sweep under `motion-safe:` only; static
  under reduced motion (global reduced-motion rule already zeroes durations).
- Never stack: one toast visible; queued badges follow.

## R7 — Export / import / reset

- `exportState()` adds `badges`.
- `importState()` accepts payloads with or without `badges` (old exports remain
  valid). When present, rows are validated (`id` string, `earnedAt` finite) and
  replace the store inside the same transaction; unknown ids are allowed.
- Reset (`resetToEmpty`, `resetDb`) clears `badges`.
- Import without badges clears them; boot evaluation re-earns anything the
  imported data supports (acceptable and documented).

## R8 — Accessibility and tests

- No emoji; Lucide icons with `aria-hidden`.
- Text contrast uses existing tokens; no new color pairs.
- Tests: engine thresholds/boundaries; v2→v3 migration; evaluate idempotency and
  no-un-earn; export/import (with and without badges); toast queue/dismiss/
  reduced-motion class; grid earned/locked rendering; Insights integration.
- Gates: `npm test`, `npm run lint` (0 errors, no new warnings), `npm run typecheck`,
  `npm run build`.
