# Reset-to-Empty (Data panel)

**Date:** 2026-10-04 · **Status:** approved by user 2026-10-04 · **Supersedes:** nothing (amends the slice A reset behavior; builds on slice D/E surfaces)

## 1. Goal

Make **Reset data** do what it says: erase everything and end on an **empty app**
that **stays empty across reloads** — instead of today's behavior, which wipes the
database and then immediately restores the example habits **with their 13-week
fabricated history**, making a successful reset look identical to "nothing
happened" (streak 91, full heatmap, 585 completions — the exact complaint: *"after
i confirm the reset it says reset and re-seeded but it doesnt change anything at
all"*).

### Locked conversation decisions

| # | Decision |
|---|---|
| Q1-A | **Reset to empty.** Erase everything, seed nothing. Confirm: *"Erase all habits and history? This can't be undone."* / buttons **Cancel** / **Yes, erase**; success *"All data erased."*; stay on Settings. First-install demo seed (8 habits + 13-week history) **unchanged** — only the reset path stops re-seeding. |
| Appr. | Marker guard: reset must leave the seed marker **set**, otherwise boot's `seedIfEmpty()` silently re-seeds on the next reload and undoes the reset. |

### In scope

Data panel reset flow (`DataPanel`), the repo-level erase primitive it calls, the
exact copy above, the tests that pin today's re-seed contract.

### Out of scope (deferred, §8)

First-install demo history, multi-tab refresh, a "restore examples" button,
pre-erase export prompt, any route/nav/design-system change.

## 2. Current behavior (root cause of the report)

- Reset = `clearAll()` → `seedIfEmpty()` (DataPanel.tsx:47-48). `clearAll()` wipes
  habits + entries **including the `__seed__` marker row** (repo.ts:92 comment:
  *"clears it (so Reset can re-seed)"*), then `seedIfEmpty()` re-creates the demo
  dataset — `generateSeedEntries(…, weeks = 13)` with the last 8 days forced
  active so the seeded current streak reads 91 (seed.ts:63,78).
- Verified on the deployed build: reset **does** clear real mutations (completions
  586 → 585, 7/8 → 6/8, same-tab live update, no console errors). The failure is
  that the restored demo data is visually indistinguishable from a full account.
- Trap that shapes this design: boot runs `seedIfEmpty()` on every load
  (NavShell.tsx:42). Simply deleting the re-seed call from the button would give
  an empty app **until the next reload**, which would resurrect the demo data.

## 3. R1 — Reset behavior (invariants)

After the user confirms with **Yes, erase**:

- **I1 — empty.** Zero habits, zero real entries: `exportState()` returns
  `{ habits: [], entries: [] }` (the `__seed__` marker row is not user data).
- **I2 — stays empty.** The seed marker is **set** after the wipe, so
  `hasSeeded()` is `true`, boot's `seedIfEmpty()` returns `false`, and a hard
  reload / new session leaves the app empty. The demo habits never come back.
- **I3 — all-or-nothing.** The wipe and the marker write are one atomic unit. A
  failed reset leaves the database **exactly as it was**, surfaces the thrown
  message as the `role="alert"` fallback pattern (`Reset failed.`), closes the
  confirm dialog (never stranded), and never shows the success message.
- **I4 — feedback + landing.** Success shows `All data erased.` (`role="status"`)
  in the existing message slot; no navigation — the user stays on Settings.
- **I5 — destinations render their existing empty states** (no new empty-state
  copy, no crashes, strip hidden): Home `Create your first habit` (streak strip
  hidden when no habits), Habits `No habits yet — create one.`, Insights
  `No habits yet.` with true zeros, Calendar neutral month grid, Settings
  unchanged.

## 4. R2 — Copy (exact)

| Surface | Exact text |
|---|---|
| Trigger button (unchanged) | `Reset data` |
| Confirm question | `Erase all habits and history? This can't be undone.` |
| Cancel (unchanged) | `Cancel` |
| Confirm button | `Yes, erase` — keeps the semantic red fill (`bg-red-600 text-white`, slice D pin); label text = the non-color meaning |
| Success | `All data erased.` |
| Failure | thrown message as today; fallback `Reset failed.`; dialog closes |

Tone stays warm, never shaming; no color-only meaning anywhere.

