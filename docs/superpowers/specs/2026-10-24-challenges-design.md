# Challenge Modes — Design Spec

Date: 2026-10-24
Scope: Sub-project A of gamification (challenge modes). Badges (B) and PNG share card (C) are separate specs/plans.

## Goal

Let the user join time-boxed challenges — a 7-day streak on one habit, a weekend app-wide intensive, or a 7-day category sprint — with persisted state, strict perfect-day semantics, and a celebratory win moment. Progress is always derived from existing entries; no dual truth.

## Concepts

Three challenge types, defined as pure code (type definitions + rules live in `src/lib/challenges.ts`; only instances persist):

| Type | Scope | Win condition | Fail condition |
|------|-------|---------------|----------------|
| `streak7` | One active habit, chosen at join | 7 consecutive perfect days on that habit, with ≥1 in-scope completion after `startedAt` | Any scheduled in-scope day before today lacks a qualifying entry |
| `weekend` | Whole app (all habits) | Both Saturday and Sunday of the target weekend are perfect app-wide | Target weekend closes (Sunday midnight) with either day imperfect |
| `category7` | One `category` value, chosen at join | 7 consecutive perfect days across habits in that category, with ≥1 in-scope completion after `startedAt` | Any scheduled in-scope day before today lacks a qualifying entry in the category |

Perfect-day semantics are strict and reuse the existing run logic conventions from `src/lib/streaks.ts` (`habitStreaks`): a missed scheduled day breaks a run; today never breaks; unscheduled days skip.

### Rule details (approved)

- **G1** (all types): challenges only *read* entries — they never write or modify entries.
- **G2**: pre-existing streaks count toward progress, but the anti-instant-win guard requires ≥1 in-scope completion after `startedAt` before `streak7`/`category7` can be won. Joining never produces an instant win.
- **G3**: unscheduled in-scope days are skipped, never failed.
- **Weekend window**: the first Saturday on/after the join date. Join Saturday → that same weekend; join Sunday → next weekend; join any other day → the upcoming Sat–Sun. One instance per weekend (a new weekend challenge for the same weekend is impossible because joining replaces same-type actives).
- **Win-before-fail ordering**: when both a win and a fail could be argued for the same evaluation, win is checked first. Terminal statuses (`won`, `failed`, `abandoned`) are never re-evaluated.
- **Immediate failure**: a break flips `active → failed` as soon as it is detectable. Time-based failures (weekend closing) persist on the next app open. Retries are unlimited — each join creates a new instance.
- **Join guards**: block joins whose scope would be empty (no active habit / no habits in the category) — no vacuous wins. One active challenge per type; at most 3 concurrent active challenges; joining a type with an active instance replaces it (the old instance becomes `abandoned`).

## Persistence (Dexie schema v2)

New `challenges` store via a `version(2)` delta only — v1 tables (`habits`, `entries`) untouched.

Record shape:

```ts
{
  id: string;              // generated at join
  type: 'streak7' | 'weekend' | 'category7';
  habitId?: string;        // streak7
  category?: string;       // category7
  scopeLabel: string;      // human-readable scope, e.g. "Oak Mornings" / "Fitness"
  status: 'active' | 'won' | 'failed' | 'abandoned';
  startedAt: number;       // epoch ms (join time)
  resultAt?: number;       // epoch ms when won/failed/abandoned
}
```

Indexes include `[type+status]` for active-by-type lookups and cap checks.

The `Challenge` type lands in `src/lib/types.ts`; pure rules in `src/lib/challenges.ts`:

- `challengeOutcome(challenge, entries, now): 'active' | 'won' | 'failed'` — pure evaluation. (`abandoned` is never produced by this function; it is set only by same-type replacement at join and by the boot orphan pass.)
- `challengeProgress(challenge, entries, now): { label, current, total }` — e.g. `{ label: 'Day 3/7', current: 3, total: 7 }`

### Lifecycle wiring

- **Evaluation points**: app boot (in the `NavShell` pass alongside `pruneOrphans`/`clampLegacyEntries`), after every entry write, and on challenges-surface loads (`/challenges`, Home strip). Time-based failures (weekend close) persist on next app open.
- **Orphan pass**: at boot, an active challenge whose habit/category no longer exists is closed as `abandoned`.

### Export / import / reset

- `exportState` gains an optional `challenges` array. Old exports (no `challenges` key) still import without error.
- `importState` restores challenges when present.
- `resetToEmpty` clears the challenges store.

## UX

### Entry & navigation

- New `/challenges` route, reachable from the MenuDrawer (alongside Settings/Export).
- Home: a compact "Active challenges" strip below the coach card, shown only when ≥1 active challenge exists. Each row shows title, live progress ("7-day streak · Day 3/7 — Oak Mornings"). Tapping a row navigates to `/challenges`.

### `/challenges` page layout (top → bottom)

1. **Active challenges** — cards with title, scope, progress count/bar, status. Max 3.
2. **Join section** — a card per joinable mode with a description and a **Join** button. Tapping Join opens the mode's scope picker before confirming.
3. **Results shelf** — won challenges (✓ + date) and failed/abandoned challenges, grouped, most recent first. Informational only.

### Scope pickers

- `streak7`: list of active habits → pick one.
- `weekend`: no picker; Join confirms directly (app-wide).
- `category7`: list of distinct categories in use → pick one.
- Pickers reuse the existing `Sheet` pattern (`role="dialog"`, `aria-modal`, focus management).

