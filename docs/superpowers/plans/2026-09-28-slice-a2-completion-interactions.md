# Slice A2 — Completion Interactions (check button + celebration toast) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the completion control actually complete quantity/timer habits (instead of opening their editors), and celebrate every completion transition with a non-blocking toast.

**Architecture:** Task 1 reuses the existing R2 shared toggle (`toggleValue`) by rendering the boolean check button on every row type — pure wiring, no new state. Task 2 adds a module-level store mirroring `src/lib/writeError.ts` (`useSyncExternalStore`, auto-dismiss timer), a fixed toast component mounted in `NavShell`, and explicit `celebrateIfCompleted(habit, before, after)` calls at the four completion sites — deliberately not a global values-watcher, so import/reset writes never celebrate.

**Tech Stack:** React 19, Next.js (App Router, `use client` components), Tailwind CSS v4 (`motion-safe:` variant, arbitrary values), vitest 3 + @testing-library/react 16, IndexedDB via existing `@/lib/repo`, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-09-28-slice-a2-completion-interactions-design.md` (normative — R1 behavior, R2 store/component/wiring rules, R4 test list, R5 commit groups)

## Global Constraints

- Local-first only: no network calls, no third-party CDNs, **no new runtime dependencies** (lucide-react and Tailwind already present).
- Exact normative copy: `` `Nice work — ${name} is done!` `` (em dash U+2014, matching `writeError.ts` house style). No other new user-facing strings.
- TDD Iron Law: write each test, watch it fail for the right reason, then implement. No production code before its failing test.
- Gates in this exact order before **every** commit: `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
- Exact file staging only; never `git add .`; never stage `.opencode/` or `opencode.json`.
- Commit messages: write via `$env:TEMP` file + `git commit -F` using `[System.IO.File]::WriteAllText($path, $msg, [System.Text.UTF8Encoding]::new($false))` (PowerShell 5 has no `utf8NoBOM`).
- Lint baseline: 2 pre-existing warnings in `src/lib/stats.test.ts` — new code must add zero.
- Dark mode via existing CSS vars (`--color-bg`, `--color-fg`, `--color-line`, `--color-accent`); no color-only meaning; `prefers-reduced-motion` respected (via `motion-safe:`); warm, never-shaming tone.
- `TZ=America/Los_Angeles` vitest pin unchanged; do not touch `vitest.config`.
- Behavior in A, visuals in D: no glassmorphism, no touch-target resizing beyond what's specified here.

## Review Focus

Spec-implied inputs/modes no single happy-path test exercises — each line is pinned by a named test in the task that owns the code:

1. **Two completions inside the 2-second window** (user checks habits in a row) — must replace the message and restart one timer, never stack or run two dismiss timers → store test *"replaces in place and restarts the window (never stacks)"* (Task 2).
2. **Habit names containing apostrophes/quotes** (e.g. the seeded `Don't Snack`) — must render the exact copy unbroken → store test *"handles names with apostrophes"* (Task 2).
3. **Server prerender of the static `/today` route** — `useSyncExternalStore` must supply a server snapshot so prerender renders nothing without throwing → component test *"renders nothing during server prerender"* (Task 2).
4. **Toast overlapping the Sheet/TimerModal layer (z-50) and the content behind it** — must sit above (`z-[60]`) and never swallow taps behind it (`pointer-events-none` region, `pointer-events-auto` button) → component test *"never blocks taps and sits above the sheet layer"* (Task 2).
5. **Importing already-completed entries / boot writes** — must never celebrate → TodayScreen test *"never celebrates an imported completion"* (Task 2). Reinforced by extending the existing failed-write test with a no-toast assertion (failed writes never celebrate, spec R2).
6. **A paused-then-resumed or already-done timer re-opening** — the completion effect always passes `initialSeconds` as `before`, so the store guard decides silence; arguments must be pinned → TimerModal test *"passes an already-completed before value"* (Task 2).

---

