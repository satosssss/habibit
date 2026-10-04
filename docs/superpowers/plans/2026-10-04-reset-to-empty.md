# Reset-to-Empty: Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-04-reset-to-empty-design.md` (approved by user 2026-10-04)
**Method:** TDD — every task writes its tests first, watches them fail, implements, then runs the full gate suite before committing.

## Conventions (apply to every task)

- **Gates, in order:** `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
  Expected at every commit: **449** tests green (448 baseline + 1 new; rewrites don't
  change the count, 49 files), `tsc --noEmit` 0 errors, lint = baseline only
  (2 warnings in `src/lib/stats.test.ts`), build exit 0.
- **Exact staging only:** `git add <specific paths>` — NEVER `git add .`.
  Never stage `.opencode/` or `opencode.json` (they stay untracked).
- **Assertions are rewritten to the new expectation, never loosened.** Every re-pin
  is mapped below (the two vacuity traps: the `/erase everything/i` dialog anchor
  and the "after a reset" seed test name).
- **No new dependencies. No runtime network. Local-first.** Untouched by this plan:
  `seed.ts` generator + `NavShell` boot seed (first-install contract, spec §5.1),
  `importState` marker claiming, export paths, theme, routes/nav, all
  `globals.test.ts` stylesheet pins, A2 aria-labels.
- **Test idioms in this repo** (copy them, don't improvise):
  - partial mock: `vi.mock('@/lib/repo', async (importOriginal) => { const actual = …; return { ...actual, exportState: vi.fn(actual.exportState), … }; })`
  - `beforeEach(async () => { await clearAll(); })` for anything touching IndexedDB
    (`clearAll` stays as the raw marker-less wipe for tests — unchanged).
  - `waitFor` around async state; assert messages via `getByRole('status')`/`('alert')`.
- **Ledger:** record each task (test counts, gate outputs, any deviation) in
  `.superpowers/sdd/2026-10-04-reset-to-empty/progress.md` (house pattern).

## Task graph

```
1 → 2 → 3 → 4 (verification)
```

Task 2 needs Task 1's primitive. Task 3 (docs) follows the behavior. Task 4 verifies everything.

---

## Task 1 — Repo primitive `resetToEmpty()` (spec R1 I1–I3)

**Files:** `src/lib/repo.ts`, `src/lib/seed.test.ts`

### Tests first (red)

Add `resetToEmpty` to the `./repo` import in `seed.test.ts:2` — the named export
doesn't exist yet → red. Then add this test right after
`re-seeds a byte-identical dataset …` (same describe, whose `beforeEach` clears the DB):

```ts
  // Spec reset-to-empty R1 I1–I3: Reset wipes AND writes the seed marker in one
  // transaction, so the next boot's seedIfEmpty() must not resurrect demo data.
  it('a reset leaves the app empty across reloads', async () => {
    expect(await seedIfEmpty()).toBe(true);      // start from a seeded install
    await resetToEmpty();
    expect(await countHabits()).toBe(0);         // I1 — empty now
    expect(await hasSeeded()).toBe(true);        // I2 — marker written
    expect(await seedIfEmpty()).toBe(false);     // simulated reboot
    expect(await countHabits()).toBe(0);         // still empty
  });
```

**Re-pin (equivalent, not a deletion)** — `seed.test.ts:120-122`, name + comment only;
body (lines 123-136, every byte-identical assertion) stays verbatim:

```diff
-  // Task 14 review issue 5b: Reset (clearAll → seedIfEmpty) must reproduce the
-  // exact fresh-install dataset — same PRNG, ids and values (§11 determinism).
-  it('re-seeds a byte-identical dataset after a reset', async () => {
+  // Fresh-install determinism (§11): a marker-less database (clearAll is how
+  // tests simulate one) must reproduce the exact dataset — same PRNG, ids and
+  // values. The Reset button no longer re-seeds; see resetToEmpty.
+  it('re-seeds a byte-identical dataset on a marker-less database', async () => {
```

### Implementation

`src/lib/repo.ts` — new export directly after `clearAll()` (line 73):

```ts
/**
 * Reset-to-empty (reset spec R1): wipe habits + entries and write the seed
 * marker in ONE transaction, so a reload's seedIfEmpty() sees a claimed
 * database and stays empty (I2/I3 — two separate steps would let a crash in
 * between resurrect the demo data on the next boot). Mirrors importState's
 * inline marker write (same row as markSeeded, no ensureDb inside the tx).
 */
export async function resetToEmpty(): Promise<void> {
  await ensureDb();
  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.clear();
    await db.entries.clear();
    await db.entries.put(seedMarker());
  });
}
```

Also fix the now-stale comment at `repo.ts:89-93`:
`while clearAll() clears it (so Reset can re-seed)` →
`while clearAll() clears it (raw wipe that simulates a fresh database; the Reset button uses resetToEmpty, which re-claims it)`.

`clearAll`/`resetDb` themselves are unchanged (tests still rely on the marker-less wipe).

### Gates → commit

`npm test` (449 green) → typecheck → lint → build. Stage `src/lib/repo.ts` + `src/lib/seed.test.ts`.
**Commit:** `feat(reset): erase-to-empty primitive writes the seed marker in one tx (R1)`

---

## Task 2 — DataPanel reset flow + copy (spec R1 I4, R2)

**Files:** `src/components/DataPanel.tsx`, `src/components/DataPanel.test.tsx`

### Tests first (red)

`DataPanel.test.tsx`:

1. Import line 3: add `hasSeeded` and `resetToEmpty` (keep `clearAll` — the
   `beforeEach` uses it). Mock factory (lines 9-12) adds
   `resetToEmpty: vi.fn(actual.resetToEmpty)` alongside `exportState`/`clearAll`.
2. **Rewrite** `re-seeds after a reset` (lines 95-104):

```ts
  it('erases everything after a reset (spec R1/R2)', async () => {
    await putHabit(habit());
    render(<DataPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reset data/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, erase/i }));
    await waitFor(async () => {
      expect((await listHabits()).length).toBe(0);              // I1
      expect(await exportState()).toEqual({ habits: [], entries: [] });
      expect(await hasSeeded()).toBe(true);                     // I2 at the panel boundary
    });
    expect(screen.getByRole('status')).toHaveTextContent('All data erased.');  // I4 (strengthening)
    expect(screen.queryByText(/erase all habits and history/i)).not.toBeInTheDocument(); // dialog closed
  });
