# Slice E — Pages, Dashboard & Habit Templates: Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-03-slice-e-ia-pages-templates-design.md` (approved by user 2026-10-03)
**Method:** TDD — every task writes its tests first, watches them fail, implements, then runs the full gate suite before committing.

## Conventions (apply to every task)

- **Gates, in order:** `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
  Expected at every commit: all tests green (402 baseline + new), `tsc --noEmit` 0 errors,
  lint = baseline only (2 warnings in `src/lib/stats.test.ts`), build exit 0.
- **Exact staging only:** `git add <specific paths>` — NEVER `git add .`.
  Never stage `.opencode/` or `opencode.json` (they stay untracked).
- **Assertions are rewritten to the new expectation, never loosened or deleted without an
  equivalent re-pin elsewhere** (each move is mapped below).
- **No new dependencies. No runtime network. Local-first.** Untouched by this slice:
  `MenuDrawer`, `seed.ts` (+ its pins), import/export, values/streaks/stats logic,
  the stylesheet pins in `globals.test.ts`, theme system.
- **Test idioms in this repo** (copy them, don't improvise):
  - `const { push } = vi.hoisted(() => ({ push: vi.fn() }));` + `vi.mock('next/navigation', ...)`
  - `vi.mock('next/link', …)` renders `<a href data-next-link="">` so tests can tell router links
    from bare anchors; assert navigation via `href` + `data-next-link`, or via `push` for `router.push`.
  - `beforeEach(async () => { await clearAll(); })` for anything touching IndexedDB.
  - jsdom has no layout → pin sizes/styles at source (`testStylesheet`-style regex over file text,
    as `tapTargets.test.ts` and `globals.test.ts` do). Never inject raw `globals.css` (chokes on `@layer`).
  - Never render date-derived text before mount (prerender must be clock-independent — build pin).
- **Icons:** `lucide-react@0.469`. If an icon name fails typecheck, try the documented alias
  (`Home` ↔ `House`) — the typecheck gate catches it immediately.

## Task graph

```
1 ┐
2 ┴→ 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 (verification)
```
Tasks 1 and 2 are independent of everything. 4–7 depend on the renames in 3 and are
mutually independent, but run them in the listed order (5's link targets need 4;
8's `/` page must already contain the streak strip from 7 so Home never lands
half-built; 9's nav must only point at routes that exist).

---

## Task 1 — Template catalog (`src/lib/templates.ts`)

**Files:** `src/lib/templates.ts` (new), `src/lib/templates.test.ts` (new)

### Tests first (red)

```ts
// src/lib/templates.test.ts
import { describe, expect, it } from 'vitest';
import { TEMPLATE_GROUPS } from './templates';
import { ICONS } from './icons';
import { HABIT_COLORS } from './colors';

describe('template catalog (slice E R7)', () => {
  it('exposes exactly the four groups in spec order', () => {
    expect(TEMPLATE_GROUPS.map((g) => g.key)).toEqual(['good', 'health', 'bad', 'todo']);
    expect(TEMPLATE_GROUPS.map((g) => g.label)).toEqual(['Good', 'Health', 'Bad', 'To-do']);
  });

  it('every template satisfies the shape rules (spec §9)', () => {
    for (const g of TEMPLATE_GROUPS) {
      expect(g.habits.length).toBeGreaterThanOrEqual(5);
      const names = g.habits.map((h) => h.name);
      expect(new Set(names).size).toBe(names.length);        // unique within group
      for (const h of g.habits) {
        expect(h.name).toBe(h.name.trim());
        expect(h.name.length).toBeGreaterThan(0);
        expect(ICONS).toHaveProperty(h.icon);                 // real ICONS key
        expect(HABIT_COLORS).toContain(h.color);
        expect(h.category).toBe(g.label);
        expect(h.intention.trim().length).toBeGreaterThan(0);
        if (h.type === 'boolean') { expect(h.target).toBe(1); expect(h.unit).toBe(''); }
        if (h.type === 'quantity') {
          expect(h.target).toBeGreaterThanOrEqual(1);
          expect(h.unit.trim().length).toBeGreaterThan(0);
        }
        if (h.type === 'timer') expect(h.target).toBeGreaterThanOrEqual(60); // seconds
      }
    }
  });

  it('pins the catalog contents (spec §9 tables)', () => {
    const names = Object.fromEntries(
      TEMPLATE_GROUPS.map((g) => [g.label, g.habits.map((h) => h.name)]),
    );
    expect(names.Good).toEqual([
      'Meditate', 'Reading', 'Journal', 'Gratitude', 'Deep Work', 'Wake Early', 'Practice Language',
    ]);
    expect(names.Health).toEqual([
      'Steps', 'Run', 'Cycle', 'Swim', 'Stretch', 'Workout', 'Sleep',
    ]);
    expect(names['Bad']).toEqual([
      'No Junk Food', 'No Smoking', 'No Soda', 'No Late-Night Scrolling',
      'No Impulse Buying', 'No Oversleeping',
    ]);
    expect(names['To-do']).toEqual([
      'Plan Tomorrow', 'Review Goals', 'Inbox Zero', 'Prep Meals', 'Tidy Up', 'Weekly Review',
    ]);
    const steps = TEMPLATE_GROUPS.find((g) => g.label === 'Health')!.habits
      .find((h) => h.name === 'Steps')!;
    expect(steps).toMatchObject({
      type: 'quantity', target: 10000, unit: 'steps', icon: 'workout',
      color: '#22c55e', intention: 'Health', category: 'Health',
    });
  });

  it('Bad templates are all abstinence booleans (Q4-A)', () => {
    const bad = TEMPLATE_GROUPS.find((g) => g.key === 'bad')!;
    for (const h of bad.habits) {
      expect(h.type).toBe('boolean');
      expect(h.name).toMatch(/^No /);
    }
  });
});
```

Run: `npm test` → fails (module missing).

### Implementation

```ts
// src/lib/templates.ts
import type { IconName } from './icons';
import type { HabitType } from './types';

/** Spec slice E §9: static, code-only habit templates. Not user-editable. */
export interface TemplateHabit {
  name: string;
  icon: IconName;
  color: string;      // must be one of HABIT_COLORS
  category: string;   // the group label
  intention: string;
  type: HabitType;
  target: number;     // timer = seconds, quantity = ≥1, boolean = 1
  unit: string;       // quantity only, else ''
}

export interface TemplateGroup {
  key: 'good' | 'health' | 'bad' | 'todo';
  label: string;
  habits: TemplateHabit[];
}

const good = (name: string, icon: IconName, color: string, rest: Partial<TemplateHabit>): TemplateHabit => ({
  name, icon, color, category: 'Good', intention: 'Growth',
  type: 'boolean', target: 1, unit: '', ...rest,
});
const health = (name: string, icon: IconName, color: string, rest: Partial<TemplateHabit>): TemplateHabit => ({
  name, icon, color, category: 'Health', intention: 'Health',
  type: 'boolean', target: 1, unit: '', ...rest,
});
const bad = (name: string, icon: IconName, color: string): TemplateHabit => ({
  name, icon, color, category: 'Bad', intention: 'Discipline',
  type: 'boolean', target: 1, unit: '',
});
const todo = (name: string, icon: IconName, color: string, rest: Partial<TemplateHabit> = {}): TemplateHabit => ({
  name, icon, color, category: 'To-do', intention: 'Focus',
  type: 'boolean', target: 1, unit: '', ...rest,
});