### The win moment

- On the *transition* to `won` (first evaluation after winning — never replayed for an already-won challenge on boot), a celebratory overlay appears: challenge title, ✓, scope, "Done!" beat. Dismiss button; auto-dismisses after a few seconds; immediately dismissible (button + Escape); no interaction-blocking delay.
- Mirrors the CompletionToast beat (glass card). If no confetti exists, an animated check + copy suffices — no new dependency.

### Failure surfacing

- No negative popups. A failed challenge simply moves to the results shelf with a muted ✗ + date. The Home strip and active list show only active challenges — failures never nag.

### Voice & copy

- Warm, short coach voice, consistent with existing copy (e.g. "You're on day 3 of your 7-day streak — keep it alive.").
- Scannable titles: "7-Day Streak", "Weekend Warrior", "Category Sprint".

## Visual style & constraints

- **Glass cards**: active/join cards use the existing `glass-card` + `glass-border` treatment (same as coach card / CompletionToast). No new surface styles.
- **Progress**: count/label ("Day 3/7") plus optional thin bar using existing color tokens. No new palette, no chart library.
- **Icons**: lucide-react only (`Trophy`, `Flag`, `Check`, `X`, …). No new icon dependency.
- **Results shelf**: won rows get ✓ + date; failed/abandoned rows get muted, grayscale treatment — failures never shout.

### Animation

- Entrances/animations use Tailwind `motion-safe:` variants only (e.g. `motion-safe:animate-[toast-in_200ms_ease-out]`), mirroring CompletionToast.
- The existing `globals.css` `prefers-reduced-motion: reduce` block disables animations; the win overlay must degrade to an instant static appearance under reduced motion — no new keyframes escape that guard.

### Accessibility

- **Win overlay**: `role="dialog"`, `aria-modal="true"` (final structural call — dialog vs `role="status"` announcement + dismissible panel — left to the plan author); focus moves to it and returns on close; `aria-live="polite"` win announcement.
- **Lists/strip**: real buttons/links (not clickable divs), visible focus rings, semantic headings per section.
- **Progress**: announced as text (screen-reader-friendly count), never color-only; ✓/✗ always paired with a text label ("Won", "Failed") so status is never color/shape-only.
- **Touch targets**: ≥44px for join/dismiss buttons, matching existing sizing.

### Hard constraints

- No new runtime dependencies (no confetti/canvas/animation libs). This sub-project is UI + Dexie only.
- Reuse: CompletionToast animation pattern, `Sheet` for pickers, glass-card surfaces, lucide icons.
- The win overlay is driven by the *transition* to `won` — consistent with `celebrateIfCompleted`'s "never celebrate an already-done state" rule.

## Testing strategy

### Pure logic (colocated `challenges.test.ts` — bulk of coverage)

- `challengeOutcome()` per-mode win/fail table with seeded fake entries and synthetic `now`:
  - streak7: win at 7 consecutive perfect days including ≥1 after `startedAt`; fail when a scheduled in-scope day before today lacks a qualifying entry.
  - weekend: win when both Sat+Sun of the target window are perfect; fail once Monday arrives with either missing; window math (join Sat → this weekend; join Sun → next weekend; join midweek → upcoming Sat–Sun).
  - category7: win on 7 consecutive perfect days in one category; scope re-derivation when habits/categories changed mid-challenge.
- Anti-instant-win guard: pre-existing 7-day streak at join → active, never instant win.
- Terminal statuses never re-evaluate regardless of new entries.
- `challengeProgress()`: day counts, "Day 3/7", weekend Sat/Sun partial, category day count.
- Join guards: empty scope blocked; max-3 cap; same-type active replaced (old → `abandoned`).
- Orphan pass: active challenge referencing deleted habit/category → `abandoned` at boot.

### Repo/Dexie layer (`db.test.ts` additions, fake-indexeddb)

- `version(2)` migration: v1 data survives; challenges store created; v1 tables untouched.
- CRUD + `[type+status]` index queries (active-by-type, cap check).
- Export includes `challenges`; legacy import (no `challenges` key) → no crash; import with challenges → restored; reset clears them.
- pruneOrphans / boot evaluation wiring.

### UI (component tests, testing-library)

- Join flow: picker lists correct scopes; empty scope shows blocked state; cap reached shows limit message; replacing same-type confirms.
- Active list + Home strip: live progress; hidden when none active.
- Results shelf: grouped, most recent first, status text present (not color-only).
- Win overlay: appears exactly once on transition to won (not on boot for already-won), `aria-modal`/focus behavior, dismiss works, reduced-motion static.
- A11y spot-checks: real buttons, `aria-live` announcements, focus rings.

### Out of scope for tests

- Pixel-perfect rendering (house approach: class/behavior assertions, not screenshots).
- Sub-projects B (badges) and C (PNG card).

### Verification loop (plan level)

- Each task: write test → implement → `pnpm test` green.
- Gates before finish: full suite, lint (0 errors; warn-only as established), typecheck, build, browser V-run of the `/challenges` flow (join → progress → win moment).

## Out of scope

- Animated achievement badges (sub-project B) — separate spec/plan.
- Shareable PNG card generator (sub-project C) — separate spec/plan.
- Social/multiplayer features, leaderboards, push notifications.
- Any new runtime dependency.