### Task 1: HabitRow check button on every row

**Files:**
- Modify: `src/components/HabitRow.tsx` (lines 57–64 boolean-only check block; move a type-agnostic version to the end of the row flex, after the quantity ring block ending line 111)
- Test: `src/components/HabitRow.test.tsx` (append inside `describe('HabitRow')`)

**Interfaces:**
- Consumes: existing `HabitRowProps.onToggle` (already passed for all rows by `CategorySection.tsx:60` → `onToggle={() => onToggle(habit)}`); `done` local (line 36: boolean `v > 0`, else `ratio >= 1`); existing `Check` import.
- Produces: a circular check button rendered for **all three types** with aria-label `Mark ${habit.name} done` (incomplete) / `Mark ${habit.name} not done` (complete) calling `onToggle`. Task 2's TodayScreen tests query these exact names. The ring keeps `onOpenValue`/`onOpenTimer`; steppers unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/HabitRow.test.tsx` inside the existing `describe('HabitRow')` block (after the flame-badge test, before the closing `});`):

```tsx
  // Slice A2 R1: quantity/timer rows complete from the same check control —
  // the ring stays the editor, the check stays the toggle.
  it('completes a quantity habit from a dedicated check button (A2)', () => {
    const onToggle = vi.fn();
    render(<HabitRow habit={qtyHabit} value={4} onToggle={onToggle} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Drink Water done' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Drink Water done' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('flips the quantity check to not-done at the target (A2)', () => {
    render(<HabitRow habit={qtyHabit} value={8} onToggle={vi.fn()} {...base} />);
    expect(screen.getByRole('button', { name: 'Mark Drink Water not done' })).toBeInTheDocument();
  });

  it('completes a timer habit from a dedicated check button (A2)', () => {
    const onToggle = vi.fn();
    render(<HabitRow habit={timerHabit} value={300} onToggle={onToggle} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Meditate done' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Open timer for Meditate' }),
    ).toBeInTheDocument(); // ring untouched beside it
  });

  it('keeps the quantity ring bound to the value sheet (A2)', () => {
    const onOpenValue = vi.fn();
    render(<HabitRow habit={qtyHabit} value={4} onToggle={vi.fn()} {...base} onOpenValue={onOpenValue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set exact value for Drink Water' }));
    expect(onOpenValue).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the tests and watch them fail for the right reason**

Run: `npx vitest run src/components/HabitRow.test.tsx`
Expected: FAIL — `Unable to find role="button" with name "Mark Drink Water done"` on the first new test (the check renders for boolean only today). The other three fail the same way or on the missing timer/quantity check.

- [ ] **Step 3: Render the check for every type**

In `src/components/HabitRow.tsx`, **delete** the boolean-only block (lines 57–64):

```tsx
        {habit.type === 'boolean' && (
          <button type="button"
                  aria-label={done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
                  onClick={onToggle}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow">
            {done ? <Check size={22} color={habit.color} strokeWidth={3} /> : <span className="text-slate-400">○</span>}
          </button>
        )}
```

…and add it unconditionally at the **end** of the row flex, immediately after the quantity ring block (after line 111's closing `)}`, still inside the `<div className="relative flex items-center gap-3 px-3 py-2.5 xl:gap-2">`):

```tsx
        {/* Slice A2 R1: one check control for every type — completes/undoes
            via the shared toggle; ring and steppers keep their jobs. */}
        <button type="button"
                aria-label={done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
                onClick={onToggle}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow">
          {done ? <Check size={22} color={habit.color} strokeWidth={3} /> : <span className="text-slate-400">○</span>}
        </button>
```

Resulting control order: boolean `[check]`; quantity `[−][+] [ring] [check]`; timer `[ring] [check]` — exactly spec R1. `done`, `Check`, and `onToggle` are already in scope; no prop changes. `CategorySection` passes `onToggle` for every row already — no changes there or in `TodayScreen`/`NoteScreen` (NoteScreen has its own checkbox, unchanged).

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/components/HabitRow.test.tsx`
Expected: PASS — all tests in the file, old and new (boolean test at line 24 must still pass unchanged; ring tests at lines 75/117 must still find their exact ring names — aria-labels don't collide because ring names start `Set exact value…`/`Open timer…`).

- [ ] **Step 5: Run full gates**

Run sequentially: `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`
Expected: all green; lint = the 2-warning baseline only.

- [ ] **Step 6: Commit**

```powershell
git add src/components/HabitRow.tsx src/components/HabitRow.test.tsx
[System.IO.File]::WriteAllText("$env:TEMP\commitmsg.txt", "feat(row): check button completes quantity and timer habits (A2)", [System.Text.UTF8Encoding]::new($false))
git commit -F "$env:TEMP\commitmsg.txt"
```

---

### Task 2: Celebration toast (store + component + four wiring sites)

**Files:**
- Create: `src/lib/completionToast.ts`
- Create: `src/lib/completionToast.test.ts`
- Create: `src/components/CompletionToast.tsx`
- Create: `src/components/CompletionToast.test.tsx`
- Modify: `src/app/globals.css` (append keyframes)
- Modify: `src/components/NavShell.tsx` (mount toast after `<WriteErrorBanner />`, line 66)
- Modify: `src/components/TodayScreen.tsx` (`setValue`, lines 112–115)
- Modify: `src/components/NoteScreen.tsx` (checkbox `onChange`, line 114)
- Modify: `src/components/TimerModal.tsx` (completion effect, lines 62–70)
- Test: `src/components/TodayScreen.test.tsx`, `src/components/NoteScreen.test.tsx`, `src/components/TimerModal.test.tsx`

**Interfaces:**
- Consumes: `isCompleted(habit, value)` from `src/lib/stats.ts:31` (boolean `value > 0`, else `value >= target`; imports only `./dates` + `./types`, safe under TimerModal's `vi.mock('@/lib/repo')`); the `Mark …` aria-labels from Task 1; `Sheet` z-50 (`Sheet.tsx:92`) for the z-index rule; `useSyncExternalStore` house pattern from `src/lib/writeError.ts`.
- Produces (all consumers rely on these exact signatures):
  - `celebrateIfCompleted(habit: Habit, before: number, after: number): void` — fires only when `!isCompleted(before) && isCompleted(after)`; message `` `Nice work — ${habit.name} is done!` ``; auto-dismiss 2000 ms; a fresh fire replaces + restarts.
  - `dismissCompletionToast(): void` — clears message and cancels the timer.
  - `useCompletionToast(): string | null` — server snapshot `() => null`.
  - `<CompletionToast />` — `role="status" aria-live="polite"`, `data-testid="completion-toast"`, region `pointer-events-none z-[60] fixed bottom-24 md:bottom-6`, inner button `pointer-events-auto` with class `motion-safe:animate-[toast-in_200ms_ease-out]`; mounted once in `NavShell`.

- [ ] **Step 1 (cycle A): Write the failing store tests**

Create `src/lib/completionToast.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { celebrateIfCompleted, dismissCompletionToast, useCompletionToast } from './completionToast';
import type { Habit } from './types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'x1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});
const qty = () => habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });

afterEach(() => {
  dismissCompletionToast();   // module store persists across tests — always reset
  vi.useRealTimers();
});

describe('completionToast store (A2 R2)', () => {
  it('is empty until a habit completes', () => {
    const { result } = renderHook(() => useCompletionToast());
    expect(result.current).toBeNull();
  });

  it('fires on a completion transition with the exact copy', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    expect(result.current).toBe('Nice work — Drink Water is done!');
  });

  it('fires when a partial quantity crosses the target', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 4, 8); });
    expect(result.current).toBe('Nice work — Drink Water is done!');
  });

  it('fires for a boolean habit', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(habit(), 0, 1); });
    expect(result.current).toBe('Nice work — Meditate is done!');
  });

  it('stays silent on undo, no-op, and partial progress', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 8, 0); });   // undo
    expect(result.current).toBeNull();
    act(() => { celebrateIfCompleted(qty(), 8, 8); });   // already done
    expect(result.current).toBeNull();
    act(() => { celebrateIfCompleted(qty(), 0, 4); });   // progress, not done
    expect(result.current).toBeNull();
  });

  it('handles names with apostrophes', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(habit({ name: "Don't Snack" }), 0, 1); });
    expect(result.current).toBe("Nice work — Don't Snack is done!");
  });

  it('auto-dismisses after 2 seconds', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    act(() => { vi.advanceTimersByTime(1999); });
    expect(result.current).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBeNull();
  });

  it('replaces in place and restarts the window (never stacks)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    act(() => { vi.advanceTimersByTime(1500); });
    act(() => { celebrateIfCompleted(habit({ name: 'Read' }), 0, 1); });
    expect(result.current).toBe('Nice work — Read is done!');   // replaced, not stacked
    act(() => { vi.advanceTimersByTime(1999); });
    expect(result.current).not.toBeNull();                      // window restarted
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBeNull();
  });

  it('dismiss clears immediately and cancels the timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    act(() => { dismissCompletionToast(); });
    expect(result.current).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2 (cycle A): Run and watch it fail for the right reason**

Run: `npx vitest run src/lib/completionToast.test.ts`
Expected: FAIL — cannot resolve `./completionToast` (module does not exist).

- [ ] **Step 3 (cycle A): Implement the store**

Create `src/lib/completionToast.ts`:

```ts
'use client';

import { useSyncExternalStore } from 'react';
import { isCompleted } from './stats';
import type { Habit } from './types';

const AUTO_DISMISS_MS = 2000;

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/**
 * Slice A2 R2: celebrate only a genuine completion transition — never an
 * undo, a no-op rewrite, or an already-done value. A fresh celebration
 * replaces the visible message and restarts the single dismiss timer
 * (same mechanics as reportWriteError: replace, never stack).
 */
export function celebrateIfCompleted(habit: Habit, before: number, after: number): void {
  if (isCompleted(habit, before) || !isCompleted(habit, after)) return;
  message = `Nice work — ${habit.name} is done!`;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { message = null; timer = null; emit(); }, AUTO_DISMISS_MS);
  emit();
}

export function dismissCompletionToast(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  message = null;
  emit();
}

export function useCompletionToast(): string | null {
  return useSyncExternalStore(subscribe, () => message, () => null);
}
```

- [ ] **Step 4 (cycle A): Run and watch it pass**

Run: `npx vitest run src/lib/completionToast.test.ts`
Expected: PASS — all 10 tests.

- [ ] **Step 5 (cycle B): Write the failing component tests**

Create `src/components/CompletionToast.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { celebrateIfCompleted, dismissCompletionToast } from '@/lib/completionToast';
import type { Habit } from '@/lib/types';
import { CompletionToast } from './CompletionToast';

vi.mock('@/lib/seed', () => ({ seedIfEmpty: vi.fn(() => Promise.resolve()) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const qty: Habit = {
  id: 'q1', name: 'Drink Water', icon: 'target', color: '#6366f1', category: 'Health',
  intention: 'Feel Better', type: 'quantity', target: 8, unit: 'cups',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};

afterEach(() => { dismissCompletionToast(); vi.restoreAllMocks(); });

describe('CompletionToast (A2 R2)', () => {
  it('renders nothing until a habit completes', () => {
    render(<CompletionToast />);
    expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
  });

  it('announces the exact copy in a polite status region', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('data-testid', 'completion-toast');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent('Nice work — Drink Water is done!');
  });

  it('dismisses on tap', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    fireEvent.click(screen.getByRole('button', { name: /nice work/i }));
    expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
  });

  it('never blocks taps and sits above the sheet layer (A2)', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    const region = screen.getByTestId('completion-toast');
    expect(region.className).toContain('pointer-events-none');  // taps behind pass through
    expect(region.className).toContain('z-[60]');               // Sheet is z-50 (Sheet.tsx:92)
    expect(screen.getByRole('button', { name: /nice work/i }).className)
      .toContain('pointer-events-auto');
  });

  it('uses a motion-safe entrance animation (A2)', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    expect(screen.getByRole('button', { name: /nice work/i }).className)
      .toContain('motion-safe:animate-[toast-in_200ms_ease-out]');
  });

  it('renders nothing during server prerender', () => {
    expect(renderToString(<CompletionToast />)).toBe('');
  });

  it('mounts in NavShell above the content', async () => {
    const { NavShell } = await import('./NavShell');
    render(<NavShell><main>content</main></NavShell>);
    expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    expect(await screen.findByTestId('completion-toast')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6 (cycle B): Run and watch it fail for the right reason**

Run: `npx vitest run src/components/CompletionToast.test.tsx`
Expected: FAIL — cannot resolve `./CompletionToast` (module does not exist).

- [ ] **Step 7 (cycle B): Implement the component, keyframes, and NavShell mount**

Create `src/components/CompletionToast.tsx`:

```tsx
'use client';

import { Check } from 'lucide-react';
import { dismissCompletionToast, useCompletionToast } from '@/lib/completionToast';

/**
 * Slice A2 R2: a non-blocking congratulation. The region ignores pointer
 * events so it can never trap a tap meant for the list behind it; only the
 * card itself is tappable (dismiss). Focus is never moved here — the polite
 * status region announces the message instead.
 */
export function CompletionToast() {
  const message = useCompletionToast();
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" data-testid="completion-toast"
         className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-6">
      <button type="button"
              onClick={dismissCompletionToast}
              aria-label={message}
              className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-fg)] shadow-lg motion-safe:animate-[toast-in_200ms_ease-out]">
        <Check size={18} className="shrink-0 text-[var(--color-accent)]" strokeWidth={3} />
        <span className="truncate">{message}</span>
      </button>
    </div>
  );
}
```

Append to `src/app/globals.css` (end of file):

```css
/* Slice A2 R2: completion-toast entrance — applied only under motion-safe. */
@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

In `src/components/NavShell.tsx`: add `import { CompletionToast } from './CompletionToast';` after the `WriteErrorBanner` import (line 11), and render it immediately after `<WriteErrorBanner />` (line 66):

```tsx
        <WriteErrorBanner />
        <CompletionToast />
```

- [ ] **Step 8 (cycle B): Run and watch it pass**

Run: `npx vitest run src/components/CompletionToast.test.tsx`
Expected: PASS — all 7 tests.

- [ ] **Step 9 (cycle C): Write the failing TodayScreen wiring tests**

Append to `src/components/TodayScreen.test.tsx` (top level, alongside the existing standalone `it`s after the main describe; `loadDay`, `putHabit`, `putEntry`, `todayKey`, `fireEvent`, `waitFor` are all already imported):

```tsx
// Slice A2 R1/R2: the check button completes quantity rows and celebrates.
it('completes a quantity habit from its check button and celebrates (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><TodayScreen date={todayKey()} /></NavShell>);
  const check = await screen.findByRole('button', { name: 'Mark Drink Water done' });
  check.click();
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByTestId('completion-toast'))
    .toHaveTextContent('Nice work — Drink Water is done!');
  fireEvent.click(screen.getByRole('button', { name: 'Mark Drink Water not done' }));
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(0);
  });
});

it('celebrates when a stepper crosses the target, then stops at the cap (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 7);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><TodayScreen date={todayKey()} /></NavShell>);
  (await screen.findByRole('button', { name: /add one cups/i })).click();
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByTestId('completion-toast')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add one cups/i })).toBeDisabled(); // cap: no further write
});