```

3. **Rewrite** the failure test (lines 115-122) — mock target moves from
   `clearAll` to `resetToEmpty`, button to `Yes, erase`, and the dialog-closed
   anchor **must be re-anchored** to the new copy (the old `/erase everything/i`
   would match nothing and pass vacuously = forbidden loosening):

```ts
  it('surfaces a reset failure as an alert and does not strand the confirm dialog', async () => {
    vi.mocked(resetToEmpty).mockRejectedValueOnce(new Error('Write blocked'));
    render(<DataPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reset data/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, erase/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/write blocked/i));
    expect(screen.queryByText(/erase all habits and history/i)).not.toBeInTheDocument(); // dialog closed
  });
```

Red check: no `Yes, erase` button exists yet → `getByRole` throws → red.

### Implementation

`DataPanel.tsx`:

- Line 5: `import { exportState, importState, resetToEmpty } from '@/lib/repo';` (drops `clearAll`).
- Line 6: delete `import { seedIfEmpty } from '@/lib/seed';`.
- `reset()` (lines 45-55): `await resetToEmpty();` replaces `clearAll()` +
  `seedIfEmpty()`; success text `'All data erased.'` replaces `'Reset and re-seeded.'`;
  catch path unchanged (`'Reset failed.'` fallback, dialog closes).
- Line 83 confirm copy → `Erase all habits and history? This can't be undone.`
- Line 88 button label → `Yes, erase` (keeps `bg-red-600 text-white` red fill and all classes).

No other component changes; SettingsScreen, roles, trigger button, and styles untouched.

### Gates → commit

Full gates. Stage `src/components/DataPanel.tsx` + `src/components/DataPanel.test.tsx`.
**Commit:** `feat(reset): Reset data erases to an empty app and stays empty (R1/R2)`

---

## Task 3 — Docs follow the behavior (no tests pin these; gates still run)

**Files:** `README.md`, `docs/superpowers/specs/2026-09-23-habibit-design.md`

1. `README.md:51`:
   `- **Settings** — data export/import, theme, and a reset to the seeded examples.`
   → `- **Settings** — data export/import, theme, and Reset data (erases everything back to an empty app).`
2. Master spec `2026-09-23-habibit-design.md:215-216`:
   `Reset (clears Dexie and re-seeds).` →
   `Reset (clears Dexie to empty and stays empty — amended by the 2026-10-04 reset-to-empty spec; seeded examples only appear on first install).`
3. Master spec `:240-243` — `…and cleared by Reset — so seeding happens exactly once,
   never resurrects after habits are deleted, and Reset re-seeded.` →
   `…written on first install and re-written by Reset, so seeding happens exactly once,
   never resurrects after habits are deleted, and boot never re-seeds after a Reset.`

(Historical plan docs under `docs/superpowers/plans/` are records — not edited.)

### Gates → commit

Full gates (docs don't affect them — the run is the proof). Stage the two files.
**Commit:** `docs(reset): README + master spec follow reset-to-empty`

---

## Task 4 — Verification (spec §7 V1–V7)

No new code expected; fix findings under the gates if any appear.

- **V1–V4:** full gate run — 449/449 tests (49 files), tsc 0, lint baseline
  (2 warnings), build 0; route table unchanged (`/`, `/add-habit`, `/calendar`,
  `/habits`, `/insights`, `/settings` static `○`; `/today/[date]` `ƒ`; `/today` +
  `/stats` redirects).
- **V5 (manual, `npm run build && npm run start`)** — on `/settings`:
  `Reset data` → confirm reads exactly *Erase all habits and history? This can't
  undone.* → **Cancel** does nothing; re-open → **Yes, erase** → `All data erased.`,
  still on Settings. Then all five destinations: Home `Create your first habit`
  with streak strip hidden, Habits `No habits yet — create one.`, Calendar neutral
  grid, Insights `No habits yet.` + true zeros. **Hard reload → still empty**
  (the I2 trap — demo data must NOT return). Export → valid JSON with empty
  arrays; import round-trip works. Clear site storage → reload → first-install
  seed returns (8 habits + 13-week history) proving §5.1.
- **V6 (a11y/tone)** — confirm dialog keyboard-reachable, visible focus; `Yes, erase`
  red fill paired with its text label (no color-only meaning); `role="status"` /
  `role="alert"` present; dark **and** light; 360 px layout; tap targets ≥ 40 px;
  `prefers-reduced-motion` untouched.
- **V7 (regression)** — import/export, delete-all-then-reload does not resurrect
  seed data, completion/quantity/timer flows, theme toggle, WriteErrorBanner,
  degraded-storage banner — unchanged.
- Record results in the ledger. **Commit only if fixes are needed**
  (`fix(reset): …`, exact staging); otherwise Task 4 ends with no commit.
