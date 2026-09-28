# Habibit Slice A — Functionality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing feature demonstrably work — the three-layer cap invariant first, then broken/dead code, states/errors, the exact-value modal, forms/dialogs, import hardening — with failing-test-first TDD, one commit per spec group, every gate green after every task.

**Spec:** `docs/superpowers/specs/2026-09-28-slice-a-functionality-fixes-design.md` — this plan argues from the spec; executors must read both. Copy strings in spec §8 are normative (character-exact: `Couldn't`, `—`, `…`, `{ unit}` = space + unit, omitted when empty).

**Where:** directly on `main` (spec commit `2f8e8a4` already lives there; no worktree). The eight fix commits land on top.

**Scope check:** one subsystem (the existing Habibit app), eight spec groups → one plan, eight commits. Three new source files (`src/lib/values.ts`, `src/lib/writeError.ts`, `src/components/WriteErrorBanner.tsx`) and four new test files (`src/lib/values.test.ts`, `src/components/ValueSheet.test.tsx`, `src/components/WriteErrorBanner.test.tsx`, `src/components/HabitsPanel.test.tsx`). No new dependencies.

**Architecture (the delta this plan builds):**

- **One invariant, three layers (R1).** A pure `clampedValue(habit, value)` in `src/lib/values.ts` becomes the single definition of `0 ≤ value ≤ target`. `repo.putEntry` applies it at the write boundary (every screen writes through `putEntry`), the UI disables controls at the bounds (`HabitRow` steppers, `ValueSheet max`, `TimerModal` duration), and import + a one-time boot migration (`clampLegacyEntries`) converge legacy data. The view additionally clamps defensively, so `11/8` cannot render even if a caller misbehaves.
- **One completion toggle (R2).** `toggleValue(habit, value)` in `values.ts` replaces the duplicated `boolean ? 1 : target : 0` logic in TodayScreen and the `done ? 0 : target` logic in NoteScreen.
- **One write-error channel (R3).** A tiny `useSyncExternalStore` store (`writeError.ts`) collects every failed IndexedDB write into a shared `role="alert"` banner mounted by NavShell; screens call `reportWriteError(err)` in `try/catch`.
- **Dialogs behave (R5).** `Sheet` gains focus-in/trap/restore + body scroll lock, so every consumer (HabitForm, ValueSheet, TimerModal, MenuDrawer) inherits it. HabitForm becomes a real `<form>` with validation and type-switch conversions; HabitList gains keyboard move buttons persisting through one atomic `bulkPut`.

## Global Constraints (carry-over from spec §1)

- **TDD per step:** write the test → run and watch it FAIL for the right reason → write the implementation → run and watch it PASS. Never write an implementation before its test.
- **Gates green in this order before every commit:** `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
- **One commit per spec group.** Stage the task's exact file list — never `git add .`; never stage `.opencode/` or `opencode.json`.
- **No new dependencies, no network calls, no analytics.** `TZ=America/Los_Angeles` vitest pin untouched. Local-first only; no CDNs.
- Keep the dark design language and existing code style. Sizing/visual polish is Slice D's — this plan changes behavior only (the minimal `disabled:opacity-40` affordance is the sole styling touch, and it marks state, not decoration).
- Accessibility: no color-only meaning; `role="alert"`/`role="status"` for new messages; `prefers-reduced-motion` untouched (no new animation).

## jsdom facts this plan relies on (verified by probe, 2026-09-28)

1. Clicking a `type="submit"` button **does** dispatch the form's `submit` event (jsdom 25) → Save buttons may be `type="submit"` with the save logic in `onSubmit`.
2. jsdom does **not** implement implicit submission: `keyDown(Enter)` never submits → Enter-to-save needs an explicit `onKeyDown` handler (`preventDefault()` + save, which also prevents double-save in real browsers).
3. `fireEvent.click` on a `disabled` button delivers **no** call to `onClick` → stepper tests can assert both `toBeDisabled()` and click-inertness.

## Spec coverage map

| Spec | Task | Tests (failing first) |
|---|---|---|
| §2 R1 write boundary + view clamp | 1 | `clampedValue` ×4 · putEntry clamp ×2 · HabitRow stepper bounds · floor percent · over-target display · TodayScreen quantity write path |
| §5 R4 ValueSheet | 2 | valid save · max+helper · empty · over-target · non-finite · Enter-once · error clears · no-unit helper |
| §2.2 R1 TimerModal | 3 | pill cap · steppers at both bounds · held-repeat cap · tick ceiling · unmount-repeat via dec · completion writes duration · gradient clamp |
| §7 R6 + §2.3 R1 import/migration | 4 | hostile repair · per-type target repair · structural reject ×3 · shape reject · migration ×2 · hostile import renders Today |
| §4 R3 states/banner/share | 5 | banner ×4 · NavShell seed-failure integration · loading gates ×4 · empty states ×2 · share ×3 · write-failure toggle · `putHabits` atomic · HabitsPanel (new) · StatsScreen sync→await |
| §6 R5 forms/dialogs/reorder | 6 | Enter submit · 4 validation errors · type-switch conversions · boolean target · Sheet focus/trap/restore/scroll · HabitList move ×2 · CategorySection aria-controls · HabitForm fallback rewrite |
| §3 R2 dead code/toggle/consistency | 7 | toggleValue ×2 · future-date branch removed · Link CTA · note value subtext · quantity toggle ×2 · note order sort |
| §3 R2 FlameBadge | 8 | pointer-events-none |

## Plan-level decisions not pinned by the spec (flagged for the reviewer)

1. **`toggleValue`'s predicate is `isCompleted`, not `value > 0`.** NoteScreen's checkbox must complete a partial quantity (`3/8` → click → `8/8`), which the old `value > 0` form would clear instead. TodayScreen only ever toggles boolean rows, where the two predicates are identical.
2. **Timer completion persists `min(elapsed, duration)`.** With the default duration = target this equals spec §6's "writes target"; it differs only when the user deliberately shrinks the session — R1.2.2 requires the log to reflect what was actually done (a 10-min session on a 15-min habit logs 10, stays incomplete).
3. **Timer cap is `cap = Math.max(60, habit.target)`.** Identical to spec's `[60s, target]` for every real timer habit (form/import guarantee target ≥ 60) and sane instead of `0` for corrupt legacy data.
4. **"Inert background" = `aria-modal` + Tab redirection + scroll lock.** The overlay is not portaled to `body`, so a native `inert` on the app shell would inert the sheet itself; the trap delivers the required behavior (Tab never reaches background). If a future slice portals sheets, native `inert` becomes a drop-in.
5. **Initial dialog focus is the panel itself** (`tabIndex={-1}`) — literally "focus moves into the panel" (spec R5.2). Per-sheet initial-focus targets (e.g. ValueSheet's input) are a Slice D refinement.
6. **Write banner:** auto-dismiss after **8 s** plus a manual Dismiss ("transient" unpinned). Share status auto-clears after **2.5 s**.
7. **Import reject-vs-repair:** non-string `name/category/intention/unit/id`, non-finite `target`, invalid `type`, and a frequency with no usable weekday remain **habit-level structural rejects** (`That file contains values we can't import.` — spec §7.3); empty-after-trim strings and cosmetic fields **repair** (spec §7 principle). Payload shape (non-object / `habits`/`entries` not arrays) and entry-row shape (non-string `id/habitId/date`, non-number `timestamp`) keep `That file isn't a Habibit export.` — preserving DataPanel's test-pinned half-bad-row message (spec §7.3 "behavior already test-pinned and preserved"). Entry `value` **never rejects**: non-finite/NaN/string/negative → `0`, then clamped to the repaired target (spec §7.2: "only habit-level structural failures reject the file").
8. **`putHabits` = one `db.habits.bulkPut`** — Dexie runs bulkPut in a single transaction, so no explicit wrapper (spec's "one transaction instead of N writes" satisfied).
9. **Percent display floors** (spec R1.2.2): `Math.round` → `Math.floor`, so the existing `98` assertion becomes `97`.
10. **Stats `minYear` becomes a `useMemo`** (was state + effect) — correct at the first render with habits, no out-of-range year offer, no effect race.

## Review Focus

Inputs/conditions the spec implies that no single happy-path test exercises. Each line is pinned by a test in the named task.

1. **Legacy over-target/negative/NaN rows converge once, idempotently, and the seed marker survives** → Task 4, `boot migration` tests.
2. **A hostile import must not merely import — it must render** (bad `color` used to throw inside `rgba()` during `HabitRow`) → Task 4, `renders a hostile import without crashing`.
3. **The cap holds while a hold-repeat is mid-flight** (not just at rest) → Task 3, `held-repeat` expectations after the second `advanceTimersByTime(250)`.
4. **Enter must save exactly once** (keydown handler + form submit are both wired) → Task 2, `saves on Enter once, and never double-saves`.
5. **A typed over-target value is rejected with an error, not silently clamped** (an exact-value tool must tell the user) → Task 2, `rejects a value above the target`.
6. **Focus returns to the opener on close, and Tab wraps both directions** → Task 6, Sheet focus tests.
7. **A reorder is all-or-nothing** (one bulkPut, not N puts) → Task 5, `putHabits` atomic test + HabitsPanel persistence test.
8. **The write banner's auto-dismiss window restarts on a fresh failure** → Task 5, `auto-dismisses after 8 seconds`.
9. **The Stats loading gate must not strand YearNav's minYear flow** → Task 5, existing `minYear picked up the old habit` test stays green (waitFor retries through the gate).
10. **Validation failures never close the form and never half-save** → Task 6, every validation test asserts `onSave`/`onClose` not called.
11. **Boolean save still coerces `target = 1` after a quantity→boolean round trip** → Task 6, `coerces the target to 1`.

## Known edges deferred (from spec §10 — recorded, not dropped)

- **→ Slice D:** all touch-target sizing, DateStrip/heatmap human aria labels, skeleton/banner/toast visuals, hover/press polish, glass styling, tooltip linkage, TimerModal countdown live region, NoteScreen prev/next-day navigation decision, per-sheet initial-focus refinement.
- **→ Slice C:** live-region announcements of value/streak changes as rewarding feedback (Task 6's reorder `role="status"` is keyboard-operability, not reward).
- **→ Won't fix:** pre-mount blank frame (deliberate SSR trade-off), ThemePanel's unpressed "system" state (documented intent).

## File structure

| File | Change | Task |
|---|---|---|
| `src/lib/values.ts` | **create** — `clampedValue`, later `toggleValue` | 1 · 7 |
| `src/lib/values.test.ts` | **create** | 1 · 7 |
| `src/lib/repo.ts` | `putEntry` clamp · `isHabitShape`/`repairHabit`/`repairEntry` · `clampLegacyEntries` · `putHabits` | 1 · 4 · 5 |
| `src/lib/repo.test.ts` | clamp · hostile import · migration · putHabits | 1 · 4 · 5 |
| `src/components/HabitRow.tsx` | view clamp · stepper `disabled` · `Math.floor` percent | 1 |
| `src/components/HabitRow.test.tsx` | rewrites (97, over-target, steppers) | 1 |
| `src/components/TodayScreen.test.tsx` | quantity write path · timer opens · hostile render · loading gate · write-failure banner · next/link mock | 1 · 4 · 5 |
| `src/components/ValueSheet.tsx` | full rebuild (form, validation, max, helper, error) | 2 |
| `src/components/ValueSheet.test.tsx` | **create** | 2 |
| `src/components/TimerModal.tsx` | duration cap · disabled bounds · gradient clamp · completion `min(elapsed, duration)` · write catches | 3 · 5 |
| `src/components/TimerModal.test.tsx` | 5 rewrites + 2 new | 3 |
| `src/lib/writeError.ts` | **create** — store, `reportWriteError`, `useWriteError` | 5 |
| `src/components/WriteErrorBanner.tsx` | **create** | 5 |
| `src/components/WriteErrorBanner.test.tsx` | **create** (unit + NavShell integration) | 5 |
| `src/components/NavShell.tsx` | mount banner · seed/prune/clamp catches | 5 |
| `src/components/TodayScreen.tsx` | loading gate · `setValue`/`saveHabit` catches | 5 |
| `src/components/NoteScreen.tsx` | gate · empty state · share status · write catch (5); toggleValue + subtext + order sort (7) | 5 · 7 |
| `src/components/NoteScreen.test.tsx` | gate · empty · share ×3 (5); subtext · toggle ×2 · order (7) | 5 · 7 |
| `src/components/StatsScreen.tsx` | `minYear` useMemo · loading gate | 5 |
| `src/components/StatsScreen.test.tsx` | two sync container tests → `await` | 5 |
| `src/components/HabitsPanel.tsx` | gate · empty state · catches · `putHabits` | 5 |
| `src/components/HabitsPanel.test.tsx` | **create** | 5 |
| `src/components/HabitForm.tsx` | `<form>` · validation · `switchType` conversions | 6 |
| `src/components/HabitForm.test.tsx` | validation ×5 · conversions ×2 · Enter · fallback rewrite | 6 |
| `src/components/Sheet.tsx` | focus in/trap/restore · scroll lock | 6 |
| `src/components/Sheet.test.tsx` | focus · trap · restore · scroll | 6 |
| `src/components/HabitList.tsx` | move buttons · `role="status"` announce | 6 |
| `src/components/HabitList.test.tsx` | move ×2 | 6 |
| `src/components/CategorySection.tsx` | `useId` + `aria-controls` | 6 |
| `src/components/CategorySection.test.tsx` | aria-controls wiring | 6 |

---

### Task 1: R1 — Cap invariant at the write boundary and the view

**Files:**
- Create: `src/lib/values.ts`, `src/lib/values.test.ts`
- Modify: `src/lib/repo.ts`, `src/components/HabitRow.tsx`, `src/components/TodayScreen.test.tsx`
- Test: `src/lib/repo.test.ts`, `src/components/HabitRow.test.tsx`

**Interfaces:**
- Produces: `clampedValue(habit, value): number` — non-finite → `0`, then `min(max(0, v), habit.target)`. This is the normative definition of the invariant (spec §2).
- `putEntry(habitId, date, value)` now looks the habit up: existing habit → `clampedValue`; missing habit → floor at `0` only (orphans are pruned by the existing boot pass). Return type unchanged.
- `HabitRow` renders `v = clampedValue(habit, value)` for ratio, fill, subtext, aria and done-state; steppers gain `disabled` (`+` at target, `−` at zero) with `disabled:opacity-40`; the ring's center percent uses `Math.floor`.
- Unchanged: `toggle` writes (`target` on complete — within cap by construction), `ProgressRing`, all other screens (they inherit the clamp through `putEntry`).

- [ ] **Step 1: Write the failing tests**

`src/lib/values.test.ts` (new file):

```ts
import { describe, expect, it } from 'vitest';
import type { Habit } from './types';
import { clampedValue } from './values';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Drink Water', icon: 'droplet', color: '#6366f1', category: 'Health',
  intention: 'Be Grateful', type: 'quantity', target: 8, unit: 'cups',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