export const TEMPLATE_GROUPS: readonly TemplateGroup[] = [
  {
    key: 'good', label: 'Good',
    habits: [
      good('Meditate', 'flower2', '#c026d3', { type: 'timer', target: 600 }),
      good('Reading', 'bookOpen', '#14b8a6', { type: 'quantity', target: 20, unit: 'minutes' }),
      good('Journal', 'pen', '#f59e0b', { type: 'quantity', target: 5, unit: 'minutes' }),
      good('Gratitude', 'heart', '#ec4899'),
      good('Deep Work', 'brain', '#6366f1', { type: 'timer', target: 1500 }),
      good('Wake Early', 'sunrise', '#f97316'),
      good('Practice Language', 'languages', '#22d3ee', { type: 'quantity', target: 15, unit: 'minutes' }),
    ],
  },
  {
    key: 'health', label: 'Health',
    habits: [
      health('Steps', 'workout', '#22c55e', { type: 'quantity', target: 10000, unit: 'steps' }),
      health('Run', 'flame', '#f97316', { type: 'quantity', target: 5, unit: 'km' }),
      health('Cycle', 'sun', '#22d3ee', { type: 'quantity', target: 10, unit: 'km' }),
      health('Swim', 'bath', '#3b82f6', { type: 'quantity', target: 30, unit: 'minutes' }),
      health('Stretch', 'flower2', '#14b8a6', { type: 'quantity', target: 10, unit: 'minutes' }),
      health('Workout', 'dumbbell', '#c026d3', { type: 'quantity', target: 30, unit: 'minutes' }),
      health('Sleep', 'bed', '#6366f1', { type: 'quantity', target: 8, unit: 'hours' }),
    ],
  },
  {
    key: 'bad', label: 'Bad',
    habits: [
      bad('No Junk Food', 'popcorn', '#ef4444'),
      bad('No Smoking', 'triangleAlert', '#f97316'),
      bad('No Soda', 'droplet', '#3b82f6'),
      bad('No Late-Night Scrolling', 'moon', '#6366f1'),
      bad('No Impulse Buying', 'wallet', '#f59e0b'),
      bad('No Oversleeping', 'alarmClock', '#ec4899'),
    ],
  },
  {
    key: 'todo', label: 'To-do',
    habits: [
      todo('Plan Tomorrow', 'calendarCheck', '#6366f1'),
      todo('Review Goals', 'target', '#22c55e'),
      todo('Inbox Zero', 'check', '#3b82f6'),
      todo('Prep Meals', 'coffee', '#14b8a6'),
      todo('Tidy Up', 'showerHead', '#f59e0b', { type: 'quantity', target: 10, unit: 'minutes' }),
      todo('Weekly Review', 'graduation', '#c026d3'),
    ],
  },
];
```

**Run → green.** Gates. Stage `src/lib/templates.ts src/lib/templates.test.ts`.

**Commit:** `feat(templates): static habit template catalog (slice E R7)`

---

## Task 2 — `monthGrid` date helper

**Files:** `src/lib/dates.ts` (edit), `src/lib/dates.test.ts` (edit)

### Tests first (red)

Append to the existing `dates.test.ts` (import `monthGrid` alongside the current date helpers):

```ts
import {
  addDays, classifyDate, dayOfYear, formatLong, fromKey, isValidDateKey,
  mondayOf, monthGrid, monthLabelPositions, stripDays, toKey, weekdayIndex, yearDays,
} from './dates';