it('celebrates when the exact-value sheet saves a full target (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><TodayScreen date={todayKey()} /></NavShell>);
  fireEvent.click(await screen.findByRole('button', { name: 'Set exact value for Drink Water' }));
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByTestId('completion-toast'))
    .toHaveTextContent('Nice work — Drink Water is done!');
});

it('never celebrates an undo (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 8);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><TodayScreen date={todayKey()} /></NavShell>);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Drink Water not done' }));
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(0);
  });
  expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
});

it('never celebrates an imported completion (A2)', async () => {
  const { importState } = await import('@/lib/repo');
  await importState({
    habits: [{
      id: 'x1', name: 'Drink Water', icon: 'target', color: '#6366f1', category: 'Health',
      intention: 'Feel Better', type: 'quantity', target: 8, unit: 'cups',
      frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
    }],
    entries: [{ id: `x1_${todayKey()}`, habitId: 'x1', date: todayKey(), value: 8, timestamp: 0 }],
  });
  const { NavShell } = await import('./NavShell');
  render(<NavShell><TodayScreen date={todayKey()} /></NavShell>);
  expect(await screen.findByText('Every day, 8/8 cups')).toBeInTheDocument();
  expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
});
```

Also **extend** the existing failed-write test (*"surfaces a failed toggle write on the shared banner (R3)"*, ~line 304) by appending one assertion after the banner assertion:

```tsx
  expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument(); // A2: failed writes never celebrate