describe('clampedValue (spec R1 — the cap invariant)', () => {
  it('keeps in-range values untouched', () => {
    expect(clampedValue(habit(), 0)).toBe(0);
    expect(clampedValue(habit(), 4)).toBe(4);
    expect(clampedValue(habit(), 8)).toBe(8);
  });

  it('caps at the target and floors at zero', () => {
    expect(clampedValue(habit(), 11)).toBe(8);   // never 11/8
    expect(clampedValue(habit(), -3)).toBe(0);
  });

  it('treats non-finite values as zero', () => {
    expect(clampedValue(habit(), Number.NaN)).toBe(0);
    expect(clampedValue(habit(), Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('caps boolean habits at 1', () => {
    expect(clampedValue(habit({ type: 'boolean', target: 1 }), 5)).toBe(1);
  });
});
```

Append to `src/lib/repo.test.ts` inside `describe('entries')` (existing imports cover `putEntry`, `loadDay`; add `clampLegacyEntries`/`putHabits` only when their tasks arrive):

```ts
  // Spec R1 §2.1: the write boundary is the single choke point — every screen
  // writes through putEntry, so clamping here makes the invariant global.
  it('clamps written values into [0, target]', async () => {
    const h = habit({ type: 'quantity', target: 8 });
    await putHabit(h);
    await expect(putEntry(h.id, '2026-09-20', 11)).resolves.toMatchObject({ value: 8 });
    await putEntry(h.id, '2026-09-20', -3);
    expect((await loadDay('2026-09-20'))[0].value).toBe(0);
    await putEntry(h.id, '2026-09-20', Number.NaN);
    expect((await loadDay('2026-09-20'))[0].value).toBe(0);
  });

  it('floors only the value for entries whose habit is gone (prune removes them later)', async () => {
    await putEntry('ghost-habit', '2026-09-20', 5);
    expect((await loadDay('2026-09-20'))[0].value).toBe(5);
  });
```

Rewrites in `src/components/HabitRow.test.tsx`:

1. Line 79 — the ring percent now floors: `expect(notDone).toHaveTextContent('98');` → `expect(notDone).toHaveTextContent('97'); // floors (spec R1.2.2): 44/45 = 97.78%`.
2. Replace the over-target block (lines 88–93, the old spec-§4 pin):

```tsx
  // Cap invariant (spec §1/R1 §2.4): the row never renders an over-target
  // value, even if a caller passes one — display clamps like everything else.
  it('never displays a value above the target (R1)', () => {
    const spanish = { ...qtyHabit, name: 'Learn Spanish', target: 45, unit: 'minutes' };
    const { rerender } = render(<HabitRow habit={spanish} value={44} onToggle={vi.fn()} {...base} />);
    rerender(<HabitRow habit={spanish} value={50} onToggle={vi.fn()} {...base} />);
    expect(screen.getByRole('button', {
      name: 'Set exact value for Learn Spanish, 45 of 45 minutes, completed',
    })).toBeInTheDocument();
    expect(screen.getByText('Every day, 45/45 minutes')).toBeInTheDocument();
  });
```

3. Replace `keeps the quantity steppers while done (R2)` (lines 95–100):

```tsx
  it('disables the steppers at the cap and at zero (R1)', () => {
    const spanish = { ...qtyHabit, name: 'Learn Spanish', target: 45, unit: 'minutes' };
    const onStep = vi.fn();
    const { rerender } = render(
      <HabitRow habit={spanish} value={45} onToggle={vi.fn()} {...base} onStep={onStep} />
    );
    const add = screen.getByRole('button', { name: /add one minutes/i });
    expect(add).toBeDisabled();                       // at the cap
    expect(screen.getByRole('button', { name: /remove one minutes/i })).toBeEnabled();
    fireEvent.click(add);                             // disabled → handler never runs
    expect(onStep).not.toHaveBeenCalled();
    rerender(<HabitRow habit={spanish} value={0} onToggle={vi.fn()} {...base} onStep={onStep} />);
    expect(screen.getByRole('button', { name: /remove one minutes/i })).toBeDisabled(); // at zero
    expect(screen.getByRole('button', { name: /add one minutes/i })).toBeEnabled();
  });
```

Append to `src/components/TodayScreen.test.tsx` (add `loadDay` to the existing `@/lib/repo` import):

```ts
// Spec R1: the quantity write path — step to the target, then the control stops.
it('steps up to the target and then disables the stepper (R1)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 7);
  render(<TodayScreen date={todayKey()} />);
  const add = await screen.findByRole('button', { name: /add one cups/i });
  fireEvent.click(add);
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByRole('button', { name: /add one cups/i })).toBeDisabled();
});

// Spec §9: the timer row's write path — opening the modal at the full duration.
it('opens the timer modal from a timer habit row', async () => {
  const h = habit({ name: 'Meditate', type: 'timer', target: 900 });
  await putHabit(h);
  render(<TodayScreen date={todayKey()} />);
  fireEvent.click(await screen.findByRole('button', { name: /open timer for meditate/i }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('15:00')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests — watch them fail for the right reason** (`npx vitest run src/lib/values.test.ts src/lib/repo.test.ts src/components/HabitRow.test.tsx src/components/TodayScreen.test.tsx`): missing module `values.ts`, putEntry storing `11`, ring showing `98`, steppers enabled at the cap.

- [ ] **Step 3: Implement**

`src/lib/values.ts` (new):

```ts
import type { Habit } from './types';

/**
 * The cap invariant (spec slice A §2): every value the app displays, stores,
 * or imports satisfies `0 ≤ value ≤ habit.target`. Non-finite input is 0.
 * One definition, three enforcement layers (write boundary, UI, import/boot).
 */
export function clampedValue(habit: Habit, value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(0, safe), habit.target);
}
```

`src/lib/repo.ts` — add `import { clampedValue } from './values';` and replace `putEntry`:

```ts
export async function putEntry(habitId: string, date: string, value: number): Promise<Entry> {
  await ensureDb();
  const habit = await db.habits.get(habitId);
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const entry: Entry = {
    id: `${habitId}_${date}`,
    habitId,
    date,
    value: habit ? clampedValue(habit, value) : safe,   // orphans: floor only
    timestamp: Date.now(),
  };
  await db.entries.put(entry);
  return entry;
}
```

`src/components/HabitRow.tsx`:
- `import { clampedValue } from '@/lib/values';`
- After destructure: `const v = clampedValue(habit, value);` then use `v` everywhere `value` was used: `ratio = habit.target > 0 ? v / habit.target : 0`, `done = habit.type === 'boolean' ? v > 0 : ratio >= 1`, `subtext(habit, v)`, aria `` `${v} of ${habit.target}` ``.
- Steppers: add `disabled={v <= 0}` to the Minus button and `disabled={v >= habit.target}` to the Plus button; add `disabled:opacity-40` to both button class strings.
- Ring center: `{Math.floor(ratio * 100)}`.

- [ ] **Step 4: Run the tests — watch them pass** (`npm test`).

- [ ] **Step 5: Gates** — `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`, all green.

- [ ] **Step 6: Commit** — stage `src/lib/values.ts src/lib/values.test.ts src/lib/repo.ts src/lib/repo.test.ts src/components/HabitRow.tsx src/components/HabitRow.test.tsx src/components/TodayScreen.test.tsx`
  `fix(cap): clamp every stored and displayed value to [0, target] (R1)`

---

### Task 2: R4 — ValueSheet rebuild (never close on invalid input)

**Files:**
- Modify: `src/components/ValueSheet.tsx`
- Create: `src/components/ValueSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Habit.target`, `Habit.unit`. Props unchanged (`habit, value, open, onSave, onClose`).
- Produces: validation state machine — save only when `draft` parses to a finite number in `[0, target]`; otherwise inline `role="alert"` error and the sheet **stays open**. Input gains `max={habit.target}`; persistent helper `Maximum {target}{ unit}.`; error `Enter a number from 0 to {target}{ unit}.`; Enter saves once (keydown `preventDefault` + `save`); Save is `type="submit"` inside a `<form>`.

- [ ] **Step 1: Write the failing tests** — `src/components/ValueSheet.test.tsx` (new):

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '@/lib/types';
import { ValueSheet } from './ValueSheet';

const habit: Habit = {
  id: 'q1', name: 'Drink Water', icon: 'droplet', color: '#6366f1', category: 'Health',
  intention: 'Be Grateful', type: 'quantity', target: 8, unit: 'cups',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};

const open = (over: Partial<Habit> = {}, value = 0) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<ValueSheet habit={{ ...habit, ...over }} value={value} open onSave={onSave} onClose={onClose} />);
  return { onSave, onClose };
};
const input = () => screen.getByLabelText(/amount/i);
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('ValueSheet (spec R4)', () => {
  it('saves a valid in-range value and closes', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '6' } });
    save();
    expect(onSave).toHaveBeenCalledWith(6);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('caps the input at the target and shows the maximum helper', () => {
    open();
    expect(input()).toHaveAttribute('max', '8');
    expect(screen.getByText('Maximum 8 cups.')).toBeInTheDocument();
  });

  it('rejects an empty value in place — the old Number('') === 0 wipe is gone (R4)', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '' } });
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();          // stays open, progress intact
    expect(screen.getByRole('alert'))
      .toHaveTextContent('Enter a number from 0 to 8 cups.');
  });

  it('rejects a typed value above the target with the same error (no silent clamp)', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '11' } });
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert'))
      .toHaveTextContent('Enter a number from 0 to 8 cups.');
  });

  it('rejects a non-finite value (number inputs carry exponent notation)', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '1e999' } });   // Number() → Infinity
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('saves on Enter exactly once, never double-saving', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '5' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears the error as soon as the user types again', () => {
    open({}, 3);
    fireEvent.change(input(), { target: { value: '' } });
    save();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: '4' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('omits the unit when the habit has none', () => {
    render(<ValueSheet habit={{ ...habit, unit: '' }} value={0} open
                      onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Maximum 8.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — watch it fail** (`npx vitest run src/components/ValueSheet.test.tsx`): the empty case currently saves `0` and closes; there is no helper text or alert.

- [ ] **Step 3: Implement** — replace `src/components/ValueSheet.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { Habit } from '@/lib/types';
import { Sheet } from './Sheet';

export function ValueSheet({
  habit, value, open, onSave, onClose,
}: { habit: Habit; value: number; open: boolean; onSave: (v: number) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setDraft(String(value)); setError(null); } }, [open, value]);

  // `Number('')` is 0 — the empty string is checked explicitly so an empty
  // field can never read as a legitimate zero (spec R4: no silent wipes).
  const unit = habit.unit ? ` ${habit.unit}` : '';
  const parsed = Number(draft.trim());
  const valid = draft.trim() !== '' && Number.isFinite(parsed)
    && parsed >= 0 && parsed <= habit.target;

  const save = () => {
    if (!valid) {
      setError(`Enter a number from 0 to ${habit.target}${unit}.`);
      return;                                        // stay open — never discard silently
    }
    onSave(Math.floor(parsed));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={habit.name}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="mb-1 block text-sm text-[var(--color-subtle)]">
          {habit.unit ? `Amount (${habit.unit})` : 'Amount'}
          <input
            type="number" inputMode="numeric" min={0} max={habit.target} value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            aria-invalid={error ? true : undefined}
            className="mt-1 w-full rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 text-base outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <p className="mb-3 text-xs text-[var(--color-subtle)]">{`Maximum ${habit.target}${unit}.`}</p>
        {error && <p role="alert" className="mb-3 text-xs text-red-500">{error}</p>}
        <button type="submit"
                className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-semibold text-white">
          Save
        </button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run — watch it pass** (`npx vitest run src/components/ValueSheet.test.tsx`).

- [ ] **Step 5: Gates** — `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.

- [ ] **Step 6: Commit** — stage `src/components/ValueSheet.tsx src/components/ValueSheet.test.tsx`
  `fix(value-sheet): reject empty, non-finite, and over-target input in place (R4)`

---

### Task 3: R1 — TimerModal duration cap and honest persistence

**Files:**
- Modify: `src/components/TimerModal.tsx`
- Test: `src/components/TimerModal.test.tsx`

**Interfaces:**
- Consumes: `habit.target` as the duration ceiling; `putEntry` (already clamped by Task 1).
- Produces: `cap = Math.max(60, habit.target)`; every `setDuration` goes through `clampDuration(d) = min(cap, max(60, d))`; Increase and `+5 minutes` are `disabled` at the cap, Decrease `disabled` at 60 s; `ratio = min(1, elapsed / duration)` before the conic gradient; completion persists `min(elapsed, duration)` (spec R1.2.2, decision 2); the three persistence sites gain `.catch(reportWriteError)` — **the store does not exist until Task 5, so this task only adds the cap; the catches land in Task 5 (keep the task order).**

- [ ] **Step 1: Write the failing tests** — edits to `src/components/TimerModal.test.tsx` (all fixtures: `habit.target = 900`, so the modal opens **at the cap**):

1. Replace `adds five minutes from the quick-add pill`:

```tsx
  it('caps the duration at the habit target — quick-add included (R1)', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const pill = screen.getByRole('button', { name: /\+5 minutes/i });
    expect(pill).toBeDisabled();                     // starts at the cap
    fireEvent.click(pill);
    expect(screen.getByText('15:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));
    expect(screen.getByText('14:00')).toBeInTheDocument();
    fireEvent.click(pill);                            // works below the cap…
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(pill).toBeDisabled();                     // …then stops at the target
  });
```

2. Replace `adjusts duration with ±1 minute steppers`:

```tsx
  it('steps ±1 minute, disabled at both bounds (R1)', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const inc = screen.getByRole('button', { name: /increase duration/i });
    const dec = screen.getByRole('button', { name: /decrease duration/i });
    expect(inc).toBeDisabled();                      // cap on arrival
    fireEvent.click(dec);
    expect(screen.getByText('14:00')).toBeInTheDocument();
    fireEvent.click(inc);
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(inc).toBeDisabled();
    for (let i = 0; i < 20; i++) fireEvent.click(dec);   // 14:00 → floor at 60 s
    expect(screen.getByText('01:00')).toBeInTheDocument();
    expect(dec).toBeDisabled();
  });
```

3. Replace `steps ±1 on press and repeats ±5 while held until release` (the original drove `+`, which is now disabled on arrival — drive `−` first, then `+` from below the cap, and pin the cap **mid-hold**):

```tsx
  it('steps ±1 on press and repeats ±5 while held until release, capped mid-hold', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const dec = screen.getByRole('button', { name: /decrease duration/i });
    fireEvent.pointerDown(dec);
    expect(screen.getByText('14:00')).toBeInTheDocument();          // press steps ±1
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('09:00')).toBeInTheDocument();          // held past delay → ±5
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('04:00')).toBeInTheDocument();          // repeat cadence → ±5
    fireEvent.pointerUp(dec);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('04:00')).toBeInTheDocument();          // release stops the repeat
    fireEvent.click(dec);                                           // trailing click swallowed
    expect(screen.getByText('04:00')).toBeInTheDocument();

    const inc = screen.getByRole('button', { name: /increase duration/i });
    fireEvent.pointerDown(inc);
    expect(screen.getByText('05:00')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('10:00')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('15:00')).toBeInTheDocument();          // reaches the cap…
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('15:00')).toBeInTheDocument();          // …and holds it while held
    fireEvent.pointerUp(inc);
  });
