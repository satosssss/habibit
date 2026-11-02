# Achievement badges — implementation plan

Spec: `docs/superpowers/specs/2026-10-28-achievement-badges-design.md`

## Task 1 — Pure engine
- Add `src/lib/badges.ts` (catalog, snapshot, value, earned ids).
- Add `src/lib/badges.test.ts`: every threshold boundary (below/at/above),
  challenge wins by type, monotonic counts, deterministic output.

## Task 2 — Schema v3
- Add `badges: 'id, earnedAt'` to `db.ts` as version 3.
- Extend `db.test.ts` with a v2→v3 migration test (existing rows preserved,
  badges store empty and writable).

## Task 3 — Repo surface
- Add `EarnedBadge` type, `listBadges`, `evaluateBadges` (transactional,
  insert-only), export/import/reset wiring.
- Extend `repo.test.ts`: idempotency, no un-earn, export contains badges,
  import with/without badges, reset clears.

## Task 4 — Unlock toast
- Add `src/lib/badgeUnlock.ts` (queue store) + `BadgeToast.tsx`.
- Add tests: queue order, auto-dismiss, dismiss advances, a11y attributes,
  motion-safe class, no focus movement.

## Task 5 — Insights grid
- Add `BadgesSection.tsx` and mount in `InsightsScreen` after All time.
- Add tests: all 16 rendered, earned vs locked text/date, order.

## Task 6 — Wiring
- Call `evaluateBadges().then(celebrateBadges)` beside `evaluateChallenges` in
  NavShell, HomeScreen, NoteScreen, TimerModal, ChallengesScreen.
- Mount `BadgeToast` in NavShell next to CompletionToast.

## Task 7 — Gates and live pass
- `npm test`, `lint`, `typecheck`, `build`.
- Browser: complete a habit to earn `completions-1` + `perfect-1` (toast queue),
  check Insights grid, reload (no replay), reduced-motion static.