## 5. R3 — Preserved behaviors

1. **First install unchanged**: a marker-less database still seeds the 8 example
   habits with their 13-week history on boot (NavShell). Option A accepted this.
2. **Empty import = fresh install** → re-seeds on next load (existing §11
   contract, repo.ts:198-203). **Non-empty import claims the marker**; delete-all
   never resurrects seed data. Both untouched.
3. Export JSON / Import JSON / trigger button / message roles / failure paths,
   degraded-storage + write-failure banners, theme, sheets — unchanged.
4. Frozen pins: A2 aria-labels, stylesheet pins in `globals.test.ts`, tap-target
   test, lint baseline (2 warnings in `src/lib/stats.test.ts`), **no new
   dependencies**, local-first (no runtime network), dark + light via existing
   tokens, `prefers-reduced-motion` untouched.

## 6. R4 — Testing requirements (TDD, full gates per commit)

Unit/component (Vitest + Testing Library):

1. **`DataPanel.test.tsx`**
   - `re-seeds after a reset` → **rewritten** to `erases everything after a
     reset`: with a habit present → confirm → `listHabits()` is `0`,
     `exportState()` empty, success text `All data erased.` asserted
     (strengthening), `hasSeeded()` `true` (the I2 guard at the panel boundary).
   - Failure test **rewritten**: button match `/yes, erase/i`; the dialog-closed
     anchor `/erase everything/i` → `/erase all habits and history/i` — with the
     old copy gone the current anchor would match nothing and pass **vacuously**
     (a loosening; forbidden).
2. **`seed.test.ts`**
   - New: `a reset leaves the app empty across reloads` — run the reset contract →
     `hasSeeded()` `true`, `seedIfEmpty()` returns `false`, `countHabits()` still
     `0` (I2 — the trap this spec exists to prevent).
   - `re-seeds a byte-identical dataset after a reset` → re-pinned: its
     "Reset = clearAll → seedIfEmpty" premise no longer models the button. Keep
     every byte-identical/determinism assertion, drop the Reset framing (it now
     pins *fresh-install* determinism via a marker-less DB). Equivalent re-pin,
     not a deletion.
3. **Existing suites stay green** (448 + new) — especially `does not re-seed once
   the user has deleted every habit`, `never resurrects after a non-empty import`,
   `treats an empty import as a fresh install`, Home/Habits/Insights empty-state
   tests, `SettingsScreen` test (Data panel present).
4. Gates per commit: `npm test` → `npm run typecheck` → `npm run lint` →
   `npm run build`. Exact staging; never `git add .`.

## 7. Verification gates

- **V1** `npm test` → all green, zero failures.
- **V2** `npm run typecheck` → 0 errors.
- **V3** `npm run lint` → baseline (2 known warnings only).
- **V4** `npm run build` → green; route table unchanged (no route changes here).
- **V5 (manual, `npm run start`)** — Settings → `Reset data` → exact confirm copy
  → `Yes, erase` → `All data erased.`; Home shows `Create your first habit` with
  the strip hidden; Habits/Calendar/Insights show their empty/zero states;
  **hard reload → still empty** (no demo resurrection); export → valid JSON
  `{habits:[],entries:[]}` → re-import round-trip; then clear site storage →
  reload → first-install seed returns (8 habits + history) proving I1/I2/I5 and
  §5.1 together.
- **V6 (a11y/tone spot-check)** — confirm dialog keyboard-reachable with visible
  focus; `Yes, erase` red fill accompanied by its text label; `role="status"`/
  `role="alert"` announced; dark **and** light; 360 px layout; tap targets ≥ 40 px.
- **V7 (regression)** — import/export, delete-all-doesn't-resurrect, completion
  flows, theme toggle, WriteErrorBanner unchanged vs pre-change behavior.

## 8. Deferred (recorded, not built)

1. Multi-tab refresh — a tab already showing Home/Insights does not auto-update
   when Reset runs in another tab (Dexie live queries are per-connection); reload
   refreshes it. Observed during this investigation; separate concern.
2. First-install demo history (the day-one full heatmap / 91-day streak) — kept
   per Option A; revisit only if asked.
3. A second action "Restore example habits" (rejected Option B).
4. Export-backup prompt before erasing.