```

4. In `renders a tick per minute…` replace the final `+5 minutes → 20` assertion:

```tsx
    // Spec R1: ticks can never exceed the target's minutes (old pin: 20 > 15).
    const pill = screen.getByRole('button', { name: /\+5 minutes/i });
    expect(pill).toBeDisabled();                                  // at the cap
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));
    expect(document.querySelector('[data-tick-count]')?.getAttribute('data-tick-count')).toBe('14');
    fireEvent.click(pill);
    expect(document.querySelector('[data-tick-count]')?.getAttribute('data-tick-count')).toBe('15');
```

5. In `clears the hold-repeat timeout on unmount` change `pointerDown(increase)` → `pointerDown(screen.getByRole('button', { name: /decrease duration/i }))` (increase is disabled on arrival, so it arms no timers).

6. Append the two new tests:

```tsx
  it('logs the session duration on completion, never above the target (R1 §2.2)', async () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));  // a 14:00 session
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(14 * 60_000 + 1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    // Honest accounting (spec R1.2.2): a 14-minute session on a 15-minute
    // habit logs 840 — it does NOT claim the full target.
    expect(vi.mocked(putEntry)).toHaveBeenCalledWith('t1', '2026-09-23', 840);
  });

  it('clamps the gradient sweep to a full circle even for an over-target entry', () => {
    render(<TimerModal habit={habit} initialSeconds={1000} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const ring = document.querySelector<HTMLElement>('[style*="conic-gradient"]')!;
    expect(ring.style.background).toContain('conic-gradient');
    expect(ring.style.background).toContain('360deg');   // never 400deg
    expect(ring.style.background).not.toContain('400deg');
  });
```

- [ ] **Step 2: Run — watch it fail** (`npx vitest run src/components/TimerModal.test.tsx`): pill/steppers unbounded (20:00, 26:00, tick 20), completion writes `900` for the 14-minute session, gradient `400.00…deg`.

- [ ] **Step 3: Implement** — `src/components/TimerModal.tsx`:

- Add near the top of the component (before the `duration` state):

```ts
  // Spec R1 §2.2: the session can never run longer than the habit's target.
  // max(60, …) keeps a corrupt legacy target of 0 from collapsing the floor.
  const cap = Math.max(60, habit.target);
  const clampDuration = (d: number) => Math.min(cap, Math.max(60, d));
  const [duration, setDuration] = useState(() => clampDuration(habit.target || 600));
```

- `startRepeat` step: `setDuration((d) => clampDuration(d + dir * 300));`
- `stepper`: both sites `setDuration((d) => clampDuration(d + dir * 60));`
- `+5 minutes` pill: `onClick={() => setDuration((d) => clampDuration(d + 300))}`.
- Increase button: add `disabled={duration >= cap}` (and `disabled:opacity-40` to its classes); Decrease button: `disabled={duration <= 60}` + same class; pill: `disabled={duration >= cap}` + same class.
- Completion effect: `void putEntry(habit.id, date, Math.min(elapsed, duration));`
- Gradient: `const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;`
- Tick depletion and `remaining` already derive from `duration`/`elapsed` — unchanged.

- [ ] **Step 4: Run — watch it pass** (`npx vitest run src/components/TimerModal.test.tsx`).

- [ ] **Step 5: Gates** — `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.

- [ ] **Step 6: Commit** — stage `src/components/TimerModal.tsx src/components/TimerModal.test.tsx`
  `fix(timer): cap the session duration at the target and log the session (R1)`

---

### Task 4: R1 §2.3 + R6 — Import hardening and the boot clamp migration

**Files:**
- Modify: `src/lib/repo.ts`
- Test: `src/lib/repo.test.ts`, `src/components/TodayScreen.test.tsx`

**Interfaces:**
- Produces:
  - `clampLegacyEntries(): Promise<number>` — one boot pass rewriting stored values outside `[0, target]` (skips the `__seed__` marker; floors orphans); idempotent. **NavShell mounts it in Task 5.**
  - Import pipeline: payload shape (object + `habits`/`entries` arrays) and entry-row shape (`id/habitId/date` strings, `timestamp` number — `value` deliberately excluded) → `That file isn't a Habibit export.`; habit-level structure (`isHabitShape`) or a frequency with no usable weekday → `That file contains values we can't import.` (decision 7); everything else repairs (color/icon/trim-empty strings/frequency filter/target coercion per type; entry `value` → `0` when non-finite, then clamped). Repairs happen before the write transaction; payload still validated fully first (no half-applies — existing property preserved).
- Consumes: `clampedValue` (Task 1), `ICON_CHOICES` from `src/lib/icons.ts`, `HABIT_COLORS` fallback `#6366f1`, default icon `'target'` (matches `blankHabit`).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/repo.test.ts` (add `clampLegacyEntries` to the import list):

```ts
describe('import repair and rejection (spec R6)', () => {
  const rawHabit = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'x1', name: 'Drink Water', icon: 'droplet', color: '#6366f1', category: 'Health',
    intention: 'Be Grateful', type: 'quantity', target: 8, unit: 'cups',
    frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
  });
  const rawEntry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: `x1_2026-09-20`, habitId: 'x1', date: '2026-09-20', value: 4, timestamp: 0, ...over,
  });

  it('repairs cosmetic damage and clamps entries to the repaired target', async () => {
    await importState({
      habits: [rawHabit({
        name: '', icon: 'nope', color: 'red', category: '', intention: '',
        target: -5, frequency: [1, 9, 1, 'x'],
      })],
      entries: [
        rawEntry({ value: 99 }),                                            // over repaired target (1)
        rawEntry({ id: 'x1_2026-09-21', date: '2026-09-21', value: -3 }),
        rawEntry({ id: 'x1_2026-09-22', date: '2026-09-22', value: Number.NaN }),
        rawEntry({ id: 'x1_2026-09-23', date: '2026-09-23', value: Number.POSITIVE_INFINITY }),
        rawEntry({ id: 'x1_2026-09-24', date: '2026-09-24', value: '4' }), // non-number value → 0, never rejects (R6.2)
      ],
    });
    const [h] = await listHabits();
    expect(h).toMatchObject({
      name: 'Untitled habit', icon: 'target', color: '#6366f1',
      category: 'Other', intention: 'Other', target: 1,
    });
    expect(h.frequency).toEqual([1]);                      // ints 0–6, deduped, sorted
    expect((await loadDay('2026-09-20'))[0].value).toBe(1); // 99 → 1
    expect((await loadDay('2026-09-21'))[0].value).toBe(0);
    expect((await loadDay('2026-09-22'))[0].value).toBe(0);
    expect((await loadDay('2026-09-23'))[0].value).toBe(0);
    expect((await loadDay('2026-09-24'))[0].value).toBe(0); // '4' → 0
  });

  it('repairs targets per type (boolean → 1, quantity ≥ 1, timer ≥ 60)', async () => {
    await importState({
      habits: [
        rawHabit({ id: 'b', type: 'boolean', target: 99 }),
        rawHabit({ id: 'q', type: 'quantity', target: 0 }),
        rawHabit({ id: 't', type: 'timer', target: 5 }),
      ],
      entries: [],
    });
    const byId = Object.fromEntries((await listHabits()).map((h) => [h.id, h.target]));
    expect(byId).toEqual({ b: 1, q: 1, t: 60 });
  });

  it('rejects structurally unusable files without touching existing data', async () => {
    await putHabit(habit());
    const values = /values we can't import/;             // spec §8 copy (toThrow substring match)
    await expect(importState({ habits: [rawHabit({ frequency: [] })], entries: [] })).rejects.toThrow(values);
    await expect(importState({ habits: [rawHabit({ target: '8' })], entries: [] })).rejects.toThrow(values);
    await expect(importState({ habits: [rawHabit({ id: 42 })], entries: [] })).rejects.toThrow(values);
    expect(await listHabits()).toHaveLength(1);
  });

  it('keeps the original message for shape-broken payloads and rows', async () => {
    await expect(importState({ habits: 'nope', entries: [] })).rejects.toThrow(/Habibit export/);
    await expect(importState(null)).rejects.toThrow(/Habibit export/);
    // entry-row shape — DataPanel's pinned half-bad payload (habitId not a string)
    await expect(importState({
      habits: [rawHabit()],
      entries: [rawEntry({ habitId: 42 })],
    })).rejects.toThrow(/Habibit export/);
  });
});

