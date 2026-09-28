# Slice A2 — Completion interactions (check button + congratulation toast)

Date: 2026-09-28 · Status: awaiting spec review · Predecessor: slice A (`2f8e8a4` spec, 8 tasks complete)

## Context

User report after slice A: "the check button once the habit is done is still not functioning well — it shows editing the amount of minutes instead of completing it, and there's no popup which congratulates when something was marked as done."

Root cause (diagnosed, not guessed): in `HabitRow.tsx` the circular control renders a **Check icon** when a quantity/timer habit is done, but its `onClick` is bound to `onOpenValue` / `onOpenTimer` — the completion-*looking* control opens the editor. TodayScreen's shared `toggle` (`toggleValue`, spec A R2) is only wired to boolean rows; NoteScreen already has a real checkbox doing full↔0 for every type.

Approved decisions (user, this session):

- **Sequencing:** do this fix round now ("Slice A2"), then resume B → C → D.
- **Control:** dedicated check button on every row; ring keeps its editor job.
- **Toast trigger:** fires on **each** habit completion transition.
- **Form:** non-blocking toast card (not a modal), auto-dismiss, tap to dismiss.
- **Scope:** fires **everywhere** a habit completes, not just the Today check button.

## R1 — Check button on every row

`HabitRow` renders the circular check button for **all three types**, not just `boolean`:

- `aria-label` is `Mark ${habit.name} done` when incomplete and `Mark ${habit.name} not done` when complete (identical strings to the current boolean control).
- `onClick` → existing `onToggle` → TodayScreen's `toggle` → `toggleValue` (**done → 0, not-done → target**). One tap completes a partial quantity (5/8 → 8/8); one tap undoes a done habit (→ 0). Identical to NoteScreen's checkbox — no new state, no new repo logic.
- Layout after the approved control: boolean = `[check]`; quantity = `[−][+] [ring] [check]`; timer = `[ring] [check]`.
- Ring and steppers are **unchanged**: ring still opens ValueSheet/timer, steppers still step ±1 with the slice-A caps.
- Spacing/touch-target sizing of the now-wider quantity row is **deferred to slice D** (house rule: A fixes behavior, D fixes visuals).

## R2 — Completion toast

### Store — `src/lib/completionToast.ts` (new)

Module store + `useSyncExternalStore`, mirroring `src/lib/writeError.ts` (house pattern; deliberately **not** a React context — same call-site ergonomics, zero provider wiring):

- `celebrateIfCompleted(habit, before, after)` — the single entry point. Fires `celebrate(habit.name)` **iff** `!isCompleted(habit, before) && isCompleted(habit, after)` (guard against double-fire, undo, and "already done" writes).
- `dismissCompletionToast()`; `useCompletionToast(): string | null`.
- Auto-dismiss timer: **2000 ms**. A fresh celebrate while visible **replaces** the message and restarts the timer (never stacks, never two timers) — same mechanics as `reportWriteError`.
- Message copy (normative, exact): `` `Nice work — ${name} is done!` `` — warm, no shaming, em dash per house copy style.

### Component — `src/components/CompletionToast.tsx` (new), mounted in `NavShell`

- `role="status"` + `aria-live="polite"` wrapper (`data-testid="completion-toast"`); the whole toast body is one large `<button type="button">` (large tap target, keyboard-dismissable) whose `onClick` calls `dismissCompletionToast()`. Focus is **never** moved to it.
- Renders a `Check` icon (lucide, already a dependency) + the message.
- Non-blocking: fixed above the content, centered, `bottom-24 md:bottom-6`, `z-[60]` — must sit **above** Sheet/TimerModal layers (verify Sheet's z-index at implementation and exceed it).
- Colors via existing CSS vars (`--color-bg`, `--color-fg`, `--color-line`) so dark mode works for free; glass refinement deferred to slice D.
- Entrance: slide-up + fade using `motion-safe:` prefixed animation (keyframes in `globals.css`). Under `prefers-reduced-motion` the class resolves to nothing — no motion, instant appear.

### Wiring — every completion transition, and nowhere else

Call `celebrateIfCompleted(habit, before, after)` **after the write resolves successfully**:

| Site | `before` | `after` |
|---|---|---|
| TodayScreen `setValue` (covers check button, steppers crossing target, ValueSheet save) | `values[habit.id] ?? 0` | the written value (clamped) |
| NoteScreen checkbox `onChange` | current `v` | `toggleValue(habit, v)` |
| TimerModal completion effect | `initialSeconds` | `min(elapsed, duration)` |

Rules:

- **Failed writes never celebrate** (fire only after `putEntry` resolves; on rejection the existing `reportWriteError` banner runs instead).
- Timer sessions that end **below** target (duration decreased, e.g. 840/900) do **not** celebrate — the habit isn't done.
- Import, reset, seed, and boot-clamp writes never celebrate (explicit call sites only — a global values-watcher would toast on import; rejected).
- Undo, no-op writes, and reopening an already-done timer never celebrate (the `before`/`after` guard).

## R3 — Out of scope

- Glassmorphism styling of the toast/check → slice D.
- XP, points, badges, streak rewards, "all done" finale celebration → slice C (this toast is the "encouraging feedback" seed C builds on).
- Sound, confetti, blocking dialogs, focus management for the toast.
- Touch-target/spacing polish of the three-control quantity row → slice D.

## R4 — Testing (TDD — every test written and watched failing first)

- `HabitRow.test.tsx`: quantity and timer rows render the check with exact aria-labels; click calls `onToggle`; boolean coverage unchanged.
- `TodayScreen.test.tsx`: tapping a quantity check writes `target`, second tap writes `0`; stepper crossing target celebrates; stepper at cap can't (disabled).
- `completionToast.test.ts` (new): guard matrix — fires on 0→target and partial→target; silent on undo, already-done, failed write; 2000 ms auto-dismiss; replace restarts timer; dismiss clears.
- `CompletionToast.test.tsx` (new): exact copy with habit name, `role="status"`, click dismisses, auto-dismiss with fake timers, `motion-safe:` class present, renders nothing when store empty.
- `NoteScreen.test.tsx`: checkbox check celebrates, uncheck doesn't.
- `TimerModal.test.tsx`: full-duration completion celebrates once; shortened session doesn't; already-done reopen doesn't.

## R5 — Commit groups (2 commits, gates `test → typecheck → lint → build` before each)

1. `feat(row): check button completes quantity and timer habits (A2)` — `HabitRow.tsx` + tests.
2. `feat(toast): celebration toast at every completion transition (A2)` — `completionToast.ts`, `CompletionToast.tsx`, `globals.css`, `NavShell.tsx`, wiring in `TodayScreen.tsx` / `NoteScreen.tsx` / `TimerModal.tsx` + tests.

Exact staging only; never `git add .`; never stage `.opencode/` or `opencode.json`. Lint baseline: 2 pre-existing warnings in `src/lib/stats.test.ts`.

## Appendix — diagnosis evidence (for future reference)

`HabitRow.tsx` L83–111: timer/quantity ring buttons render `<Check>` when done but call `onOpenTimer`/`onOpenValue`. `TodayScreen.tsx` L194 passes `onToggle` for all rows; only boolean renders it. This is distinct from the slice-A T8 fix (FlameBadge swallowing taps) — that fix works; the control's *routing* was the remaining defect.