```

- [ ] **Step 10 (cycle C): Run and watch it fail for the right reason**

Run: `npx vitest run src/components/TodayScreen.test.tsx`
Expected: FAIL on the new tests — the value assertions pass (Task 1 wired the toggle) but `findByTestId('completion-toast')` times out: nothing calls `celebrateIfCompleted` yet. The "never celebrates" tests pass vacuously at this stage — that's acceptable; they pin the contract once wiring lands (they'd catch a future global watcher).

- [ ] **Step 11 (cycle C): Wire `setValue` (covers check, stepper, ValueSheet)**

In `src/components/TodayScreen.tsx`: add `celebrateIfCompleted` to the existing `@/lib/values`… no — add a new import next to it (line 12):

```ts
import { celebrateIfCompleted } from '@/lib/completionToast';
```

Replace `setValue` (lines 112–115):

```ts
  const setValue = useCallback(async (habit: Habit, value: number) => {
    const before = values[habit.id] ?? 0;
    try {
      await putEntry(habit.id, date, value);   // putEntry owns the clamp (R1)
      celebrateIfCompleted(habit, before, value);   // A2: only after a successful write
    }
    catch (err) { reportWriteError(err); }           // failure → banner, never a toast
  }, [date, values]);
```

(`values` joins the dep array; `toggle`/`step`/ValueSheet `onSave` all funnel through here, matching spec R2's wiring table.)

- [ ] **Step 12 (cycle C): Run and watch it pass**

Run: `npx vitest run src/components/TodayScreen.test.tsx`
Expected: PASS — new tests celebrate; "never celebrates" tests still pass (now non-vacuously for undo); existing R1/R3 tests unchanged.

- [ ] **Step 13 (cycle D): Write the failing NoteScreen wiring tests**

First add imports to `src/components/NoteScreen.test.tsx`:

```tsx
import { renderToString } from 'react-dom/server';   // NOT needed here — skip
```
*(do not add renderToString; only these two:)*

```tsx
import { dismissCompletionToast } from '@/lib/completionToast';
import { CompletionToast } from './CompletionToast';
```

and a top-level reset next to the existing `beforeEach` (line 17):

```tsx
afterEach(() => { dismissCompletionToast(); });
```

Append inside `describe('NoteScreen')`:

```tsx
  it('celebrates when the checkbox completes a habit (A2)', async () => {
    const w = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups', intention: 'Be Grateful' });
    await putHabit(w);
    render(<><CompletionToast /><NoteScreen date="2026-05-24" /></>);
    const box = await screen.findByRole('checkbox', { name: /drink water/i });
    fireEvent.click(box);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /drink water/i })).toBeChecked());
    expect(await screen.findByTestId('completion-toast'))
      .toHaveTextContent('Nice work — Drink Water is done!');
  });

  it('never celebrates unchecking (A2)', async () => {
    const w = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups', intention: 'Be Grateful' });
    await putHabit(w);
    await putEntry(w.id, '2026-05-24', 8);
    render(<><CompletionToast /><NoteScreen date="2026-05-24" /></>);
    const box = await screen.findByRole('checkbox', { name: /drink water/i });
    await waitFor(() => expect(box).toBeChecked());
    fireEvent.click(box);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /drink water/i })).not.toBeChecked());
    expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
  });