describe('boot migration clampLegacyEntries (spec R1 §2.3)', () => {
  it('rewrites over-target, negative, and non-finite stored values once', async () => {
    const h = habit({ type: 'quantity', target: 8 });
    await putHabit(h);
    await db.entries.put({ id: `${h.id}_2026-09-20`, habitId: h.id, date: '2026-09-20', value: 11, timestamp: 0 });
    await db.entries.put({ id: `${h.id}_2026-09-21`, habitId: h.id, date: '2026-09-21', value: -4, timestamp: 0 });
    await db.entries.put({ id: `${h.id}_2026-09-22`, habitId: h.id, date: '2026-09-22', value: Number.NaN, timestamp: 0 });
    expect(await clampLegacyEntries()).toBe(3);
    expect((await loadDay('2026-09-20'))[0].value).toBe(8);
    expect((await loadDay('2026-09-21'))[0].value).toBe(0);
    expect((await loadDay('2026-09-22'))[0].value).toBe(0);
    expect(await clampLegacyEntries()).toBe(0);            // idempotent
  });

  it('never touches the seed marker or orphan entries', async () => {
    await markSeeded();
    await putEntry('ghost-habit', '2026-09-20', 5);
    expect(await clampLegacyEntries()).toBe(0);
    expect((await loadDay('2026-09-20'))[0].value).toBe(5);
    expect(await hasSeeded()).toBe(true);
  });
});
```

Append to `src/components/TodayScreen.test.tsx` — spec R6 requires hostile data to **render**, not merely import (bad `color` used to throw inside `rgba()` at `HabitRow`):

```ts
// Spec R6: a hostile export imports AND renders — no error boundary, no throw.
it('renders a hostile import without crashing (R6)', async () => {
  const { importState } = await import('@/lib/repo');
  await importState({
    habits: [{
      id: 'x1', name: '', icon: 'nope', color: 'red', category: '', intention: '',
      type: 'quantity', target: 11, unit: 'cups', frequency: [0, 1, 2, 3, 4, 5, 6, 9], order: 0, createdAt: 0,
    }],
    entries: [{ id: 'x1_2026-09-22', habitId: 'x1', date: todayKey(), value: 99, timestamp: 0 }],
  });
  render(<TodayScreen date={todayKey()} />);
  expect(await screen.findByText('Untitled habit')).toBeInTheDocument();      // repaired name
  expect(await screen.findByText('Every day, 11/11 cups')).toBeInTheDocument(); // target 11 survives, value 99 → clamped 11
});
```

- [ ] **Step 2: Run — watch it fail** (`npx vitest run src/lib/repo.test.ts src/components/TodayScreen.test.tsx`): repairs don't exist (habits stored raw, `red` stored), migration export missing, hostile render throws `Invalid color: red`.

- [ ] **Step 3: Implement** — `src/lib/repo.ts`:

- Add imports: `import { clampedValue } from './values';` and `import { ICON_CHOICES } from './icons';`
- Replace `isHabit`/`isEntry` with shape checks + repairs:

```ts
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const VALUES_MESSAGE = "That file contains values we can't import.";

/** Fields a payload must carry at all — anything else is a structural reject (R6). */
function isHabitShape(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const h = x as Record<string, unknown>;
  return (
    typeof h.id === 'string' && typeof h.name === 'string' &&
    typeof h.category === 'string' && typeof h.intention === 'string' &&
    (h.type === 'boolean' || h.type === 'quantity' || h.type === 'timer') &&
    typeof h.target === 'number' && Number.isFinite(h.target) &&
    typeof h.unit === 'string' && Array.isArray(h.frequency) &&
    typeof h.order === 'number' && typeof h.createdAt === 'number'
  );
}

function isEntryShape(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  // `value` is deliberately absent: R6.2 repairs it (finite ≥ 0 → clamp, else 0),
  // never rejects — only habit-level structural failures reject the file.
  return (
    typeof e.id === 'string' && typeof e.habitId === 'string' &&
    typeof e.date === 'string' && typeof e.timestamp === 'number'
  );
}

const isWeekday = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6;

/** Repair what is unambiguous; null = structurally unusable → reject the file. */
function repairHabit(x: Record<string, unknown>): Habit | null {
  const frequency = [...new Set((x.frequency as unknown[]).filter(isWeekday))]
    .sort((a, b) => a - b);
  if (frequency.length === 0) return null;               // no usable weekday
  const type = x.type as Habit['type'];
  const target =
    type === 'boolean' ? 1
    : type === 'timer' ? Math.max(60, Math.round(x.target as number))
    : Math.max(1, Math.round(x.target as number));
  return {
    id: x.id as string,
    name: (x.name as string).trim() || 'Untitled habit',
    icon: typeof x.icon === 'string' && (ICON_CHOICES as string[]).includes(x.icon) ? x.icon : 'target',
    color: typeof x.color === 'string' && HEX_COLOR.test(x.color) ? x.color : '#6366f1',
    category: (x.category as string).trim() || 'Other',
    intention: (x.intention as string).trim() || 'Other',
    type,
    target,
    unit: x.unit as string,
    frequency,
    order: x.order as number,
    createdAt: x.createdAt as number,
  };
}
```

- Replace `importState`'s validation half (the write transaction stays byte-identical):

```ts
export async function importState(data: unknown): Promise<void> {
  const payload = data as { habits?: unknown; entries?: unknown } | null;
  if (!payload || !Array.isArray(payload.habits) || !Array.isArray(payload.entries)) {
    throw new Error("That file isn't a Habibit export.");                     // payload shape
  }
  if (!payload.habits.every(isHabitShape)) throw new Error(VALUES_MESSAGE);   // habit-level (decision 7)
  if (!payload.entries.every(isEntryShape)) {
    throw new Error("That file isn't a Habibit export.");                     // entry-row shape (half-bad pin)
  }
  await ensureDb();

  const habits = (payload.habits as Record<string, unknown>[]).map(repairHabit);
  if (habits.some((h) => h === null)) throw new Error(VALUES_MESSAGE);
  const byId = new Map((habits as Habit[]).map((h) => [h.id, h]));
  const entries = (payload.entries as Entry[]).map((e) => {
    const habit = byId.get(e.habitId);
    const safe = Number.isFinite(e.value) ? Math.max(0, e.value) : 0;
    return { ...e, value: habit ? clampedValue(habit, safe) : safe };
  });

  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.clear();
    await db.entries.clear();
    await db.habits.bulkPut(habits as Habit[]);
    await db.entries.bulkPut(entries);
    // §11: the clear above also wiped the `__seed__` marker, so a non-empty
    // payload must claim it here — otherwise import → delete-all → reload
    // would resurrect the seed data. (Existing comment/behavior preserved.)
    if ((habits as Habit[]).length > 0) await db.entries.put(seedMarker());
  });
}
```

- Append the migration:

```ts
/**
 * One-time boot pass (spec R1 §2.3): rewrite any stored value outside
 * [0, target] left behind by pre-cap versions or old exports. The `__seed__`
 * marker is not a real entry and is skipped; orphan entries only floor at 0
 * (pruneOrphans removes them). Returns how many rows were fixed; idempotent.
 */