describe('monthGrid (slice E R5)', () => {
  it('aligns October 2026 Monday-first with 3 leading blanks (Oct 1 = Thursday)', () => {
    const grid = monthGrid(2026, 10);
    expect(grid.length % 7).toBe(0);
    expect(grid.slice(0, 3)).toEqual([null, null, null]);
    expect(grid[3]).toBe('2026-10-01');
    expect(grid.filter(Boolean).pop()).toBe('2026-10-31');
    expect(grid[34]).toBeNull();            // 3 + 31 = 34 → padded to 35
  });

  it('keeps every cell in the requested month, 1-based month (spec R5)', () => {
    for (const [y, m] of [[2026, 1], [2026, 12]] as const) {
      const keys = monthGrid(y, m).filter(Boolean) as string[];
      expect(keys[0]!.startsWith(`${y}-${String(m).padStart(2, '0')}`)).toBe(true);
      for (const k of keys) expect(k.startsWith(`${y}-${String(m).padStart(2, '0')}`)).toBe(true);
    }
  });

  it('handles 28-, 29-, 30-, and 31-day months', () => {
    expect((monthGrid(2026, 2).filter(Boolean)).length).toBe(28);
    expect((monthGrid(2028, 2).filter(Boolean)).length).toBe(29);  // leap
    expect((monthGrid(2026, 4).filter(Boolean)).length).toBe(30);
    expect((monthGrid(2026, 3).filter(Boolean)).length).toBe(31);
    expect(monthGrid(2026, 2)).not.toContain('2026-02-29');
    expect(monthGrid(2028, 2)).toContain('2028-02-29');
  });

  it('is Monday-first: cell index → weekday mapping holds for a whole year', () => {
    for (let m = 1; m <= 12; m++) {
      const grid = monthGrid(2026, m);
      grid.forEach((key, i) => {
        if (!key) return;
        // Monday-first columns: index%7 0=Mon … 6=Sun; weekdayIndex is 0=Sun
        expect(weekdayIndex(key)).toBe(((i % 7) + 1) % 7);
      });
    }
  });

  it('rolls the year over in December', () => {
    const grid = monthGrid(2026, 12).filter(Boolean) as string[];
    expect(grid[0]).toBe('2026-12-01');
    expect(grid[grid.length - 1]).toBe('2026-12-31');
  });
});
```

Run → red (no `monthGrid` export).

### Implementation

Append to `src/lib/dates.ts` (reuses the module-private `mondayIndex`):

```ts
/**
 * Calendar grid for one month: Monday-first rows of 7, `null` outside the month.
 * `month` is 1-based (1 = January). Slice E R5 (Calendar page).
 */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const lead = mondayIndex(toKey(first));                    // blank cells before the 1st
  const days = new Date(year, month, 0).getDate();           // days in month
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toKey(new Date(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
```

**Run → green.** Gates. Stage `src/lib/dates.ts src/lib/dates.test.ts`.

**Commit:** `feat(dates): monthGrid helper for the calendar (slice E R5)`

---

## Task 3 — Mechanical renames (no behavior change)

**Files (git mv + textual rename):**

- `src/components/TodayScreen.tsx` → `src/components/HomeScreen.tsx` — `export function HomeScreen`
- `src/components/TodayScreen.test.tsx` → `src/components/HomeScreen.test.tsx` — import,
  every `<TodayScreen …/>`, describe titles (`Today header` → `Home header`), comments
- `src/components/StatsScreen.tsx` → `src/components/InsightsScreen.tsx` — `export function InsightsScreen`
- `src/components/StatsScreen.test.tsx` → `src/components/InsightsScreen.test.tsx` — import + describe label
- Import updates: `src/app/today/page.tsx`, `src/app/today/[date]/page.tsx`,
  `src/app/stats/page.tsx` (all still exist until Task 8 — they just point at the new names)
- `src/components/tapTargets.test.ts` — `src('TodayScreen.tsx')` → `src('HomeScreen.tsx')`,
  test titles likewise
- Comment touch-ups where they name the old components:
  `src/components/IntentionBar.tsx` (mentions StatsScreen), `Heatmap.test.tsx` line 244 comment

### Steps

1. `git mv` the four files.
2. Replace `TodayScreen` → `HomeScreen` and `StatsScreen` → `InsightsScreen` across `src/`
   (word-boundary replace; check with `grep -r "TodayScreen\|StatsScreen" src/` → only
   deliberate comment history may remain — aim for zero).
3. Run gates — **zero assertions changed**; this commit is pure rename.
4. Stage the renamed/edited paths explicitly.

**Commit:** `refactor: rename TodayScreen→HomeScreen, StatsScreen→InsightsScreen (slice E)`

---

## Task 4 — Add Habit page (gallery → prefilled form → save → `/habits`)

**Files:**
- new `src/components/AddHabitScreen.tsx`
- new `src/components/AddHabitScreen.test.tsx`
- new `src/app/add-habit/page.tsx`
- edit `src/components/HomeScreen.tsx` (header `+` and empty CTA now route to `/add-habit`)
- edit `src/components/HomeScreen.test.tsx` (re-writes mapped below)

### Tests first (red)

```tsx
// src/components/AddHabitScreen.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, listHabits } from '@/lib/repo';
import { AddHabitScreen } from './AddHabitScreen';
import { NavShell } from './NavShell';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/add-habit',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

beforeEach(async () => { await clearAll(); push.mockClear(); });

describe('AddHabitScreen (slice E R4)', () => {
  it('shows the four groups, Good active, with only its tiles', () => {
    render(<AddHabitScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Add habit' })).toBeInTheDocument();
    for (const label of ['Good', 'Health', 'Bad', 'To-do'])
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Meditate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Steps' })).not.toBeInTheDocument();
  });

  it('switches segments to show the other group’s tiles', () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    expect(screen.getByRole('button', { name: 'Health' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Steps' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Meditate' })).not.toBeInTheDocument();
  });

  it('prefills the form from a template tile (Q3-A)', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Habit name')).toHaveValue('Steps');
    expect(screen.getByLabelText('Category')).toHaveValue('Health');
    expect(screen.getByLabelText('Intention')).toHaveValue('Health');
    expect(screen.getByLabelText('Unit')).toHaveValue('steps');
    expect(screen.getByLabelText(/^Target/)).toHaveValue(10000);
    expect(screen.getByRole('button', { name: 'Type quantity' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Every day' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('prefills timer templates with minutes in the target', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Meditate' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type timer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/^Target/)).toHaveValue(10);   // 600 s shown as 10 min
  });

  it('saves a templated habit and routes to /habits', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    fireEvent.click(await screen.findByRole('button', { name: /save habit/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/habits'));
    const saved = (await listHabits())[0];
    expect(saved).toMatchObject({
      name: 'Steps', category: 'Health', intention: 'Health', type: 'quantity',
      target: 10000, unit: 'steps', frequency: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('creates a habit from the scratch form and routes to /habits', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    fireEvent.change(await screen.findByLabelText('Habit name'), { target: { value: 'Journal' } });
    fireEvent.change(screen.getByLabelText('Intention'), { target: { value: 'Do Hard Things' } });
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/habits'));
    expect((await listHabits()).map((h) => h.name)).toContain('Journal');
  });

  it('leaves no habit behind when the form closes without saving', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await listHabits()).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps the form open and shows the banner when the write fails', async () => {
    const repo = await import('@/lib/repo');
    const spy = vi.spyOn(repo, 'putHabit').mockRejectedValue(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<NavShell><AddHabitScreen /></NavShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    fireEvent.click(await screen.findByRole('button', { name: /save habit/i }));
    expect(await screen.findByTestId('write-error')).toHaveTextContent(/couldn't save that change/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();   // stays open on failure
    expect(push).not.toHaveBeenCalled();
    spy.mockRestore();
    vi.restoreAllMocks();
  });
});
```

> Note the **coverage map** for the two `HomeScreen.test.tsx` tests deleted below —
> this suite re-pins them (assertions moved, never dropped):
> - “creates a habit from the header form …” → *creates a habit from the scratch form …*
>   + *saves a templated habit …* (the “row renders under its category” half stays covered
>   by the existing `HabitsPanel`/`HabitList` rendering tests).
> - “leaves no habit behind when the header form is closed …” → *leaves no habit behind …*.

Run → red (module missing).

### Implementation

```tsx
// src/app/add-habit/page.tsx
'use client';

import { NavShell } from '@/components/NavShell';
import { AddHabitScreen } from '@/components/AddHabitScreen';

export default function AddHabitPage() {
  return (
    <NavShell>
      <AddHabitScreen />
    </NavShell>
  );
}
```

```tsx
// src/components/AddHabitScreen.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { listHabits, newId, putHabit } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';
import { reportWriteError } from '@/lib/writeError';
import { nameIcon } from '@/lib/icons';
import type { Habit } from '@/lib/types';
import { TEMPLATE_GROUPS, type TemplateGroup, type TemplateHabit } from '@/lib/templates';
import { blankHabit } from './HabitsPanel';
import { HabitForm } from './HabitForm';

export function AddHabitScreen() {
  const router = useRouter();
  const habits = useLiveQuery(() => listHabits(), []);
  const [groupKey, setGroupKey] = useState<TemplateGroup['key']>('good');
  const [editing, setEditing] = useState<Habit | null>(null);

  // Combobox suggestion pools: existing values first, group labels always offered
  // so a pre-filled category/intention is a valid choice (spec R4).
  const categories = useMemo(
    () => [...new Set([
      ...(habits ?? []).map((h) => h.category),
      ...TEMPLATE_GROUPS.map((g) => g.label),
    ])].sort(),
    [habits],
  );
  const intentions = useMemo(
    () => [...new Set((habits ?? []).map((h) => h.intention).filter(Boolean))].sort(),
    [habits],
  );

  const group = TEMPLATE_GROUPS.find((g) => g.key === groupKey) ?? TEMPLATE_GROUPS[0];

  const openTemplate = (t: TemplateHabit) => setEditing({
    id: newId(), name: t.name, icon: t.icon, color: t.color, category: t.category,
    intention: t.intention, type: t.type, target: t.target, unit: t.unit,
    frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: Date.now(),
  });

  const save = async (habit: Habit) => {
    try {
      await putHabit(habit);
      setEditing(null);
      router.push('/habits');            // land where the new habit is listed (spec R4)
    } catch (err) { reportWriteError(err); }   // form stays open on failure
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Add habit</h1>

      <div role="group" aria-label="Template groups" className="mb-4 flex flex-wrap gap-1.5">
        {TEMPLATE_GROUPS.map((g) => (
          <button
            key={g.key} type="button" aria-pressed={g.key === group.key}
            onClick={() => setGroupKey(g.key)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              g.key === group.key
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                : 'text-[var(--color-subtle)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {group.habits.map((t) => {
          const Icon = nameIcon(t.icon);
          return (
            <li key={t.name}>
              <button
                type="button" onClick={() => openTemplate(t)}
                className="glass-card flex min-h-16 w-full flex-col items-center gap-2 p-4 text-center transition-colors hover:bg-[var(--color-muted)]"
              >
                <Icon size={22} style={{ color: t.color }} aria-hidden />
                <span className="text-sm font-semibold">{t.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button" onClick={() => setEditing(blankHabit())}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-line)] px-4 py-4 text-sm font-semibold text-[var(--color-subtle)] transition-colors hover:text-[var(--color-fg)]"
      >
        Start from scratch
      </button>

      {editing && (
        <HabitForm
          habit={editing} open categories={categories} intentions={intentions}
          onSave={(h) => void save(h)} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

**HomeScreen rewires (same task — all “creation destination” changes land together):**

1. Header `+` (line ~164): `onClick={() => setCreating(blankHabit())}` → `onClick={() => router.push('/add-habit')}`.
2. Empty-state CTA (line ~180): `<Link href="/settings" …>` → `<Link href="/add-habit" …>` (text `Add a habit` unchanged).
3. Remove now-dead create flow: `creating` state, `saveHabit`, the `<HabitForm …>` render at the bottom,
   and the `HabitForm` / `blankHabit` imports — plus `putHabit` from the repo import **if** lint reports
   it unused (keep `putEntry` + `reportWriteError`: entry writes still use them).
   `useRouter` stays (DateStrip + header both use it).

**HomeScreen.test.tsx rewrites (red → green):**

- Line ~145 test →
  ```tsx
  it('routes the header + to /add-habit (slice E R2)', () => {
    render(<HomeScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add habit' }));
    expect(push).toHaveBeenCalledWith('/add-habit');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  ```
  (The `aria-label="Add habit"` pin is untouched — tapTargets still matches.)
- Delete the two follow-up tests (~154–178) — mapped to `AddHabitScreen.test.tsx` above.
- Line ~336 test: `expect(cta).toHaveAttribute('href', '/add-habit');` (name/`data-next-link` assertions stay).

### Run → green. Gates. Stage:

`src/components/AddHabitScreen.tsx src/components/AddHabitScreen.test.tsx src/app/add-habit/page.tsx src/components/HomeScreen.tsx src/components/HomeScreen.test.tsx`

**Commit:** `feat(add-habit): template gallery with prefilled form (slice E R4)`

---

## Task 5 — Habits page + slim Settings

**Files:**
- new `src/components/HabitsScreen.tsx` + `src/components/HabitsScreen.test.tsx`
- new `src/app/habits/page.tsx`
- new `src/components/SettingsScreen.test.tsx`
- edit `src/components/SettingsScreen.tsx` (drop `HabitsPanel`)
- edit `src/components/HabitsPanel.tsx` (`New habit` + empty state → `/add-habit` links)
- edit `src/components/HabitsPanel.test.tsx` (re-writes)

### Tests first (red)

```tsx
// src/components/HabitsScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/lib/repo';
import { HabitsScreen } from './HabitsScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/habits',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

beforeEach(async () => { await clearAll(); });

describe('HabitsScreen (slice E R3)', () => {
  it('renders the Habits heading with the management panel', async () => {
    render(<HabitsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Habits' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Habits' })).toBeInTheDocument();
  });

  it('routes New habit through the client router to /add-habit', async () => {
    render(<HabitsScreen />);
    const link = await screen.findByRole('link', { name: /new habit/i });
    expect(link).toHaveAttribute('href', '/add-habit');
    expect(link).toHaveAttribute('data-next-link');        // next/link, not a bare <a>
    expect(link.className).toContain('text-[var(--color-on-accent)]');   // A2 color pin kept
    expect(link.className).not.toContain('text-white');
  });

  it('routes the empty state to /add-habit', async () => {
    render(<HabitsScreen />);
    const cta = await screen.findByRole('link', { name: /no habits yet/i });
    expect(cta).toHaveAttribute('href', '/add-habit');
    expect(cta).toHaveAttribute('data-next-link');
  });
});
```

```tsx
// src/components/SettingsScreen.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from './SettingsScreen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('SettingsScreen (slice E R3)', () => {
  it('keeps Settings without the habits panel', () => {
    render(<SettingsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Habits' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new habit/i })).not.toBeInTheDocument();
    expect(screen.queryByText('No habits yet — create one.')).not.toBeInTheDocument();
  });
});
```

**HabitsPanel.test.tsx rewrites** (role + target change; color pin stays):

```tsx
it('shows the empty state once loaded with no habits', async () => {
  render(<HabitsPanel />);
  const cta = await screen.findByRole('link', { name: 'No habits yet — create one.' });
  expect(cta).toHaveAttribute('href', '/add-habit');
  expect(cta).toHaveAttribute('data-next-link');
});

it('shimmers the loading line and prints New habit on the accent token (slice D)', async () => {
  render(<HabitsPanel />);   // habits undefined → the loading harness
  const loading = screen.getByText('Loading…');
  expect(loading.className).toContain('skeleton');
  const add = await screen.findByRole('link', { name: /new habit/i });
  expect(add.className).toContain('text-[var(--color-on-accent)]');
  expect(add.className).not.toContain('text-white');
});
```

Run → red.

### Implementation

```tsx
// src/app/habits/page.tsx
'use client';

import { NavShell } from '@/components/NavShell';
import { HabitsScreen } from '@/components/HabitsScreen';

export default function HabitsPage() {
  return (
    <NavShell>
      <HabitsScreen />
    </NavShell>
  );
}
```

```tsx
// src/components/HabitsScreen.tsx
'use client';

import { HabitsPanel } from './HabitsPanel';

export function HabitsScreen() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Habits</h1>
      <HabitsPanel />
    </div>
  );
}
```

`SettingsScreen.tsx`: delete the `HabitsPanel` import and its `<HabitsPanel />` line
(h1 + ThemePanel + DataPanel stay, order unchanged).

`HabitsPanel.tsx`:

1. `import Link from 'next/link';`
2. “New habit” button →
   ```tsx
   <Link href="/add-habit"
          className="flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 py-2.5 text-sm font-semibold text-[var(--color-on-accent)]">
     <Plus size={15} /> New habit
   </Link>
   ```
3. Empty state →
   ```tsx
   ) : habits.length === 0 ? (
     <Link href="/add-habit" className="block p-6 text-center text-sm text-[var(--color-subtle)]">
       No habits yet — create one.
     </Link>
   ) : (
   ```
4. Keep `blankHabit` export (Task 4 imports it), keep edit/reorder/delete flows untouched.

### Run → green. Gates. Stage the six files listed above.

**Commit:** `feat(habits): dedicated Habits page, slim Settings (slice E R3)`

---

## Task 6 — Calendar page

**Files:** new `src/components/CalendarScreen.tsx`, new `src/components/CalendarScreen.test.tsx`,
new `src/app/calendar/page.tsx`, edit `src/components/tapTargets.test.ts` (cell size pin).

### Tests first (red)

```tsx
// src/components/CalendarScreen.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { fromKey, todayKey, toKey } from '@/lib/dates';
import { CalendarScreen } from './CalendarScreen';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/calendar',
}));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
// Label date part must match CalendarScreen: `October 3`, unpadded (spec R5 examples)
const labelDate = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); });

describe('CalendarScreen (slice E R5)', () => {
  it('keeps month names out of prerendered HTML (clock-independent build)', () => {
    const html = renderToString(<CalendarScreen />);
    for (const m of MONTHS) expect(html).not.toContain(m);
  });

  it('renders Monday-first weekday headers in order', async () => {
    const { container } = render(<CalendarScreen />);
    await screen.findByText('Mon');
    const text = container.textContent ?? '';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach((d, i) => {
      expect(text.indexOf(d)).toBeGreaterThan(-1);
      if (i > 0) expect(text.indexOf(d)).toBeGreaterThan(text.indexOf(days[i - 1]));
    });
  });

  it('labels today with aria-current and its route', async () => {
    render(<CalendarScreen />);
    const cell = await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: `));
    expect(cell).toHaveAttribute('aria-current', 'date');
    expect(cell).toHaveAttribute('href', `/today/${todayKey()}`);
  });

  it('is frequency-aware: a due day reports 0 of N until completed', async () => {
    await putHabit(habit());                       // daily, not done today
    render(<CalendarScreen />);
    await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: 0 of 1 done, 0%$`));
  });

  it('reports a completed day with 100% and a filled dot', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, todayKey(), 1);
    render(<CalendarScreen />);
    const cell = await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: 1 of 1 done, 100%$`));
    expect(cell.innerHTML).toContain('bg-[var(--color-accent)]');     // filled dot
    expect(cell.innerHTML).not.toContain('border-[var(--color-subtle)]');
  });

  it('labels a never-due day “nothing scheduled” (empty frequency = never due)', async () => {
    await putHabit(habit({ frequency: [] }));
    render(<CalendarScreen />);
    await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: nothing scheduled$`));
  });

  it('keeps future days neutral and non-interactive (spec R5)', async () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    const cell = await screen.findByLabelText(/: upcoming$/);
    expect(cell.tagName).toBe('SPAN');
    expect(cell).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: /upcoming$/ })).not.toBeInTheDocument();
  });

  it('routes a tapped past day to /today/<key>', async () => {
    const d = fromKey(todayKey());
    const prev15 = toKey(new Date(d.getFullYear(), d.getMonth() - 1, 15));   // always past
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    const cell = await screen.findByLabelText(new RegExp(`^${labelDate(prev15)}: `));
    expect(cell).toHaveAttribute('href', `/today/${prev15}`);
    expect(cell).toHaveAttribute('data-next-link');
  });

  it('switches months and returns via Today', async () => {
    render(<CalendarScreen />);
    const d = fromKey(todayKey());
    const thisMonth = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    expect(await screen.findByText(thisMonth)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    expect(screen.getByText(`${MONTHS[next.getMonth()]} ${next.getFullYear()}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByText(thisMonth)).toBeInTheDocument();
  });
});
```

Tap-target pin — append to `tapTargets.test.ts`:

```ts
it('calendar day cells are h-11 w-11 (slice E R5: ≥44px)', () => {
  const s = src('CalendarScreen.tsx');
  expect(s).toContain('h-11 w-11');
});
```

Run → red.

### Implementation

```tsx
// src/app/calendar/page.tsx
'use client';

import { NavShell } from '@/components/NavShell';
import { CalendarScreen } from '@/components/CalendarScreen';

export default function CalendarPage() {
  return (
    <NavShell>
      <CalendarScreen />
    </NavShell>
  );
}
```

```tsx
// src/components/CalendarScreen.tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listHabits, loadRange } from '@/lib/repo';
import { classifyDate, fromKey, monthGrid, todayKey, toKey } from '@/lib/dates';
import { buildDayStats } from '@/lib/stats';
import { useLiveQuery } from '@/lib/useLiveQuery';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** `October 3` — unpadded, matches the spec's aria-label examples (R5). */
const labelDate = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;

export function CalendarScreen() {
  const today = todayKey();
  const todayDate = fromKey(today);
  const [mounted, setMounted] = useState(false);
  const [cursor, setCursor] = useState({ y: todayDate.getFullYear(), m: todayDate.getMonth() }); // m 0-based

  useEffect(() => setMounted(true), []);

  const monthStart = toKey(new Date(cursor.y, cursor.m, 1));
  const monthEnd = toKey(new Date(cursor.y, cursor.m + 1, 0));

  const habits = useLiveQuery(() => listHabits(), []);
  const entries = useLiveQuery(() => loadRange(monthStart, monthEnd), [monthStart, monthEnd]);

  const stats = useMemo(
    () => (habits && entries ? buildDayStats(habits, entries, { from: monthStart, to: monthEnd }) : undefined),
    [habits, entries, monthStart, monthEnd],
  );
  const grid = useMemo(() => monthGrid(cursor.y, cursor.m + 1), [cursor]);

  const step = (n: number) =>
    setCursor(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goToday = () => setCursor({ y: todayDate.getFullYear(), m: todayDate.getMonth() });

  const skeletonGrid = (
    <div className="grid grid-cols-7 justify-items-center gap-1" aria-hidden>
      {Array.from({ length: 35 }, (_, i) => <span key={i} className="skeleton h-11 w-11" />)}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Calendar</h1>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => step(-1)}
                  className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-muted)]">
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-36 text-center text-sm font-bold">
            {mounted ? `${MONTHS[cursor.m]} ${cursor.y}` : <span className="skeleton inline-block h-5 w-28" />}
          </p>
          <button type="button" aria-label="Next month" onClick={() => step(1)}
                  className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-muted)]">
            <ChevronRight size={18} />
          </button>
        </div>
        <button type="button" onClick={goToday}
                className="min-h-10 rounded-full px-3 py-2 text-sm font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-muted)]">
          Today
        </button>
      </div>

      {/* Monday-first headers (spec R5; matches the heatmap's week start) */}
      <div aria-hidden className="grid grid-cols-7 justify-items-center pb-1 text-center text-xs font-semibold text-[var(--color-subtle)]">
        {WEEKDAYS.map((d) => (
          <span key={d} className="flex h-8 w-11 items-center justify-center">{d}</span>
        ))}
      </div>

      {!mounted || !stats ? (
        skeletonGrid
      ) : (
        <div className="grid grid-cols-7 justify-items-center gap-1">
          {grid.map((key, i) => {
            if (!key) return <span key={`blank-${i}`} aria-hidden className="h-11 w-11" />;
            const kind = classifyDate(key, today);
            const stat = stats.get(key);

            const label =
              kind === 'future'
                ? `${labelDate(key)}: upcoming`
                : stat && stat.scheduled > 0
                  ? `${labelDate(key)}: ${stat.completed} of ${stat.scheduled} done, ${Math.round(stat.ratio * 100)}%`
                  : `${labelDate(key)}: nothing scheduled`;

            // Spec R5: filled = perfect; hollow = active but not perfect;
            // no dot = untouched / unscheduled / no data. Future never implies failure.
            const dot =
              kind === 'future' || !stat
                ? 'none'
                : stat.perfect
                  ? 'filled'
                  : stat.active
                    ? 'hollow'
                    : 'none';

            const content = (
              <>
                <span aria-hidden>{Number(key.slice(8))}</span>
                {dot !== 'none' && (
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      dot === 'filled'
                        ? 'bg-[var(--color-accent)]'
                        : 'border border-[var(--color-subtle)]'
                    }`}
                  />
                )}
              </>
            );
            const base = 'flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sm';

            if (kind === 'future') {
              return (
                <span key={key} aria-disabled="true" aria-label={label}
                      className={`${base} text-[var(--color-subtle)]`}>
                  {content}
                </span>
              );
            }
            return (
              <Link key={key} href={`/today/${key}`} aria-label={label}
                    aria-current={key === today ? 'date' : undefined}
                    className={`${base} hover:bg-[var(--color-muted)]${key === today ? ' ring-2 ring-[var(--color-accent)]' : ''}`}>
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

Notes:
- Everything date-derived is gated on `mounted` (and indicators on `stats`) so prerendered
  HTML is clock-independent and no wrong “nothing scheduled” label flashes while entries load.
- Entries come from `loadRange(monthStart, monthEnd)`; scheduled counts from `buildDayStats`
  over the same window — frequency-aware by construction.
- Past/today cells are links (client-side `next/link`); future cells are inert spans.

### Run → green. Gates. Stage the three files + `tapTargets.test.ts`.

**Commit:** `feat(calendar): month grid with completion indicators (slice E R5)`

---

## Task 7 — Home streak summary strip

**Files:** new `src/components/StreakStrip.tsx`, new `src/components/StreakStrip.test.tsx`,
edit `src/components/HomeScreen.tsx`, edit `src/components/HomeScreen.test.tsx`.

### Tests first (red)

```tsx
// src/components/StreakStrip.test.tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '@/lib/dates';
import type { Entry, Habit } from '@/lib/types';
import { StreakStrip } from './StreakStrip';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});
const entry = (date: string, value = 1): Entry => ({
  id: `h1_${date}`, habitId: 'h1', date, value, timestamp: 0,
});
const strip = () => screen.getByRole('region', { name: 'Streak summaries' });

describe('StreakStrip (slice E R2)', () => {
  it('summarizes best streak, count on a streak, and today', () => {
    const t = todayKey();
    render(<StreakStrip habits={[habit()]} entries={[entry(t)]} today={t} />);
    const s = strip();
    expect(within(s).getByText('Meditate')).toBeInTheDocument();
    expect(within(s).getByText('1 day')).toBeInTheDocument();
    expect(within(s).getByText('1 of 1 habits on a streak')).toBeInTheDocument();
    expect(within(s).getByText('1 of 1 done')).toBeInTheDocument();
    expect(within(s).getByTestId('flame-badge')).toBeInTheDocument();
  });

  it('uses the warm zero-state copy when no streak exists (spec R2 exact copy)', () => {
    const t = todayKey();
    render(<StreakStrip habits={[habit()]} entries={[]} today={t} />);
    const s = strip();
    expect(within(s).getByText('0 days')).toBeInTheDocument();
    expect(within(s).getByText('Start today — streaks build as you go')).toBeInTheDocument();
    expect(within(s).getByText('0 of 1 habits on a streak')).toBeInTheDocument();
    expect(within(s).getByText('0 of 1 done')).toBeInTheDocument();
    expect(within(s).queryByTestId('flame-badge')).not.toBeInTheDocument();   // FlameBadge hides 0
  });

  it('says nothing scheduled when no habit is due', () => {
    const t = todayKey();
    render(<StreakStrip habits={[habit({ frequency: [] })]} entries={[]} today={t} />);
    expect(strip()).toHaveTextContent('Nothing scheduled today');
  });

  it('picks the best of several streaks', () => {
    const t = todayKey();
    const y = addDays(t, -1);
    const other: Habit = { ...habit(), id: 'h2', name: 'Stretch' };
    render(
      <StreakStrip
        habits={[habit(), other]}
        entries={[
          entry(t),                                                 // h1 Meditate: 1 day
          { ...entry(t), habitId: 'h2', id: `h2_${t}` },            // h2 Stretch: today…
          { ...entry(y), habitId: 'h2', id: `h2_${y}` },            // …+ yesterday = 2 days
        ]}
        today={t}
      />,
    );
    expect(within(strip()).getByText('Stretch')).toBeInTheDocument();
    expect(within(strip()).getByText('2 days')).toBeInTheDocument();
    expect(within(strip()).getByText('2 of 2 habits on a streak')).toBeInTheDocument();
  });
});
```

Home integration — add to `HomeScreen.test.tsx`:

```tsx
it('shows the streak summary strip when habits exist (slice E R2)', async () => {
  await putHabit(habit({ name: 'Meditate' }));
  render(<HomeScreen date={todayKey()} />);
  expect(await screen.findByRole('region', { name: 'Streak summaries' })).toBeInTheDocument();
});

it('hides the strip when there are no habits (slice E R2)', async () => {
  render(<HomeScreen date={todayKey()} />);
  await screen.findByText('Create your first habit');
  expect(screen.queryByRole('region', { name: 'Streak summaries' })).not.toBeInTheDocument();
});
```

Run → red.

### Implementation

```tsx
// src/components/StreakStrip.tsx
'use client';

import { useMemo } from 'react';
import { habitStreaks } from '@/lib/streaks';
import { buildDayStats } from '@/lib/stats';
import type { Entry, Habit } from '@/lib/types';
import { FlameBadge } from './FlameBadge';

/** Slice E R2: three glance-cards above the masonry. Copy is exact; never shames. */
export function StreakStrip({ habits, entries, today }: { habits: Habit[]; entries: Entry[]; today: string }) {
  const streaks = useMemo(() => habitStreaks(habits, entries, today), [habits, entries, today]);
  const todayStat = useMemo(
    () => buildDayStats(habits, entries, { from: today, to: today }).get(today),
    [habits, entries, today],
  );

  const best = Math.max(0, ...Object.values(streaks));
  const bestHabit = habits.find((h) => streaks[h.id] === best);
  const onStreak = habits.filter((h) => (streaks[h.id] ?? 0) > 0).length;

  const label = 'text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]';

  return (
    <section aria-label="Streak summaries" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="glass-card p-4">
        <p className={label}>Best streak</p>
        {best > 0 && bestHabit ? (
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{bestHabit.name}</p>
              <p className="text-sm text-[var(--color-subtle)]">{best} {best === 1 ? 'day' : 'days'}</p>
            </div>
            <FlameBadge count={best} />
          </div>
        ) : (
          <>
            <p className="mt-1 text-lg font-extrabold">0 days</p>
            <p className="text-sm text-[var(--color-subtle)]">Start today — streaks build as you go</p>
          </>
        )}
      </div>

      <div className="glass-card p-4">
        <p className={label}>On a streak</p>
        <p className="mt-1 text-lg font-extrabold">{onStreak} of {habits.length} habits on a streak</p>
      </div>

      <div className="glass-card p-4">
        <p className={label}>Today</p>
        {todayStat && todayStat.scheduled > 0 ? (
          <p className="mt-1 text-lg font-extrabold">
            {todayStat.completed} of {todayStat.scheduled} done
          </p>
        ) : (
          <p className="mt-1 text-lg font-extrabold">Nothing scheduled today</p>
        )}
      </div>
    </section>
  );
}
```

**HomeScreen integration** — after `<DateStrip … />` (line ~172), before the
loading/empty/groups conditional:

```tsx
{habits !== undefined && entries !== undefined && habits.length > 0 && (
  <StreakStrip habits={habits} entries={entries} today={date} />
)}
```

plus `import { StreakStrip } from './StreakStrip';`. This satisfies “rendered only when
habits exist” for every branch (empty → CTA, loading → skeleton, nothing-scheduled →
strip still shows with card 3 = *Nothing scheduled today*, which is the useful view there).

**Expected test fallout in `HomeScreen.test.tsx`:** some existing assertions query
`screen.getByText(...)` for elements the strip may now precede — only adjust if a query
actually breaks; the strip adds nodes but changes none. If `getAllByRole` counts shift
anywhere, rewrite the count to the new expectation (never drop the assertion).

### Run → green. Gates. Stage the four files.

**Commit:** `feat(home): streak summary strip on the dashboard (slice E R2)`

---

## Task 8 — Route cutover: Home at `/`, `/insights`, legacy redirects

**Files:**
- rewrite `src/app/page.tsx` (Home instead of `redirect('/today')`)
- rewrite `src/app/today/page.tsx` (server `redirect('/')`)
- rewrite `src/app/stats/page.tsx` (server `redirect('/insights')`)
- new `src/app/insights/page.tsx`
- edit `src/app/today/[date]/page.tsx` (both `redirect('/today')` → `redirect('/')`, comment)
- edit `src/components/HomeScreen.tsx` (DateStrip: today → `/`)
- edit `src/components/HomeScreen.test.tsx` (add today → `/` pin)
- new `src/app/page.test.tsx`, new `src/app/today/page.test.tsx`, new `src/app/stats/page.test.tsx`
- edit `src/app/today/[date]/page.test.tsx` (redirect target rewrites)

### Tests first (red)

```tsx
// src/app/today/page.test.tsx
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
import TodayPage from './page';

describe('/today', () => {
  it('redirects to / (slice E R2)', () => {
    expect(() => TodayPage()).toThrow('NEXT_REDIRECT:/');
  });
});
```

```tsx
// src/app/stats/page.test.tsx
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
import StatsPage from './page';

describe('/stats', () => {
  it('redirects to /insights (slice E R6)', () => {
    expect(() => StatsPage()).toThrow('NEXT_REDIRECT:/insights');
  });
});
```

```tsx
// src/app/page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

describe('/ (slice E R2)', () => {
  it('renders Home inside the nav shell', async () => {
    const { container } = render(<Page />);
    expect(container.querySelectorAll('.bg-scene')).toHaveLength(1);
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });
});
```

`src/app/today/[date]/page.test.tsx` rewrites (both occurrences):

```tsx
it('future date redirects to /', () => {
  expect(() => render(<DayPage params={paramsOf('2099-01-01')} />)).toThrow(/NEXT_REDIRECT:\/$/);
});
it('redirects for a malformed date', () => {
  expect(() => render(<DayPage params={paramsOf('not-a-date')} />)).toThrow(/NEXT_REDIRECT:\/$/);
});
```

`HomeScreen.test.tsx` addition:

```tsx
it('routes a tapped today cell to Home (slice E R2)', () => {
  render(<HomeScreen date={todayKey()} />);
  screen.getByRole('button', { name: todayKey() }).click();
  expect(push).toHaveBeenCalledWith('/');
});
```

Run → red.

### Implementation

```tsx
// src/app/page.tsx
'use client';

import { NavShell } from '@/components/NavShell';
import { HomeScreen } from '@/components/HomeScreen';

export default function HomePage() {
  return (
    <NavShell>
      <HomeScreen />
    </NavShell>
  );
}
```

```tsx
// src/app/today/page.tsx
import { redirect } from 'next/navigation';

export default function TodayPage() {
  redirect('/');            // slice E R2: Home consolidated at /
}
```

```tsx
// src/app/stats/page.tsx
import { redirect } from 'next/navigation';

export default function StatsPage() {
  redirect('/insights');    // slice E R6
}
```

```tsx
// src/app/insights/page.tsx
'use client';

import { NavShell } from '@/components/NavShell';
import { InsightsScreen } from '@/components/InsightsScreen';

export default function InsightsPage() {
  return (
    <NavShell>
      <InsightsScreen />
    </NavShell>
  );
}
```

`src/app/today/[date]/page.tsx`: both `redirect('/today')` → `redirect('/')`; update the
comment block (“redirects to `/`, which renders Home — the same screen”).

`HomeScreen.tsx` DateStrip (line ~172):

```tsx
onSelect={(key) => router.push(key === today ? '/' : `/today/${key}`)}
```

### Run → green. **Then verify the build route table:** `npm run build` must show
`/`, `/habits`, `/add-habit`, `/calendar`, `/insights`, `/settings` as static `○`,
`/today/[date]` as `ƒ`, and `/today` + `/stats` generated without errors.
Gates. Stage the listed paths.

**Commit:** `feat(routes): Home at /, /insights, legacy redirects (slice E R2/R6)`

---

## Task 9 — Nav restructure: five tabs, FAB, sidebar Add

**Files:** edit `src/components/NavShell.tsx`, rewrite `src/components/NavShell.test.tsx`,
edit `src/components/tapTargets.test.ts`.

### Tests first (red) — full replacement of `NavShell.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavShell } from './NavShell';

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn(() => '/') }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const fab = () => document.querySelector('a[aria-label="Add a habit"][href="/add-habit"]');

describe('NavShell (slice E R1)', () => {
  beforeEach(() => pathname.mockReturnValue('/'));

  it('renders all five destinations in both nav variants', () => {
    render(<NavShell><main>content</main></NavShell>);
    for (const [name, href] of [
      ['Home', '/'], ['Habits', '/habits'], ['Calendar', '/calendar'],
      ['Insights', '/insights'], ['Settings', '/settings'],
    ] as const) {
      const links = screen.getAllByRole('link', { name });
      expect(links).toHaveLength(2);                    // sidebar + bottom bar
      for (const l of links) expect(l).toHaveAttribute('href', href);
    }
  });

  it('offers Add habit from the desktop sidebar (not as a tab)', () => {
    render(<NavShell><main>c</main></NavShell>);
    const adds = screen.getAllByRole('link', { name: 'Add habit' });  // FAB says "Add a habit"
    expect(adds).toHaveLength(1);
    expect(adds[0]).toHaveAttribute('href', '/add-habit');
  });

  it('lights Home on /', () => {
    render(<NavShell><main>c</main></NavShell>);
    for (const l of screen.getAllByRole('link', { name: 'Home' }))
      expect(l).toHaveAttribute('aria-current', 'page');
    for (const l of screen.getAllByRole('link', { name: 'Insights' }))
      expect(l).not.toHaveAttribute('aria-current');
  });

  it('keeps Home lit on /today/<date> (date view is Home, spec R1)', () => {
    pathname.mockReturnValue('/today/2026-10-03');
    render(<NavShell><main>c</main></NavShell>);
    for (const l of screen.getAllByRole('link', { name: 'Home' }))
      expect(l).toHaveAttribute('aria-current', 'page');
  });

  it('lights Habits on /habits', () => {
    pathname.mockReturnValue('/habits');
    render(<NavShell><main>c</main></NavShell>);
    for (const l of screen.getAllByRole('link', { name: 'Habits' }))
      expect(l).toHaveAttribute('aria-current', 'page');
  });

  it('lights no tab on /add-habit', () => {
    pathname.mockReturnValue('/add-habit');
    render(<NavShell><main>c</main></NavShell>);
    expect(screen.queryAllByRole('link', { name: /home|habits|calendar|insights|settings/i })
      .filter((l) => l.getAttribute('aria-current') === 'page')).toHaveLength(0);
  });

  it('shows the FAB on Home, date views, and Habits only', () => {
    for (const p of ['/', '/today/2026-10-03', '/habits']) {
      pathname.mockReturnValue(p);
      const { unmount } = render(<NavShell><main>c</main></NavShell>);
      expect(fab()).not.toBeNull();
      unmount();
    }
    for (const p of ['/calendar', '/insights', '/settings', '/add-habit']) {
      pathname.mockReturnValue(p);
      const { unmount } = render(<NavShell><main>c</main></NavShell>);
      expect(fab()).toBeNull();
      unmount();
    }
  });

  it('reserves bottom room for the FAB (spec V6: never covers the last row)', () => {
    pathname.mockReturnValue('/');
    const a = render(<NavShell><main>c</main></NavShell>);
    expect(a.container.querySelector('main')!.parentElement!.className).toContain('pb-40');
    a.unmount();
    pathname.mockReturnValue('/calendar');
    const b = render(<NavShell><main>c</main></NavShell>);
    expect(b.container.querySelector('main')!.parentElement!.className).toContain('pb-24');
  });

  // ——— slice D pins, carried forward (labels updated to Home) ———
  it('mounts the background scene exactly once behind the content (slice D R3)', () => {
    const { container } = render(<NavShell><main>content</main></NavShell>);
    expect(container.querySelectorAll('.bg-scene')).toHaveLength(1);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders its children', () => {
    render(<NavShell><main>content</main></NavShell>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('frosts both nav variants and drops the opaque canvas (slice D R5)', () => {
    const { container } = render(<NavShell><main>c</main></NavShell>);
    const navs = container.querySelectorAll('nav[aria-label="Primary"]');
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(nav.className).toContain('glass-nav');
      expect(nav.className).not.toContain('bg-[var(--color-bg)]');
    }
    expect(navs[0].className).toContain('border-r');
    expect(navs[1].className).toContain('border-t');
  });

  it('prints active tabs with the on-accent/ink tokens (slice D R1 contrast)', () => {
    render(<NavShell><main>c</main></NavShell>);
    const home = screen.getAllByRole('link', { name: 'Home' });   // [0] sidebar, [1] bottom bar
    expect(home[0].className).toContain('bg-[var(--color-accent)]');
    expect(home[0].className).toContain('text-[var(--color-on-accent)]');
    expect(home[1].className).toContain('text-[var(--color-accent-ink)]');
    expect(home[1].className).not.toContain('text-[var(--color-accent)]');
  });
});
```

> Note: `getAllByRole('link', { name: 'Home' })` returns sidebar-first because the sidebar
> nav renders before the content wrapper (and the FAB, whose label differs, sits inside it).

Tap-target pin — append to `tapTargets.test.ts`:

```ts
it('the mobile FAB is a 56px circle (slice E R1: ≥44px)', () => {
  const s = src('NavShell.tsx');
  expect(s).toMatch(/aria-label="Add a habit"[\s\S]{0,340}h-14 w-14/);
});
```

Run → red.

### Implementation (`src/components/NavShell.tsx`)

1. Imports: add `House` (or `Home` — whichever `lucide-react@0.469` exports; typecheck decides),
   `ListChecks`, `CalendarDays`, `Plus`; keep `BarChart3`, `Settings`, `Flame`, `TriangleAlert`.
   (`CalendarCheck` no longer needed once Today drops out of TABS.)
2. Tabs + active rule:

```tsx
const TABS = [
  { href: '/', label: 'Home', Icon: House },
  { href: '/habits', label: 'Habits', Icon: ListChecks },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { href: '/insights', label: 'Insights', Icon: BarChart3 },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const;
```

```tsx
const pathname = usePathname();
// '/' is special: the per-day view /today/<date> is Home content (spec R1)
const isActive = (href: string) =>
  href === '/'
    ? pathname === '/' || pathname.startsWith('/today')
    : pathname === href || pathname.startsWith(`${href}/`);
const showFab = pathname === '/' || pathname.startsWith('/today') || pathname === '/habits';
```

3. Sidebar: after the wordmark blocks, before `TABS.map`:

```tsx
<Link href="/add-habit" title="Add habit" aria-label="Add habit"
      className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-3 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] xl:justify-start">
  <Plus size={18} />
  <span className="hidden xl:inline">Add habit</span>
</Link>
```

4. Content wrapper: `className={showFab ? 'min-w-0 flex-1 pb-40 md:pb-0' : 'min-w-0 flex-1 pb-24 md:pb-0'}` —
   when the FAB is up, the extra 160px keeps the last habit row clear of it (spec V6).
5. FAB, inside the content wrapper after `{children}`:

```tsx
{showFab && (
  <Link href="/add-habit" aria-label="Add a habit"
        className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-lg transition-transform active:scale-95 md:hidden">
    <Plus size={22} />
  </Link>
)}
```

   z-40 = bottom-bar level (below Sheet z-50 / toast z-[60], above content); `md:hidden`
   (desktop uses the sidebar button); ≥44 px (56). Keep it static — no hover/press
   transforms (motion-safe by default; the repo's reduced-motion guarantees cover
   only the CSS-driven blob/reveal system).
6. Both `TABS.map` blocks render unchanged otherwise (labels hidden `md`, shown `xl`;
   `aria-current` logic unchanged).

### Run → green. Gates. Stage `NavShell.tsx NavShell.test.tsx tapTargets.test.ts`.

**Commit:** `feat(nav): five-destination nav, FAB, sidebar Add (slice E R1)`

---

## Task 10 — Verification (no code unless something fails)

1. **Full gates:** `npm test` → `npm run typecheck` → `npm run lint` → `npm run build`.
   Build route table check: `/`, `/add-habit`, `/calendar`, `/habits`, `/insights`,
   `/settings` static `○`; `/today/[date]` `ƒ`; `/today`, `/stats` present (redirects).
2. **V5 walkthrough** — `npm run start`, then browser at `http://localhost:3000`:
   - lands on Home: DateStrip, streak strip (3 cards), today's habits, header flame/`+`
   - header `+` and FAB (mobile width) → `/add-habit`; Health segment → *Steps* tile →
     form prefilled (name/icon/color/category/intention/target/unit/every-day) → Save →
     lands on `/habits`, Steps listed under Health
   - Home now groups the new habit; strip counts updated
   - Calendar: Monday-first headers, today ring, indicators, tap a past day → detail view,
     Home tab still lit on return to `/today/…`
   - Insights renders full stats (heatmap/year tiles); `/stats` URL → `/insights`,
     `/today` URL → `/` (check with `curl -I`/browser)
   - Settings: no habits panel; Habits tab: full management (edit/reorder/delete)
   - nav: five tabs bottom + sidebar with Add button; FAB absent on Calendar/Insights/
     Settings/Add Habit
3. **V6 spot-checks:** keyboard tab-order + focus rings on new controls; labels readable
   at 360 px width (5 tabs fit, no horizontal scroll); dark and light themes; last habit
   row not covered by the FAB; `prefers-reduced-motion` still inert for blobs/reveals.
4. **V7 regression:** complete/quantity/timer rows, timer modal, value sheet, reorder,
   delete, theme toggle, import/export, completion toast — all as before the slice.
5. **Git hygiene:** every commit used exact staging; `git status` shows only the
   pre-existing untracked `.opencode/` + `opencode.json` (never staged).
6. **Push/deploy:** ask the user before pushing (same gate as slice D).

## Deferred (recorded in spec §13 — do not build here)

User-editable templates · “already added” detection · template/seed dedupe ·
inverted/limit semantics · new insights analytics.