```

- [ ] **Step 14 (cycle D): Run and watch it fail for the right reason**

Run: `npx vitest run src/components/NoteScreen.test.tsx`
Expected: FAIL — the checkbox still only writes (`putEntry` line 114); no celebration, so `findByTestId('completion-toast')` times out in the first test. The second passes vacuously (pins the contract post-wiring).

- [ ] **Step 15 (cycle D): Wire the NoteScreen checkbox**

Add import to `src/components/NoteScreen.tsx` (next to the `toggleValue` import, line 8):

```ts
import { celebrateIfCompleted } from '@/lib/completionToast';
```

Replace line 114's `onChange`:

```tsx
                        onChange={() => {
                          const next = toggleValue(habit, v);
                          void putEntry(habit.id, date, next)
                            .then(() => celebrateIfCompleted(habit, v, next))   // A2: after success only
                            .catch(reportWriteError);
                        }}
```

(`v` is already the clamped current value — the `before`; a rejection skips the `.then`, so failures only banner.)

- [ ] **Step 16 (cycle D): Run and watch it pass**

Run: `npx vitest run src/components/NoteScreen.test.tsx`
Expected: PASS — all tests including the existing checkbox toggle test at line 137.

- [ ] **Step 17 (cycle E): Write the failing TimerModal wiring tests**

In `src/components/TimerModal.test.tsx` add the module mock next to the existing repo mock (line 7) and the import next to `TimerModal` (line 5):

```ts
vi.mock('@/lib/completionToast', () => ({ celebrateIfCompleted: vi.fn() }));
```

```ts
import { celebrateIfCompleted } from '@/lib/completionToast';
```

Append inside `describe('TimerModal')` (repo is fully mocked here — `putEntry` resolves — and `beforeEach` already runs `vi.clearAllMocks()`, so counts are per-test):

```tsx
  it('celebrates exactly once when a full-duration session completes (A2)', async () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(15 * 60_000 + 1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledWith(habit, 0, 900);
  });

  it('never celebrates a session that ends below the target (A2)', async () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));  // an 840s session
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(14 * 60_000 + 1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(putEntry)).toHaveBeenCalledWith('t1', '2026-09-23', 840);
    expect(vi.mocked(celebrateIfCompleted)).not.toHaveBeenCalled();               // 840 < 900 target
  });

  it('passes an already-completed before value on reopen (A2)', async () => {
    // before=900 → the store's guard stays silent; here we pin the arguments.
    render(<TimerModal habit={habit} initialSeconds={900} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledWith(habit, 900, 900);
  });
```

- [ ] **Step 18 (cycle E): Run and watch it fail for the right reason**

Run: `npx vitest run src/components/TimerModal.test.tsx`
Expected: FAIL — `expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledTimes(1)` received `0`: the completion effect writes but doesn't celebrate yet. (The mocked module means the store guard doesn't apply here — arguments are the contract under test; guard coverage lives in cycle A.)

- [ ] **Step 19 (cycle E): Wire the TimerModal completion effect**

Add import to `src/components/TimerModal.tsx` (next to `reportWriteError`, line 6):

```ts
import { celebrateIfCompleted } from '@/lib/completionToast';
```

Replace the completion effect (lines 62–70):

```ts
  useEffect(() => {
    if (!running || completed.current || elapsed < duration) return;
    completed.current = true;
    setStage('idle');
    // Spec R1.2.2: honest accounting — log the session actually run
    // (a 14-minute session on a 15-minute habit writes 840, not the target).
    const written = Math.min(elapsed, duration);
    void putEntry(habit.id, date, written)
      .then(() => celebrateIfCompleted(habit, initialSeconds, written))  // A2: after success only
      .catch(reportWriteError);
    onComplete();
  }, [elapsed, duration, running, habit.id, date, initialSeconds, onComplete]);
```

(`initialSeconds` joins the deps — it is the stable `before`. `close()`/unmount-persist writes are deliberately **not** celebration sites: spec R2 lists only this effect for the timer.)

- [ ] **Step 20 (cycle E): Run and watch it pass**

Run: `npx vitest run src/components/TimerModal.test.tsx`
Expected: PASS — all tests, including the existing completion tests at lines 203/223 (their `putEntry` assertions are unaffected by the added `.then`).

- [ ] **Step 21: Run full gates**

Run sequentially: `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`
Expected: all green (full suite, not just touched files — NavShell/WriteErrorBanner/Stats tests must survive the new mount); lint = 2-warning baseline; build succeeds.

- [ ] **Step 22: Commit**

```powershell
git add src/lib/completionToast.ts src/lib/completionToast.test.ts src/components/CompletionToast.tsx src/components/CompletionToast.test.tsx src/app/globals.css src/components/NavShell.tsx src/components/TodayScreen.tsx src/components/TodayScreen.test.tsx src/components/NoteScreen.tsx src/components/NoteScreen.test.tsx src/components/TimerModal.tsx src/components/TimerModal.test.tsx
[System.IO.File]::WriteAllText("$env:TEMP\commitmsg.txt", "feat(toast): celebration toast at every completion transition (A2)", [System.Text.UTF8Encoding]::new($false))
git commit -F "$env:TEMP\commitmsg.txt"
```

- [ ] **Step 23: Browser smoke (evidence before slice close)**

Run `npm run start` (kill any stale `next start` first) and verify on `localhost:3000`: quantity check completes 0→target and shows the toast; second tap undoes (toast from first completion may still be visible — it just must not re-fire, store-covered); stepper 7→8 shows toast; ring still opens "Set exact value"; timer completion at full duration shows toast; a 14-minute session does not; NoteScreen checkbox celebrates; dark mode toast uses `--color-bg`; toast sits above the timer sheet and doesn't block taps behind it; `prefers-reduced-motion` (devtools) shows no slide-up.

---

## Self-Review (plan vs spec)

1. **Spec coverage:** R1 → Task 1 (all three types, exact aria-labels, ring/steppers unchanged, layout order). R2 store → cycles A; component → B; wiring table (Today `setValue` covers check/stepper/ValueSheet, Note checkbox, Timer completion effect) → cycles C/D/E; all four R2 rules (after-success-only, no import/reset celebration, no stack, replace+restart) each have a named test. R3 = out of scope (nothing built). R4 test list → all items present, mapped. R5 commit groups → exactly 2 commits with the spec's exact messages. No gaps.
2. **Placeholder scan:** no TBD/TODO/"handle edge cases"; every code step shows full code; every test step shows the full test.
3. **Type consistency:** `celebrateIfCompleted(habit: Habit, before: number, after: number): void`, `dismissCompletionToast(): void`, `useCompletionToast(): string | null`, `<CompletionToast />` — identical across store, component, all three wiring sites, and every test. `written`/`before`/`next` variable names match between effect/onChange code and the asserted call arguments (`0, 900` / `840` / `900, 900`).
4. **Review Focus:** all six lines have a pinning test named above, each in the task owning the code.