export async function clampLegacyEntries(): Promise<number> {
  await ensureDb();
  const habits = await db.habits.toArray();
  const byId = new Map(habits.map((h) => [h.id, h]));
  const updates: Entry[] = [];
  for (const e of await db.entries.toArray()) {
    if (e.id === SEED_FLAG_ID) continue;
    const habit = byId.get(e.habitId);
    const next = habit
      ? clampedValue(habit, e.value)
      : (Number.isFinite(e.value) ? Math.max(0, e.value) : 0);
    if (next !== e.value) updates.push({ ...e, value: next });
  }
  if (updates.length) await db.entries.bulkPut(updates);
  return updates.length;
}
```

- [ ] **Step 4: Run — watch it pass** (`npx vitest run src/lib/repo.test.ts src/components/TodayScreen.test.tsx`).

- [ ] **Step 5: Watch for knock-ons** — `DataPanel.test.tsx`'s `half-bad.json` payload and the exact-round-trip test must stay green (repairs are identity for clean data; shape failures keep the old message). If a DataPanel fixture is *cosmetically* bad it now repairs instead of rejecting — fix the test's expectation only if its comment pinned rejection of a merely-cosmetic payload, and note it in the commit body.

- [ ] **Step 6: Gates** — `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.

- [ ] **Step 7: Commit** — stage `src/lib/repo.ts src/lib/repo.test.ts src/components/TodayScreen.test.tsx`
  `fix(import): repair hostile exports, reject unusable ones, add boot clamp (R1/R6)`

---

### Task 5: R3 — Loading/empty gates, the shared write-failure banner, share status

**Files:**
- Create: `src/lib/writeError.ts`, `src/components/WriteErrorBanner.tsx`, `src/components/WriteErrorBanner.test.tsx`, `src/components/HabitsPanel.test.tsx`
- Modify: `src/lib/repo.ts` (`putHabits`), `src/components/NavShell.tsx`, `src/components/TodayScreen.tsx`, `src/components/NoteScreen.tsx`, `src/components/StatsScreen.tsx`, `src/components/HabitsPanel.tsx`, `src/components/TimerModal.tsx`
- Test: `src/lib/repo.test.ts`, `src/components/TodayScreen.test.tsx`, `src/components/NoteScreen.test.tsx`, `src/components/StatsScreen.test.tsx`

**Interfaces:**
- Produces:
  - `writeError.ts`: `WRITE_FAILURE` = `"Couldn't save that change — your browser storage may be full."` (character-exact), `reportWriteError(err?)` (logs `[habibit] write failed` when given an error, sets message, restarts the 8 s auto-dismiss), `dismissWriteError()`, `useWriteError()` via `useSyncExternalStore` (server snapshot `null`).
  - `WriteErrorBanner`: `role="alert"`, `data-testid="write-error"`, Dismiss button; rendered by NavShell above `children`.
  - Loading gates: first paint shows `Loading…`, never fake zeros/empty — Today grid (`habits || entries` undefined), Note checklist (`habits || entries` undefined), Stats whole body (`habits || entries || allEntries` undefined), HabitsPanel list (`habits` undefined). Header/DateStrip/YearNav-outside stay as-is (Stats gates YearNav too — see implementation).
  - Empty states: HabitsPanel `No habits yet — create one.`; NoteScreen `Nothing scheduled this day.`
  - Share: `Link copied` / `Couldn't copy the link` in a `role="status" aria-live="polite"` line, auto-clear 2.5 s; native-share path shows no status (the OS sheet is its own feedback).
  - Every IDB write outside DataPanel gains a catch → `reportWriteError` (TodayScreen `setValue`/`saveHabit`, NoteScreen toggle, HabitsPanel save/delete/reorder, TimerModal's three sites, NavShell seed/prune/clamp).
  - `putHabits(habits)`: one `bulkPut` (decision 8); HabitsPanel reorder uses it.
- Consumes: Task 4's `clampLegacyEntries` (mounted here).

- [ ] **Step 1: Write the failing tests**

`src/components/WriteErrorBanner.test.tsx` (new file — the module mocks at the top also power the NavShell integration test):

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WriteErrorBanner } from './WriteErrorBanner';
import { reportWriteError, dismissWriteError } from '@/lib/writeError';

vi.mock('@/lib/seed', () => ({ seedIfEmpty: vi.fn(() => Promise.reject(new Error('seed failed'))) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

afterEach(() => {
  dismissWriteError();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WriteErrorBanner (spec R3.3)', () => {
  it('is absent until a write fails', () => {
    render(<WriteErrorBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces the exact failure copy and dismisses', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<WriteErrorBanner />);
    act(() => { reportWriteError(new Error('quota exceeded')); });
    expect(screen.getByRole('alert'))
      .toHaveTextContent("Couldn't save that change — your browser storage may be full.");
    expect(spy).toHaveBeenCalledWith('[habibit] write failed', expect.any(Error));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('auto-dismisses after 8 seconds; a fresh failure restarts the window', () => {
    vi.useFakeTimers();
    render(<WriteErrorBanner />);
    act(() => { reportWriteError(); });
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => { reportWriteError(); });               // restarts
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.getByRole('alert')).toBeInTheDocument();   // 14s total, 7s since second
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders inside NavShell when the boot seed write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { NavShell } = await import('./NavShell');
    render(<NavShell><main>content</main></NavShell>);
    expect(await screen.findByTestId('write-error'))
      .toHaveTextContent(/couldn't save that change/i);
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
```

Append to `src/lib/repo.test.ts` (add `putHabits` to imports):

```ts
  it('writes a whole reorder as one bulk put (R3 — all or nothing)', async () => {
    const a = habit({ id: 'a', order: 0 });
    const b = habit({ id: 'b', order: 1 });
    await putHabit(a);
    await putHabit(b);
    const spy = vi.spyOn(db.habits, 'bulkPut');
    await putHabits([{ ...a, order: 1 }, { ...b, order: 0 }]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await listHabits()).find((h) => h.id === 'a')?.order).toBe(1);
  });
```

`src/components/HabitsPanel.test.tsx` (new file — the audit found zero coverage for this panel):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listHabits, newId, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { HabitsPanel } from './HabitsPanel';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); });

describe('HabitsPanel (spec R3)', () => {
  it('shows Loading… on first paint — never an empty list mid-load', () => {
    render(<HabitsPanel />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByTestId(/^habit-row-/)).not.toBeInTheDocument();
  });

  it('shows the empty state once loaded with no habits', async () => {
    render(<HabitsPanel />);
    expect(await screen.findByText('No habits yet — create one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new habit/i })).toBeInTheDocument();
  });

  it('persists a keyboard reorder across the whole list', async () => {
    await putHabit(habit({ id: 'a', name: 'Meditate', order: 0 }));
    await putHabit(habit({ id: 'b', name: 'Read', order: 1 }));
    render(<HabitsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Move Read up' }));
    await waitFor(async () => {
      const list = await listHabits();
      expect(list.find((h) => h.id === 'b')?.order).toBe(0);
      expect(list.find((h) => h.id === 'a')?.order).toBe(1);
    });
  });
});
```

> Note: both habits share the fixture's default `category: 'Morning'` — keyboard move reorders within a category only, so `Move Read up` reorders the `Morning` bucket.

New tests in `src/components/TodayScreen.test.tsx` (add `vi.mock('next/link', ...)` mirroring NavShell.test, and `NavShell` via dynamic import inside the failure test):

```ts
// Spec R3.1: first paint gates on BOTH queries — no flash of 0/8.
it('shows Loading… until habits and entries both resolve (R3)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 0);
  render(<TodayScreen date={todayKey()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  expect(screen.queryByText(/0\/8/)).not.toBeInTheDocument();
  expect(await screen.findByText('Every day, 0/8 cups')).toBeInTheDocument();
});

// Spec R3.3: a failed write surfaces on the shared banner (mounted by NavShell).
it('surfaces a failed toggle write on the shared banner (R3)', async () => {
  const h = habit({ name: 'Take a Cold Shower' });
  await putHabit(h);
  const repo = await import('@/lib/repo');
  vi.spyOn(repo, 'putEntry').mockImplementationOnce(
    () => Promise.reject(new Error('quota exceeded')),
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { NavShell } = await import('./NavShell');
  render(<NavShell><TodayScreen date={todayKey()} /></NavShell>);
  const button = await screen.findByRole('button', { name: /mark take a cold shower done/i });
  button.click();
  expect(await screen.findByTestId('write-error'))
    .toHaveTextContent(/couldn't save that change/i);
  vi.restoreAllMocks();
});
```

New tests in `src/components/NoteScreen.test.tsx` (add `fireEvent`, `afterEach` to imports):

```ts
  it('shows Loading… on first paint, not an empty checklist (R3)', () => {
    render(<NoteScreen date="2026-05-24" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('says nothing is scheduled when the day has no habits (R3)', async () => {
    render(<NoteScreen date="2026-05-24" />);
    expect(await screen.findByText('Nothing scheduled this day.')).toBeInTheDocument();
  });

  describe('share status (R3.4)', () => {
    const setClipboard = (value: unknown) =>
      Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
    afterEach(() => { setClipboard(undefined); vi.restoreAllMocks(); });

    it('reports a copied link', async () => {
      setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
      render(<NoteScreen date="2026-05-24" />);
      fireEvent.click(await screen.findByRole('button', { name: /share this day/i }));
      expect(await screen.findByText('Link copied')).toBeInTheDocument();
    });

    it('reports failure when the clipboard write rejects', async () => {
      setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
      render(<NoteScreen date="2026-05-24" />);
      fireEvent.click(await screen.findByRole('button', { name: /share this day/i }));
      expect(await screen.findByText("Couldn't copy the link")).toBeInTheDocument();
    });

    it('reports failure when no clipboard exists at all', async () => {
      setClipboard(undefined);
      render(<NoteScreen date="2026-05-24" />);
      fireEvent.click(await screen.findByRole('button', { name: /share this day/i }));
      expect(await screen.findByText("Couldn't copy the link")).toBeInTheDocument();
    });
  });
```

StatsScreen test rewrites (the gate removes first-paint DOM, these two queried synchronously):

1. `lays the intention bars beside the heatmap…` — after `render`, insert `await screen.findByText('By intention');` before the `container.querySelector` line.
2. `stacks tiles one-across on mobile…` — after `render`, insert `await screen.findByText('Active Days');` before `querySelectorAll`.
   (Everything else in the file already awaits `findBy`/`waitFor`; the `minYear picked up the old habit` test retries through the gate — leave it.)

New gate test in `src/components/StatsScreen.test.tsx` (4th loading gate — coverage map "loading gates ×4"):

```ts
  it('shows Loading… on first paint — never 0 tiles or a false "No habits yet." (R3)', async () => {
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Active Days')).not.toBeInTheDocument();
    expect(screen.queryByText('No habits yet.')).not.toBeInTheDocument();
    expect(await screen.findByText('Active Days')).toBeInTheDocument(); // empty DB resolves → true zeros
  });
```

- [ ] **Step 2: Run — watch them fail** (`npx vitest run src/components/WriteErrorBanner.test.tsx src/components/HabitsPanel.test.tsx src/components/TodayScreen.test.tsx src/components/NoteScreen.test.tsx src/components/StatsScreen.test.tsx`): missing modules, no Loading gates, no share status, Stats sync queries run before data (the two rewrites fail until the gate exists — that is the right failure), `putHabits` missing.

- [ ] **Step 3: Implement — store and banner first**

`src/lib/writeError.ts` (new):

```ts
'use client';

import { useSyncExternalStore } from 'react';

export const WRITE_FAILURE = "Couldn't save that change — your browser storage may be full.";
const AUTO_DISMISS_MS = 8000;

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Route any failed IndexedDB write to the shared banner (spec R3.3). */
export function reportWriteError(err?: unknown): void {
  if (err !== undefined) console.error('[habibit] write failed', err);
  message = WRITE_FAILURE;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { message = null; timer = null; emit(); }, AUTO_DISMISS_MS);
  emit();
}

export function dismissWriteError(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  message = null;
  emit();
}

export function useWriteError(): string | null {
  return useSyncExternalStore(subscribe, () => message, () => null);
}
```

`src/components/WriteErrorBanner.tsx` (new):

```tsx
'use client';

import { X } from 'lucide-react';
import { dismissWriteError, useWriteError } from '@/lib/writeError';

export function WriteErrorBanner() {
  const message = useWriteError();
  if (!message) return null;
  return (
    <p role="alert" data-testid="write-error"
       className="m-3 flex items-start justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <span>{message}</span>
      <button type="button" aria-label="Dismiss" onClick={dismissWriteError}
              className="shrink-0 rounded-full p-1 opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </p>
  );
}
```

- [ ] **Step 4: Implement — NavShell wiring** (`src/components/NavShell.tsx`):

- Imports: add `clampLegacyEntries` to the `@/lib/repo` import; `import { reportWriteError } from '@/lib/writeError';` and `import { WriteErrorBanner } from './WriteErrorBanner';`.
- Effect:

```ts
  useEffect(() => {
    void seedIfEmpty().catch(reportWriteError);   // idempotent: returns immediately once habits exist
    void ensureDb().then((s) => {
      setDegraded(s === 'degraded');
      void pruneOrphans().catch(reportWriteError);   // stray entries never reach stats
      void clampLegacyEntries().catch(reportWriteError);   // spec R1 §2.3 boot migration
    }).catch(reportWriteError);
  }, []);
```

- Render `<WriteErrorBanner />` as the first child of the content wrapper, above the `degraded` banner.

- [ ] **Step 5: Implement — gates and catches in the screens**

- `TodayScreen.tsx`:
  - Loading condition: `) : habits === undefined || entries === undefined ? (`.
  - `setValue`:

```ts
  const setValue = useCallback(async (habit: Habit, value: number) => {
    try { await putEntry(habit.id, date, value); }   // putEntry owns the clamp (R1)
    catch (err) { reportWriteError(err); }
  }, [date]);
```

  - `saveHabit`: `try { await putHabit(habit); setCreating(null); } catch (err) { reportWriteError(err); }` (stays open on failure — never strand half a save).
  - Import `reportWriteError`.
- `NoteScreen.tsx`:
  - Checklist block becomes `{habits === undefined || entries === undefined ? <Loading/> : groups.length === 0 ? <p …>Nothing scheduled this day.</p> : (groups.map(...))}` (keep the existing Loading paragraph styling used by TodayScreen).
  - Checkbox `onChange`: `() => { void putEntry(habit.id, date, done ? 0 : (habit.type === 'boolean' ? 1 : habit.target)).catch(reportWriteError); }` (Task 7 swaps in `toggleValue`).
  - Share: replace the function with:

```ts
  const [shareMsg, setShareMsg] = useState<'copied' | 'failed' | null>(null);
  const share = async () => {
    const url = `${window.location.origin}/today/${date}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Habibit', url }); return; } catch { /* dismissed — no status */ }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setShareMsg('copied');
    } catch {
      setShareMsg('failed');
    }
    window.setTimeout(() => setShareMsg(null), 2500);
  };
```

  and under the header render `<p role="status" aria-live="polite" className="min-h-4 text-xs text-[var(--color-subtle)]">{shareMsg === 'copied' ? 'Link copied' : shareMsg === 'failed' ? "Couldn't copy the link" : ''}</p>` (add `useState` to the react import).
- `StatsScreen.tsx`:
  - Replace `minYear` state + effect with:

```ts
  const minYear = useMemo(
    // Empty/loading keeps the old `maxYear - 1` default: allTimeStart([]) is
    // '2000-01-01', which would offer year 2000 with no habits (out-of-range).
    () => (habits?.length ? Math.min(Number(allTimeStart(habits).slice(0, 4)), maxYear) : maxYear - 1),
    [habits, maxYear],
  );
```

    remove the `useEffect` and its import if now unused (decision 10).
  - After the last hook (`intentions` memo), gate the return:

```tsx
  if (habits === undefined || entries === undefined || allEntries === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-10">
        <p className="p-6 text-center text-sm text-[var(--color-subtle)]">Loading…</p>
      </div>
    );
  }
```

  - Replace `habits ?? []`/`entries ?? []` in the JSX body with `habits`/`entries` (they are defined past the gate) — or leave the `?? []` harmless if TS prefers; whichever compiles cleanest.
- `HabitsPanel.tsx`: gate the list (`habits === undefined ? Loading… : habits.length === 0 ? <p …>No habits yet — create one.</p> : <HabitList habits={habits} … />`); catches on `save` (`try/catch`, keep `setEditing(null)` only on success), `deleteHabit(id).catch(reportWriteError)`, reorder `putHabits(next).catch(reportWriteError)` (import `putHabits`).
- `TimerModal.tsx`: append `.catch(reportWriteError)` to all three `putEntry` sites (completion effect, `close`, unmount cleanup).

- [ ] **Step 6: Implement — `putHabits`** in `src/lib/repo.ts`:

```ts
/** Bulk write — Dexie's bulkPut runs in one transaction, so a reorder is atomic (R3). */
export async function putHabits(habits: Habit[]): Promise<void> {
  await ensureDb();
  await db.habits.bulkPut(habits);
}
```

- [ ] **Step 7: Run — watch it pass** (per-file runs, then full `npm test`).

- [ ] **Step 8: Knock-on check** — TodayScreen SSR test still asserts `Loading` (true at first paint ✓); NoteScreen's heatmap/quote render outside the gate (unchanged ✓); DataPanel untouched ✓.

- [ ] **Step 9: Gates** — `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.

- [ ] **Step 10: Commit** — stage `src/lib/writeError.ts src/lib/repo.ts src/lib/repo.test.ts src/components/WriteErrorBanner.tsx src/components/WriteErrorBanner.test.tsx src/components/NavShell.tsx src/components/TodayScreen.tsx src/components/TodayScreen.test.tsx src/components/NoteScreen.tsx src/components/NoteScreen.test.tsx src/components/StatsScreen.tsx src/components/StatsScreen.test.tsx src/components/HabitsPanel.tsx src/components/HabitsPanel.test.tsx src/components/TimerModal.tsx`
  `fix(states): loading/empty gates, shared write-failure banner, share status (R3)`

---

### Task 6: R5 — HabitForm validation, dialog focus management, keyboard reorder

**Files:**
- Modify: `src/components/HabitForm.tsx`, `src/components/Sheet.tsx`, `src/components/HabitList.tsx`, `src/components/CategorySection.tsx`
- Test: `src/components/HabitForm.test.tsx`, `src/components/Sheet.test.tsx`, `src/components/HabitList.test.tsx`, `src/components/CategorySection.test.tsx`

**Interfaces:**
- Produces:
  - HabitForm: real `<form onSubmit>` (Save `type="submit"`), name-field Enter → `preventDefault` + save, per-field `role="alert"` validation (`Choose a category.` / `Choose an intention.` / `Pick at least one day.` / `Enter a target.`), errors cleared on any field edit and on a successful save; `switchType(next)` converts timer↔quantity targets (÷60 floored at 1, ×60 floored at 60) and never otherwise mutates `draft.target`; boolean save coerces `target: 1`; trims name/category/intention on save.
  - Sheet: initial focus = panel (`tabIndex={-1}`), Tab/Shift+Tab trapped (wrap both ways, redirect stray focus in), Escape still closes, focus restored to the opener on close, `document.body.style.overflow` locked/restored; `onClose` read through a ref so the open-transition effect never re-runs (and never re-captures the panel as opener) — decision 5.
  - HabitList: `Move {name} up/down` buttons (`disabled` at category edges, `disabled:opacity-40`), `move(habit, dir)` recomputing orders within category, `role="status"` announcement `{name} moved up|down`; persists via the existing `onReorder` (already atomic through Task 5's `putHabits`).
  - CategorySection: `useId()` list id + `aria-controls` on the collapse button **only while expanded** (the `<ul>` exists only then — a dangling idref would fail axe).
- Consumes: jsdom facts 1–3 (submit click works; Enter needs handlers; disabled swallows clicks).

- [ ] **Step 1: Write the failing tests**

`src/components/HabitForm.test.tsx` — append these and rewrite one block:

```tsx
  // Spec R5: Enter in the name field submits (jsdom has no implicit submission).
  it('submits from the name field on Enter', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<HabitForm habit={habit} open onSave={onSave} onClose={onClose} />);
    fireEvent.keyDown(screen.getByLabelText('Habit name'), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks an empty category with an inline message (R5)', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<HabitForm habit={{ ...habit, category: '   ' }} open onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();            // stays open
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a category.');
  });

  it('blocks an empty intention with an inline message (R5)', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, intention: '' }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an intention.');
  });

  it('blocks saving with zero weekdays (R5)', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, frequency: [] }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one day.');
  });

  it('converts targets across type switches without destroying the draft (R5)', () => {
    render(<HabitForm habit={{ ...habit, type: 'timer', target: 900 }} open
                      onSave={vi.fn()} onClose={vi.fn()} />);
    const target = () => screen.getByLabelText(/^Target/);
    fireEvent.click(screen.getByRole('button', { name: 'Type quantity' }));
    expect(target()).toHaveValue(15);                  // 900 s → 15 minutes
    fireEvent.click(screen.getByRole('button', { name: 'Type timer' }));
    expect(target()).toHaveValue(15);                  // 15 → 900 s (shown in minutes)
    fireEvent.click(screen.getByRole('button', { name: 'Type quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Type boolean' }));
    expect(screen.queryByLabelText(/^Target/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Type quantity' }));
    expect(target()).toHaveValue(15);                  // round trip keeps the number
  });

  it('coerces the target to 1 when the save is boolean (R5)', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, type: 'quantity', target: 15, unit: 'minutes' }} open
                      onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Type boolean' }));
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'boolean', target: 1 });
  });
```

Rewrite the silent-fallback tail of `edits the timer target in minutes and stores seconds` (original lines 160–166):

```ts
    // Spec R5: an empty target is a validation error, never a silent 600.
    fireEvent.change(target(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave).toHaveBeenCalledTimes(1);                       // the earlier valid save only
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a target.');

    // A valid value clears the error and saves normally.
    rerender(<HabitForm habit={{ ...habit, type: 'timer', target: 30 }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0].target).toBe(60);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
```

`src/components/Sheet.test.tsx` — append:

```tsx
  describe('focus management (spec R5.2)', () => {
    it('moves focus into the panel on open and restores the opener on close', () => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>open</button>
            <Sheet open={open} onClose={() => setOpen(false)} title="Menu">
              <button type="button">inside</button>
            </Sheet>
          </>
        );
      }
      render(<Harness />);
      const opener = screen.getByRole('button', { name: 'open' });
      opener.focus();
      fireEvent.click(opener);
      const panel = screen.getByRole('dialog');
      expect(document.activeElement).toBe(panel);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.activeElement).toBe(opener);    // focus restored
    });

    it('traps Tab inside the panel, wrapping in both directions', () => {
      render(
        <Sheet open onClose={vi.fn()} title="Menu">
          <button type="button">first</button>
          <button type="button">last</button>
        </Sheet>,
      );
      const panel = screen.getByRole('dialog');
      expect(document.activeElement).toBe(panel);                 // initial: the panel
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }));
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'last' })); // wraps up
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' })); // wraps down
    });

    it('locks body scroll while open and restores it on close', () => {
      const { unmount } = render(
        <Sheet open onClose={vi.fn()} title="Menu"><span>body</span></Sheet>,
      );
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });
```

(Add `useState` to the react import in Sheet.test.)

`src/components/HabitList.test.tsx` — append:

```tsx
  it('moves a habit within its category via keyboard buttons (R5)', () => {
    const onReorder = vi.fn();
    render(
      <HabitList
        habits={[h('a', 'Meditate', 'Morning', 0), h('b', 'Read', 'Morning', 1)]}
        onEdit={vi.fn()} onDelete={vi.fn()} onReorder={onReorder} />
    );
    expect(screen.getByRole('button', { name: 'Move Meditate up' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Read up' }));
    expect(onReorder).toHaveBeenCalledTimes(1);
    const [reordered] = onReorder.mock.calls[0];
    expect(reordered.map((x: Habit) => x.id)).toEqual(['b', 'a']);
    expect(reordered.map((x: Habit) => x.order)).toEqual([0, 1]);
  });

  it('disables moves past the category edge and announces the move (R5)', () => {
    const onReorder = vi.fn();
    render(
      <HabitList
        habits={[h('a', 'Meditate', 'Morning', 0), h('b', 'Read', 'Morning', 1)]}
        onEdit={vi.fn()} onDelete={vi.fn()} onReorder={onReorder} />
    );
    expect(screen.getByRole('button', { name: 'Move Read down' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Read up' }));
    expect(screen.getByRole('status')).toHaveTextContent('Read moved up');
  });
```

`src/components/CategorySection.test.tsx` — append (using the file's existing `habit` and `handlers` fixtures):

```tsx
  it('wires aria-controls to the list it reveals, only while expanded (R5)', () => {
    const base = {
      category: 'Morning', habits: [habit('a', 'Meditate')], onToggleCollapse: vi.fn(), ...handlers,
    };
    const { rerender } = render(<CategorySection {...base} collapsed />);
    const button = screen.getByRole('button', { name: /expand morning/i });
    expect(button).not.toHaveAttribute('aria-controls');   // no dangling idref when collapsed
    rerender(<CategorySection {...base} collapsed={false} />);
    const open = screen.getByRole('button', { name: /collapse morning/i });
    const id = open.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toBe(screen.getByRole('list'));
  });
```

- [ ] **Step 2: Run — watch them fail** (`npx vitest run src/components/HabitForm.test.tsx src/components/Sheet.test.tsx src/components/HabitList.test.tsx src/components/CategorySection.test.tsx`): no validation, no conversions, no focus management, no move buttons, no aria-controls.

- [ ] **Step 3: Implement — Sheet focus** (`src/components/Sheet.tsx`)

Replace the existing Escape-only effect with a single open-transition effect (keep all surface/CENTER code):

```tsx
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Spec R5.2: focus enters the panel on open, Tab cycles within it, and focus
  // returns to the opener on close. onClose lives in a ref so this effect runs
  // once per open transition — re-running would re-capture the panel itself as
  // the "opener". The overlay is not portaled, so background exclusion is
  // delivered by aria-modal + this trap rather than a native `inert` sibling
  // (which would inert the sheet itself — plan decision 4).
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const active = document.activeElement;
      const within = active instanceof Node && panel.contains(active);
      if (e.shiftKey) {
        if (!within || active === items[0] || active === panel) { e.preventDefault(); items[items.length - 1].focus(); }
      } else if (!within || active === items[items.length - 1] || active === panel) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-transition only; onClose via ref
  }, [open]);
```

- Add `useRef` to the react import; add `tabIndex={-1}` to the `role="dialog"` panel div.

- [ ] **Step 4: Implement — HabitForm validation + form + conversions** (`src/components/HabitForm.tsx`)

- State: `const [errors, setErrors] = useState<Record<string, string>>({});`
- `set` clears errors on every edit: `const set = <K extends keyof Habit>(key: K, value: Habit[K]) => { setDraft((prev) => ({ ...prev, [key]: value })); setErrors({}); };`
- Add `switchType` (after `set`):

```ts
  // Spec R5: a type switch converts timer↔quantity targets and never
  // otherwise destroys the draft number (boolean coercion happens at save).
  const switchType = (next: HabitType) => {
    if (next === draft.type) return;
    let target = draft.target;
    if (draft.type === 'timer' && next === 'quantity') target = Math.max(1, Math.round(draft.target / 60));
    else if (draft.type === 'quantity' && next === 'timer') target = Math.max(60, Math.round(draft.target * 60));
    setDraft((prev) => ({ ...prev, type: next, target }));
    setErrors({});
  };
```

  Wire the Type buttons: `onClick={() => switchType(type)}` (keep `aria-pressed` as-is).
- Replace `save`:

```ts
  const save = () => {
    // Validate what the field SHOWS: the timer input edits minutes
    // (round-trip), the quantity input edits the raw number. A timer whose
    // draft is 30 s displays "1" → valid, saved through the existing 60 s
    // floor (spec §4 "empty/invalid": only an empty/zero display blocks —
    // the old silent 600 fallback is what dies, not the sub-minute floor).
    const shown = draft.type === 'timer' ? Math.round(draft.target / 60) : Number(draft.target);
    const next: Record<string, string> = {};
    if (!draft.category.trim()) next.category = 'Choose a category.';
    if (!draft.intention.trim()) next.intention = 'Choose an intention.';
    if (draft.frequency.length === 0) next.frequency = 'Pick at least one day.';
    if (draft.type !== 'boolean' && !(shown >= 1)) next.target = 'Enter a target.';
    if (Object.values(next).some(Boolean)) { setErrors(next); return; }   // stay open, nothing saved
    setErrors({});
    const target =
      draft.type === 'boolean' ? 1
      : draft.type === 'timer' ? Math.max(60, Math.round(Number(draft.target)))
      : Math.max(1, Math.round(Number(draft.target)));
    onSave({
      ...draft,
      name: draft.name.trim() || 'Untitled habit',
      category: draft.category.trim(),
      intention: draft.intention.trim(),
      target,
    });
    onClose();
  };
```

- Wrap the existing field container in `<form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">` (move the outer `div`'s class onto it) and make Save `type="submit"` (drop `onClick`).
- Name input: add `onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}`.
- Error lines (render only when set; `role="alert"`):
  - after the category field: `{errors.category && <p role="alert" className="text-xs text-red-500">{errors.category}</p>}`
  - after the intention `div[data-field]`: `{errors.intention && …}`
  - inside the frequency `fieldset`, after the weekday chips: `{errors.frequency && …}`
  - after the target label: `{errors.target && …}`

- [ ] **Step 5: Implement — HabitList move** (`src/components/HabitList.tsx`)

- Imports: `ChevronDown, ChevronUp` from lucide-react (keep `GripVertical`); `useState` already there.
- Add state `const [announce, setAnnounce] = useState('');` and the helper:

```tsx
  const move = (habit: Habit, dir: -1 | 1) => {
    const siblings = habits.filter((h) => h.category === habit.category)
      .sort((a, b) => a.order - b.order);
    const from = siblings.findIndex((h) => h.id === habit.id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= siblings.length) return;
    const next = [...siblings];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder([
      ...habits.filter((h) => h.category !== habit.category),
      ...next.map((h, index) => ({ ...h, order: index })),
    ]);
    setAnnounce(`${habit.name} moved ${dir === -1 ? 'up' : 'down'}`);
  };
```

- Render `<p role="status" aria-live="polite" className="sr-only">{announce}</p>` as the first child of the root div.
- In the row map, capture the index (`list.map((habit, index) => …)`) and add before the Edit button:

```tsx
<button type="button" aria-label={`Move ${habit.name} up`} disabled={index === 0}
        onClick={() => move(habit, -1)}
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--color-muted)] disabled:opacity-40">
  <ChevronUp size={15} />
</button>
<button type="button" aria-label={`Move ${habit.name} down`} disabled={index === list.length - 1}
        onClick={() => move(habit, 1)}
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--color-muted)] disabled:opacity-40">
  <ChevronDown size={15} />
</button>
```

- [ ] **Step 6: Implement — CategorySection aria-controls** (`src/components/CategorySection.tsx`)

- `import { useId } from 'react';` (merge with existing react import if any — this file currently imports none, so add `import { useId } from 'react';`).
- `const listId = useId();` in the component.
- Collapse button: add `aria-controls={collapsed ? undefined : listId}`.
- `<ul id={listId} …>`.

- [ ] **Step 7: Run — watch them pass** (`npx vitest run src/components/HabitForm.test.tsx src/components/Sheet.test.tsx src/components/HabitList.test.tsx src/components/CategorySection.test.tsx`).

- [ ] **Step 8: Knock-on check** — every existing `Save habit` click now flows through `submit` (jsdom fact 1 ✓, covered by HabitForm's own saves + TodayScreen header-form tests); all chip buttons keep `type="button"` so they never submit; Sheet's Escape test stays green (via `onCloseRef`); TodayScreen's `leaves no habit behind` still asserts `onClose` on Close.

- [ ] **Step 9: Gates** — `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.

- [ ] **Step 10: Commit** — stage `src/components/HabitForm.tsx src/components/HabitForm.test.tsx src/components/Sheet.tsx src/components/Sheet.test.tsx src/components/HabitList.tsx src/components/HabitList.test.tsx src/components/CategorySection.tsx src/components/CategorySection.test.tsx`
  `fix(forms): habit validation, dialog focus management, keyboard reorder (R5)`

---

### Task 7: R2 — Dead branches, one shared toggle, display consistency

**Files:**
- Modify: `src/lib/values.ts`, `src/components/TodayScreen.tsx`, `src/components/NoteScreen.tsx`
- Test: `src/lib/values.test.ts`, `src/components/TodayScreen.test.tsx`, `src/components/NoteScreen.test.tsx`

**Interfaces:**
- Produces:
  - `toggleValue(habit, value)` = `isCompleted(habit, value) ? 0 : (habit.type === 'boolean' ? 1 : habit.target)` (decision 1), used by TodayScreen's `toggle` and NoteScreen's checkbox.
  - TodayScreen: `isFuture`/`isPast` branches and `classifyDate`/`formatLong` imports removed (h1 is always `mounted ? 'Today' : ''`); empty-state CTA becomes `next/link` `Link`; `step` passes the raw delta (putEntry owns the clamp).
  - NoteScreen: intention buckets sorted by habit `order` (matching Stats §7.3); quantity/timer rows show `value of target` subtext derived from `clampedValue` (`3/8 cups`, `5/15 minutes`).
- Consumes: `isCompleted` from `stats.ts` (no cycle — stats imports only types).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/values.test.ts` (add `toggleValue` to the import, `isCompleted` is used indirectly):

```ts
import { toggleValue } from './values';   // merge into the existing import line

describe('toggleValue (spec R2 — one shared completion toggle)', () => {
  it('completes a not-done habit to its full target and back to zero', () => {
    expect(toggleValue(habit(), 0)).toBe(8);
    expect(toggleValue(habit(), 3)).toBe(8);    // checkbox completes a partial (NoteScreen semantics)
    expect(toggleValue(habit(), 8)).toBe(0);
    expect(toggleValue(habit(), 11)).toBe(0);   // over target still reads as done
  });

  it('uses 0/1 for boolean habits', () => {
    expect(toggleValue(habit({ type: 'boolean', target: 1 }), 0)).toBe(1);
    expect(toggleValue(habit({ type: 'boolean', target: 1 }), 1)).toBe(0);
  });
});
```

Append to `src/components/TodayScreen.test.tsx`:

```ts
// Spec R2: the future-day branch is dead (routes redirect) — remove it, and
// a directly-passed future date renders normally with no ghost message.
it('renders a directly-passed future date without the dead branch (R2)', async () => {
  await putHabit(habit({ name: 'Daily Stretch' }));
  render(<TodayScreen date="2026-12-31" />);
  expect(await screen.findByText('Daily Stretch')).toBeInTheDocument();
  expect(screen.queryByText(/hasn’t happened yet/i)).not.toBeInTheDocument();
});

it('routes the empty-state CTA through the client router (R2)', async () => {
  render(<TodayScreen date={todayKey()} />);
  const cta = await screen.findByRole('link', { name: /add a habit/i });
  expect(cta).toHaveAttribute('href', '/settings');
});
```

Append to `src/components/NoteScreen.test.tsx` (add `loadDay` to the repo import):

```ts
  it('shows the value of a quantity habit in the checklist (R2)', async () => {
    const w = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups', intention: 'Be Grateful' });
    await putHabit(w);
    await putEntry(w.id, '2026-05-24', 3);
    render(<NoteScreen date="2026-05-24" />);
    expect(await screen.findByText('3/8 cups')).toBeInTheDocument();
  });

  it('toggles a quantity row to the full target and back to zero (R2)', async () => {
    const w = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups', intention: 'Be Grateful' });
    await putHabit(w);
    render(<NoteScreen date="2026-05-24" />);
    const box = await screen.findByRole('checkbox', { name: /drink water/i });
    fireEvent.click(box);
    await waitFor(async () => {
      expect((await loadDay('2026-05-24')).find((e) => e.habitId === w.id)?.value).toBe(8);
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /drink water/i }));
    await waitFor(async () => {
      expect((await loadDay('2026-05-24')).find((e) => e.habitId === w.id)?.value).toBe(0);
    });
  });

  it('orders habits within an intention by their order field (R2)', async () => {
    await putHabit(habit({ id: 'z-read', name: 'Read', intention: 'Be Grateful', order: 5 }));
    await putHabit(habit({ id: 'a-water', name: 'Drink Water', intention: 'Be Grateful', order: 1 }));
    render(<NoteScreen date="2026-05-24" />);
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes[0]).toHaveAccessibleName(/drink water/i);   // order 1 first, not insertion order
  });
```

- [ ] **Step 2: Run — watch them fail** (`npx vitest run src/lib/values.test.ts src/components/TodayScreen.test.tsx src/components/NoteScreen.test.tsx`): `toggleValue` missing; future branch still renders the ghost message? (The branch removal test passes trivially *before* the change only if the text isn't rendered for that path — it **is** rendered pre-change, so it fails red ✓); CTA is an `<a>`; subtext missing; toggle writes 0 for a partial; order unsorted.

- [ ] **Step 3: Implement**

`src/lib/values.ts` — append:

```ts
import { isCompleted } from './stats';

/**
 * One shared completion toggle (spec R2): done → 0, not-done → the full
 * target (boolean habits: 1). TodayScreen's boolean rows and NoteScreen's
 * checkboxes now behave identically.
 */
export function toggleValue(habit: Habit, value: number): number {
  return isCompleted(habit, value) ? 0 : (habit.type === 'boolean' ? 1 : habit.target);
}
```

`src/components/TodayScreen.tsx`:
- Imports: drop `classifyDate, formatLong` (keep `todayKey`); add `import Link from 'next/link';` and `import { toggleValue } from '@/lib/values';`.
- Delete `const isFuture = …` and `const isPast = …`.
- h1: `{mounted ? 'Today' : ''}`.
- Delete the `) : isFuture ? ( …That day hasn't happened yet…` branch (the chain becomes `habits/entries gate → empty → groups.length === 0 → grid`).
- Empty CTA: `<Link href="/settings" className="rounded-2xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">Add a habit</Link>`.
- `toggle`: `void setValue(habit, toggleValue(habit, values[habit.id] ?? 0));`
- `step`: `void setValue(habit, (values[habit.id] ?? 0) + delta);` (drop the now-redundant `Math.max` — putEntry owns floor+cap).

`src/components/NoteScreen.tsx`:
- Imports: add `toggleValue`, `clampedValue` from `@/lib/values`; add `subtext` NOT needed (own display below).
- Groups memo: after building the map, sort each bucket: `for (const bucket of map.values()) bucket.sort((a, b) => a.order - b.order);` before `return [...map.entries()]`.
- Checklist row: inside `list.map`, add `const v = clampedValue(habit, values[habit.id] ?? 0);` and after the name span:

```tsx
{habit.type !== 'boolean' && (
  <span className="ml-auto text-xs text-white/70">
    {habit.type === 'quantity'
      ? `${v}/${habit.target}${habit.unit ? ` ${habit.unit}` : ''}`
      : `${Math.round(v / 60)}/${Math.round(habit.target / 60)} minutes`}
  </span>
)}
```

- Checkbox `onChange`: `() => { void putEntry(habit.id, date, toggleValue(habit, v)).catch(reportWriteError); }` (replaces the inline ternary from Task 5).

- [ ] **Step 4: Run — watch it pass** (full `npx vitest run` on the three files).

- [ ] **Step 5: Knock-on check** — TodayScreen SSR test (`no '2026-'`, contains `Loading`) still holds (h1 empty pre-mount ✓); `groups.length === 0` → `Nothing scheduled on this day.` branch is **not** dead (real for an off-schedule day) — keep it; NoteScreen's `DONE` styling untouched (`done` still from `isCompleted`).

- [ ] **Step 6: Gates** — `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.

- [ ] **Step 7: Commit** — stage `src/lib/values.ts src/lib/values.test.ts src/components/TodayScreen.tsx src/components/TodayScreen.test.tsx src/components/NoteScreen.tsx src/components/NoteScreen.test.tsx`
  `fix(screens): drop dead branches, one shared toggle, ordered note view (R2)`

---

### Task 8: R2 — Flame badge tap-through + final verification

**Files:**
- Modify: `src/components/HabitRow.tsx`
- Test: `src/components/HabitRow.test.tsx`

**Interfaces:**
- Produces: `FlameBadge` in `HabitRow` carries `pointer-events-none`, so it can never swallow a tap on the check/ring beneath it (the user-reported defect root cause). Visual position unchanged (Slice D's call).

- [ ] **Step 1: Write the failing test** — append to `src/components/HabitRow.test.tsx`:

```tsx
  // Spec R2: the badge overlays the row — it must never intercept taps
  // aimed at the ring/check control beneath it.
  it('lets taps pass through the flame badge to the control beneath', () => {
    render(<HabitRow habit={qtyHabit} value={4} onToggle={vi.fn()} {...base} streak={7} />);
    expect(screen.getByTestId('flame-badge').className).toContain('pointer-events-none');
  });
```

- [ ] **Step 2: Run — watch it fail** (`npx vitest run src/components/HabitRow.test.tsx`).

- [ ] **Step 3: Implement** — in `src/components/HabitRow.tsx` line 53, add the class:

```tsx
<FlameBadge count={streak} className="pointer-events-none absolute right-3 top-1.5 text-white" />
```

(`FlameBadge` merges `className` into its base — no component change needed.)

- [ ] **Step 4: Run — watch it pass**, then **Gates**: `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.

- [ ] **Step 5: Commit** — stage `src/components/HabitRow.tsx src/components/HabitRow.test.tsx`
  `fix(row): flame badge taps pass through to the completion control (R2)`

- [ ] **Step 6: Final verification (spec §9)** — after all eight commits:

  1. All four gates green on the final tree; `git log --oneline -9` shows the eight fix commits.
  2. `git status --porcelain` shows only the never-staged `.opencode/` and `opencode.json`.
  3. Browser smoke (start with `npm run start`, or the existing dev/preview server) — walk every screen and interaction:
     - Today: boolean toggle, quantity ± at 0 and at target (stops, disabled, never over), open ValueSheet (reject empty/over-target in place, valid saves), timer open/steppers/cap/Stop, category collapse, header `+` form, empty-state CTA link, hamburger drawer.
     - Note view: checkbox toggle for boolean + quantity (value subtext, full target then zero), share status (`Link copied` with a real clipboard), empty day copy, loading gate on refresh.
     - Stats: loading gate (no zero-tile flash), year nav min/max, heatmap.
     - Settings: HabitsPanel loading/empty/list, create/edit validation errors (all four), Enter submit, type-switch conversions, keyboard reorder + announcement, delete confirm, export/import of a **hostile file** (bad color, negative value, frequency with 9s) → imports, renders, no crash; reset.
     - Fresh profile (or after reset): boot migration runs with no banner; deliberately over-clamped legacy data converges.
     - Force a write failure if convenient (or accept unit coverage): banner appears with the exact copy and dismisses.
     - Dark mode + `prefers-reduced-motion` unchanged (no new motion added).
