# Challenge Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users join time-boxed challenges (7-day streak on one habit, weekend app-wide intensive, 7-day category sprint) with persisted state, strict perfect-day semantics, and a celebratory win moment.

**Architecture:** Pure rule engine in `src/lib/challenges.ts` (outcome + progress functions, no I/O) evaluated against existing `habits`/`entries` data — challenge progress is always derived, never stored. Instances persist in a new Dexie `challenges` store (schema v2, additive). A repo-layer `evaluateChallenges()` runs at boot, after entry writes, and on challenges-surface loads; UI is a new `/challenges` page, a Home strip, and a transition-only win overlay mirroring the existing CompletionToast store pattern.

**Tech Stack:** Next.js 15 App Router, React 19, Dexie 4 (fake-indexeddb in tests), Tailwind v4, lucide-react, vitest + testing-library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-challenges-design.md`

## Global Constraints

- No new runtime dependencies — only `dexie`, `lucide-react`, `next`, `react` (see `package.json`).
- Reuse house scheduling/completion logic (`habitStreaks`, `isCompleted`, `isScheduled` from `src/lib/stats.ts` / `src/lib/streaks.ts`) — never reimplement it.
- Strict perfect-day semantics: missed scheduled day breaks; today never breaks; unscheduled days skip (neither count nor fail).
- One active challenge per type; max 3 concurrent active; joining a type with an active instance replaces it (old → `abandoned`).
- Win checked before fail; terminal statuses (`won`, `failed`, `abandoned`) are never re-evaluated; no vacuous wins (join guards block empty scopes).
- Anti-instant-win guard: `streak7`/`category7` need ≥1 in-scope completion with `entry.timestamp >= startedAt` before they can be won.
- Export is additive: old exports (no `challenges` key) must still import; reset clears challenges.
- Animation: Tailwind `motion-safe:` variants only (existing `toast-in` keyframes in `globals.css`); nothing may escape the existing `prefers-reduced-motion: reduce` block.
- Accessibility: real buttons/links, visible focus, ≥44px touch targets on join/dismiss, status never color/shape-only (always pair ✓/✗ with "Won"/"Failed" text), `aria-live="polite"` win announcement.
- Copy: warm short coach voice; challenge titles are exactly "7-Day Streak", "Weekend Warrior", "Category Sprint".
- Lint must stay at 0 errors and introduce no new warnings; typecheck and build stay clean.

## Review Focus

These are the inputs/conditions most likely to bite a user; each has a pinned test in the owning task:

1. **Joining a weekend challenge on a Sunday** must target the *next* weekend, not the one ending today → Task 2, `weekend window` tests.
2. **A user with a pre-existing 7+ day streak joining `streak7`** must stay `active` (no instant win) until they complete the habit after joining → Task 2, anti-instant-win tests.
3. **Importing an old export file with no `challenges` key** must not crash and must not resurrect stale challenges → Task 4, import tests.
4. **The 3-challenge cap and same-type replacement** (old instance → `abandoned`, never a duplicate active of one type) → Task 3, `joinChallenge` tests.
5. **The win overlay must never replay on boot** for an already-won challenge — evaluation returns a transition only once → Task 4 (transition-only test) + Task 5 (store mechanics).

---

### Task 1: Challenge types + streak7 rule (pure)

**Files:**
- Modify: `src/lib/types.ts` (append)
- Create: `src/lib/challenges.ts`
- Test: `src/lib/challenges.test.ts`

**Interfaces:**
- Consumes: `habitStreaks(habits, entries, today)` from `src/lib/streaks.ts`; `isCompleted(habit, value)` from `src/lib/stats.ts`; `addDays`, `toKey`, `weekdayIndex` from `src/lib/dates.ts`; `Habit`, `Entry` from `src/lib/types.ts`.
- Produces (relied on by every later task):
  - `type ChallengeType = 'streak7' | 'weekend' | 'category7'`
  - `type ChallengeStatus = 'active' | 'won' | 'failed' | 'abandoned'`
  - `interface Challenge { id: string; type: ChallengeType; habitId?: string; category?: string; scopeLabel: string; status: ChallengeStatus; startedAt: number; resultAt?: number }` (in `types.ts`)
  - `challengeOutcome(c: Challenge, habits: Habit[], entries: Entry[], today: string): 'active' | 'won' | 'failed'`
  - `challengeProgress(c: Challenge, habits: Habit[], entries: Entry[], today: string): { label: string; current: number; total: number }`
  - `challengeTitle(type: ChallengeType): string`
  - `weekendWindow(startedAt: number): { saturday: string; sunday: string }`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/challenges.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { challengeOutcome, challengeProgress, challengeTitle, weekendWindow } from './challenges';
import { newId } from './repo';
import type { Challenge, Entry, Habit } from './types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: 0, ...over,
});

const entry = (habitId: string, date: string, value = 1, timestamp = Date.parse(`${date}T12:00:00`)): Entry => ({
  id: `${habitId}_${date}`, habitId, date, value, timestamp,
});

const streak7 = (h: Habit, startedAt: number): Challenge => ({
  id: newId(), type: 'streak7', habitId: h.id, scopeLabel: h.name,
  status: 'active', startedAt,
});

const daysBack = (n: number, today: string): string => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - n);
  // Local-date key (never toISOString, which shifts to UTC — same rule dates.ts follows).
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// Anchor every test on a fixed midweek day (Wednesday) so results never
// depend on the wall clock.
const TODAY = '2026-10-21'; // a Wednesday
const startedBefore = (days: number) => Date.parse(`${daysBack(days, TODAY)}T08:00:00`);

describe('challengeTitle', () => {
  it('maps every type to its scannable title', () => {
    expect(challengeTitle('streak7')).toBe('7-Day Streak');
    expect(challengeTitle('weekend')).toBe('Weekend Warrior');
    expect(challengeTitle('category7')).toBe('Category Sprint');
  });
});

describe('streak7 outcome', () => {
  it('wins at 7 consecutive perfect days with a post-join completion', () => {
    const h = habit();
    // 7 perfect days ending today: today..6 days back
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, daysBack(i, TODAY), 1));
    const c = streak7(h, startedBefore(3)); // joined 3 days ago; entries on days 0-3 post-date the join
    expect(challengeOutcome(c, [h], entries, TODAY)).toBe('won');
  });

  it('stays active below 7 days', () => {
    const h = habit();
    const entries = Array.from({ length: 6 }, (_, i) => entry(h.id, daysBack(i, TODAY), 1));
    expect(challengeOutcome(streak7(h, startedBefore(1)), [h], entries, TODAY)).toBe('active');
  });

  it('fails when a scheduled day after joining was missed', () => {
    const h = habit();
    // Perfect yesterday and today, missed the day in between (2 days ago — post-join).
    const entries = [entry(h.id, daysBack(0, TODAY), 1), entry(h.id, daysBack(1, TODAY), 1)];
    const c = streak7(h, startedBefore(3));
    expect(challengeOutcome(c, [h], entries, TODAY)).toBe('failed');
  });

  it('never fails on a miss that predates the join (G2: pre-existing state counts)', () => {
    const h = habit();
    // Missed 5 and 4 days ago (before join), perfect since (days 3..0).
    const entries = Array.from({ length: 4 }, (_, i) => entry(h.id, daysBack(i, TODAY), 1));
    const c = streak7(h, startedBefore(3));
    expect(challengeOutcome(c, [h], entries, TODAY)).toBe('active'); // run = 4 < 7, no post-join miss
  });

  it('anti-instant-win: a pre-existing 7+ day streak stays active until a post-join completion exists', () => {
    const h = habit();
    // 10 perfect days, all completed BEFORE the join timestamp (join is today).
    const entries = Array.from({ length: 10 }, (_, i) =>
      entry(h.id, daysBack(i, TODAY), 1, Date.parse(`${daysBack(i, TODAY)}T07:00:00`)));
    const c = streak7(h, Date.parse(`${TODAY}T12:00:00`)); // joined at noon today
    expect(challengeOutcome(c, [h], entries, TODAY)).toBe('active');
    // Same data plus one completion written after the join → wins.
    const later = [...entries, entry(h.id, TODAY, 1, Date.parse(`${TODAY}T13:00:00`))];
    expect(challengeOutcome(c, [h], later, TODAY)).toBe('won');
  });

  it('skips unscheduled days — they never fail the challenge (G3)', () => {
    const h = habit({ frequency: [1, 3, 5] }); // Mon/Wed/Fri only
    // TODAY is Wednesday. Last 7 calendar days: only Mon/Wed/Fri matter, all completed.
    const scheduled = ['0', '1', '2', '3', '4', '5', '6'].map((n) =>
      entry(h.id, daysBack(Number(n), TODAY), 1)).filter((e) => h.frequency.includes(new Date(`${e.date}T12:00:00`).getDay()));
    const c = streak7(h, startedBefore(6));
    expect(challengeOutcome(c, [h], scheduled, TODAY)).toBe('won');
  });

  it('today never breaks: an incomplete today with a 6-day run stays active, not failed', () => {
    const h = habit();
    const entries = Array.from({ length: 6 }, (_, i) => entry(h.id, daysBack(i + 1, TODAY), 1));
    expect(challengeOutcome(streak7(h, startedBefore(6)), [h], entries, TODAY)).toBe('active');
  });

  it('returns active when the scoped habit is missing (the orphan pass owns that close)', () => {
    const ghost: Challenge = { id: newId(), type: 'streak7', habitId: 'gone', scopeLabel: 'Ghost', status: 'active', startedAt: startedBefore(1) };
    expect(challengeOutcome(ghost, [], [], TODAY)).toBe('active');
  });
});

describe('challengeProgress (streak7)', () => {
  it('reports Day X/7 capped at 7', () => {
    const h = habit();
    const entries = Array.from({ length: 9 }, (_, i) => entry(h.id, daysBack(i, TODAY), 1));
    expect(challengeProgress(streak7(h, startedBefore(1)), [h], entries, TODAY))
      .toEqual({ label: 'Day 7/7', current: 7, total: 7 });
    const short = Array.from({ length: 3 }, (_, i) => entry(h.id, daysBack(i, TODAY), 1));
    expect(challengeProgress(streak7(h, startedBefore(1)), [h], short, TODAY))
      .toEqual({ label: 'Day 3/7', current: 3, total: 7 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/challenges.test.ts`
Expected: FAIL — module `./challenges` not found (and `Challenge` type missing from `types.ts`).

- [ ] **Step 3: Implement**

Append to `src/lib/types.ts`:

```ts
export type ChallengeType = 'streak7' | 'weekend' | 'category7';
export type ChallengeStatus = 'active' | 'won' | 'failed' | 'abandoned';

export interface Challenge {
  id: string;
  type: ChallengeType;
  habitId?: string;        // streak7 scope
  category?: string;       // category7 scope
  scopeLabel: string;      // human-readable scope, shown in UI
  status: ChallengeStatus;
  startedAt: number;       // epoch ms (join time)
  resultAt?: number;       // epoch ms when won/failed/abandoned
}
```

Create `src/lib/challenges.ts`:

```ts
import { addDays, toKey, weekdayIndex } from './dates';
import { habitStreaks } from './streaks';
import { isCompleted } from './stats';
import type { Challenge, ChallengeType, Entry, Habit } from './types';

export type ChallengeOutcome = 'active' | 'won' | 'failed';
export type ChallengeProgress = { label: string; current: number; total: number };

export function challengeTitle(type: ChallengeType): string {
  return type === 'streak7' ? '7-Day Streak'
    : type === 'weekend' ? 'Weekend Warrior'
    : 'Category Sprint';
}

/** Key -> value map for O(1) day lookups (same shape habitStreaks builds). */
const valueMap = (entries: Entry[]): Map<string, number> =>
  new Map(entries.map((e) => [`${e.habitId}|${e.date}`, e.value]));

/**
 * A day is perfect for a scope when every scheduled habit in it is complete.
 * A day with nothing scheduled in scope is skipped: it counts as perfect
 * (streak-preserving) and never fails — the same convention streaks use (G3).
 */
const dayPerfect = (scope: Habit[], values: Map<string, number>, date: string): boolean => {
  for (const h of scope) {
    if (!h.frequency.includes(weekdayIndex(date))) continue;
    if (!isCompleted(h, values.get(`${h.id}|${date}`) ?? 0)) return false;
  }
  return true;
};

/** Consecutive perfect days ending today (today counts only if perfect; a miss before today breaks). */
const scopeRun = (scope: Habit[], entries: Entry[], today: string): number => {
  const values = valueMap(entries);
  let run = dayPerfect(scope, values, today) ? 1 : 0;
  for (let cursor = addDays(today, -1), guard = 0; guard < 36500; cursor = addDays(cursor, -1), guard++) {
    if (dayPerfect(scope, values, cursor)) run++;
    else break;
  }
  return run;
};

/** True when some scheduled in-scope day in [from, to) is not perfect. */
const missedBetween = (scope: Habit[], values: Map<string, number>, from: string, to: string): boolean => {
  for (let cursor = from, guard = 0; cursor < to && guard < 36500; cursor = addDays(cursor, 1), guard++) {
    if (!dayPerfect(scope, values, cursor)) return true;
  }
  return false;
};

/** Anti-instant-win guard: at least one in-scope completion written at/after the join moment. */
const completedSince = (scope: Habit[], entries: Entry[], since: number): boolean => {
  const ids = new Set(scope.map((h) => h.id));
  return entries.some((e) => ids.has(e.habitId) && e.timestamp >= since && isCompleted(scope.find((h) => h.id === e.habitId)!, e.value));
};

/**
 * The first Saturday on/after the join date (join Saturday → that same
 * weekend; join Sunday → next weekend; join midweek → the upcoming one).
 */
export function weekendWindow(startedAt: number): { saturday: string; sunday: string } {
  const joinDay = toKey(new Date(startedAt));
  const delta = (6 - weekdayIndex(joinDay) + 7) % 7; // Sat → 0, Sun → 6, Fri → 1 …
  const saturday = addDays(joinDay, delta);
  return { saturday, sunday: addDays(saturday, 1) };
}

/**
 * Pure evaluation of an ACTIVE challenge. Callers (repo.evaluateChallenges)
 * only pass active instances — terminal statuses are never re-evaluated.
 * Win is checked before fail (spec: win-before-fail ordering).
 */
export function challengeOutcome(c: Challenge, habits: Habit[], entries: Entry[], today: string): ChallengeOutcome {
  if (c.type === 'weekend') {
    const { saturday, sunday } = weekendWindow(c.startedAt);
    const values = valueMap(entries);
    if (dayPerfect(habits, values, saturday) && dayPerfect(habits, values, sunday)) return 'won'; // decided once both days are done
    if (today > sunday) return 'failed'; // the weekend closed with a miss (persists to next open)
    return 'active';
  }

  const scope = c.type === 'streak7'
    ? habits.filter((h) => h.id === c.habitId)
    : habits.filter((h) => h.category === c.category);
  if (scope.length === 0) return 'active'; // orphan closes via the boot orphan pass, not here

  const run = c.type === 'streak7'
    ? habitStreaks(scope, entries, today)[scope[0].id] // single habit: reuse the house run, never reimplement it
    : scopeRun(scope, entries, today);

  if (run >= 7 && completedSince(scope, entries, c.startedAt)) return 'won';
  if (missedBetween(scope, valueMap(entries), toKey(new Date(c.startedAt)), today)) return 'failed';
  return 'active';
}

/** Live progress for the UI. Pure; derives everything from entries. */
export function challengeProgress(c: Challenge, habits: Habit[], entries: Entry[], today: string): ChallengeProgress {
  if (c.type === 'weekend') {
    const { saturday, sunday } = weekendWindow(c.startedAt);
    const values = valueMap(entries);
    const current = Number(dayPerfect(habits, values, saturday)) + Number(dayPerfect(habits, values, sunday));
    return { label: `${current}/2 weekend days`, current, total: 2 };
  }
  const scope = c.type === 'streak7'
    ? habits.filter((h) => h.id === c.habitId)
    : habits.filter((h) => h.category === c.category);
  const run = scope.length === 0 ? 0 : c.type === 'streak7'
    ? habitStreaks(scope, entries, today)[scope[0].id]
    : scopeRun(scope, entries, today);
  const current = Math.min(run, 7);
  return { label: `Day ${current}/7`, current, total: 7 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/challenges.test.ts`
Expected: PASS (all streak7/title/progress tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/challenges.ts src/lib/challenges.test.ts
git commit -m "feat: challenge types and streak7 rule engine (pure)"
```

---

### Task 2: category7 + weekend rules and window math (pure)

**Files:**
- Modify: `src/lib/challenges.ts`
- Test: `src/lib/challenges.test.ts` (append describes)

**Interfaces:**
- Consumes: Task 1's `challengeOutcome`, `challengeProgress`, `weekendWindow`, internal `dayPerfect`/`scopeRun`/`missedBetween`.
- Produces: the same signatures, now handling `category7` and `weekend` fully (no signature changes — later tasks already coded against them).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/challenges.test.ts`:

```ts
describe('category7 outcome', () => {
  const cat7 = (category: string, startedAt: number): Challenge => ({
    id: newId(), type: 'category7', category, scopeLabel: category, status: 'active', startedAt,
  });

  it('wins on 7 consecutive perfect days across the category', () => {
    const a = habit({ id: 'a', name: 'Run', category: 'Health' });
    const b = habit({ id: 'b', name: 'Water', category: 'Health' });
    // Both habits perfect on each of the last 7 days.
    const entries = Array.from({ length: 7 }, (_, i) => [
      entry('a', daysBack(i, TODAY), 1), entry('b', daysBack(i, TODAY), 1),
    ]).flat();
    expect(challengeOutcome(cat7('Health', startedBefore(2)), [a, b], entries, TODAY)).toBe('won');
  });

  it('fails when one habit in the category is missed after joining', () => {
    const a = habit({ id: 'a', category: 'Health' });
    const b = habit({ id: 'b', category: 'Health' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('a', daysBack(i, TODAY), 1)); // b never done
    expect(challengeOutcome(cat7('Health', startedBefore(2)), [a, b], entries, TODAY)).toBe('failed');
  });

  it('ignores habits outside the category', () => {
    const a = habit({ id: 'a', category: 'Health' });
    const other = habit({ id: 'x', category: 'Mind' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('a', daysBack(i, TODAY), 1));
    // x is missed every day — must not affect the Health challenge.
    expect(challengeOutcome(cat7('Health', startedBefore(2)), [a, other], entries, TODAY)).toBe('won');
  });

  it('re-derives scope from current habits (a habit added mid-challenge joins the scope)', () => {
    const a = habit({ id: 'a', category: 'Health' });
    const late = habit({ id: 'late', category: 'Health', createdAt: Date.parse(`${daysBack(1, TODAY)}T12:00:00`) });
    // a perfect for 7 days; late perfect since it appeared (yesterday, today).
    const entries = [
      ...Array.from({ length: 7 }, (_, i) => entry('a', daysBack(i, TODAY), 1)),
      entry('late', daysBack(0, TODAY), 1), entry('late', daysBack(1, TODAY), 1),
    ];
    // late has no entry for days 2-6 (it didn't exist) — but its frequency says
    // scheduled. A scheduled day with no entry is a miss → failed. Pin it so the
    // plan author sees the semantics: NEW habits in scope fail past days unless
    // their createdAt day gates scheduling (isScheduled is NOT used here by
    // design — the spec pins the `category` field scope, days before the habit
    // existed are treated per frequency). This test documents the chosen rule:
    // scope is CURRENT habits; a just-added habit therefore fails its challenge.
    expect(challengeOutcome(cat7('Health', startedBefore(2)), [a, late], entries, TODAY)).toBe('failed');
  });

  it('anti-instant-win: pre-existing 7-day category run stays active until a post-join completion', () => {
    const a = habit({ id: 'a', category: 'Health' });
    const entries = Array.from({ length: 10 }, (_, i) =>
      entry('a', daysBack(i, TODAY), 1, Date.parse(`${daysBack(i, TODAY)}T07:00:00`)));
    const c = cat7('Health', Date.parse(`${TODAY}T12:00:00`));
    expect(challengeOutcome(c, [a], entries, TODAY)).toBe('active');
  });
});

describe('weekend window math', () => {
  it('join Saturday → that same weekend', () => {
    expect(weekendWindow(Date.parse('2026-10-24T09:00:00'))).toEqual({ saturday: '2026-10-24', sunday: '2026-10-25' });
  });

  it('join Sunday → next weekend (Review Focus #1)', () => {
    expect(weekendWindow(Date.parse('2026-10-25T09:00:00'))).toEqual({ saturday: '2026-10-31', sunday: '2026-11-01' });
  });

  it('join midweek → the upcoming Sat–Sun', () => {
    expect(weekendWindow(Date.parse('2026-10-21T09:00:00'))).toEqual({ saturday: '2026-10-24', sunday: '2026-10-25' }); // Wed → this week's Sat
    expect(weekendWindow(Date.parse('2026-10-23T09:00:00'))).toEqual({ saturday: '2026-10-24', sunday: '2026-10-25' }); // Fri → this week's Sat
  });
});

describe('weekend outcome', () => {
  const wk = (startedAt: number): Challenge => ({
    id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'active', startedAt,
  });

  it('wins when both days of the target weekend are perfect app-wide', () => {
    const h = habit();
    // Joined Wednesday 2026-10-21 → weekend is Sat 24 / Sun 25. Both perfect.
    const entries = [entry(h.id, '2026-10-24', 1), entry(h.id, '2026-10-25', 1)];
    expect(challengeOutcome(wk(Date.parse('2026-10-21T09:00:00')), [h], entries, '2026-10-25')).toBe('won');
  });

  it('stays active during the weekend while days are pending', () => {
    const h = habit();
    const entries = [entry(h.id, '2026-10-24', 1)]; // Saturday done, Sunday not yet
    expect(challengeOutcome(wk(Date.parse('2026-10-21T09:00:00')), [h], entries, '2026-10-25')).toBe('active');
  });

  it('fails once Monday arrives with either day missing (time-based fail persists to next open)', () => {
    const h = habit();
    const entries = [entry(h.id, '2026-10-24', 1)]; // Sunday missed
    expect(challengeOutcome(wk(Date.parse('2026-10-21T09:00:00')), [h], entries, '2026-10-26')).toBe('failed'); // Monday
  });

  it('a day with nothing scheduled is perfect (never a vacuous fail)', () => {
    const weekdayOnly = habit({ frequency: [1, 2, 3, 4, 5] });
    // Both weekend days have zero scheduled habits → both perfect → won.
    expect(challengeOutcome(wk(Date.parse('2026-10-21T09:00:00')), [weekdayOnly], [], '2026-10-25')).toBe('won');
  });
});

describe('weekend progress', () => {
  it('counts the two weekend days', () => {
    const h = habit();
    const c: Challenge = { id: newId(), type: 'weekend', scopeLabel: 'All', status: 'active', startedAt: Date.parse('2026-10-21T09:00:00') };
    const entries = [entry(h.id, '2026-10-24', 1)];
    expect(challengeProgress(c, [h], entries, '2026-10-25')).toEqual({ label: '1/2 weekend days', current: 1, total: 2 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/challenges.test.ts`
Expected: NEW weekend/category7 tests FAIL (weekend/category branches unimplemented); Task 1 tests still PASS.

- [ ] **Step 3: Implement**

The Task 1 implementation already contains the `weekend`, `category7`, and `weekendWindow` branches. Run the suite; if any weekend/category7 test fails, adjust the corresponding branch in `src/lib/challenges.ts` — do not change test expectations except the two documented semantics pinned by design:
- Scope is always re-derived from CURRENT habits (the `category7 re-derives scope` test pins this).
- A zero-scheduled day is perfect (the `nothing scheduled` test pins this).

No production code changes are expected beyond minor fixes; the tests exist to pin the semantics.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/challenges.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/challenges.ts src/lib/challenges.test.ts
git commit -m "feat: category7 and weekend challenge rules with window math"
```

---

### Task 3: Dexie schema v2 + challenge repo CRUD + joinChallenge

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/repo.ts` (append)
- Test: `src/lib/repo.test.ts` (append describes)

**Interfaces:**
- Consumes: `Challenge`, `ChallengeType` from `src/lib/types.ts`; `newId()` from `repo.ts`; `db`, `ensureDb` from `src/lib/db.ts`.
- Produces (relied on by Tasks 4–7):
  - `db.challenges: Table<Challenge, string>` (schema v2, indexes `id, type, status, [type+status], startedAt`)
  - `MAX_ACTIVE_CHALLENGES = 3` (exported const)
  - `listChallenges(): Promise<Challenge[]>`
  - `activeChallenges(): Promise<Challenge[]>`
  - `putChallenge(c: Challenge): Promise<Challenge>`
  - `joinChallenge(input: { type: ChallengeType; habitId?: string; category?: string; scopeLabel: string }): Promise<Challenge>` — throws `Error("You can hold up to 3 active challenges at once.")` when the cap is hit and no same-type replacement applies

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/repo.test.ts` (add `Challenge` to the type import and `activeChallenges, joinChallenge, listChallenges, putChallenge` to the repo import):

```ts
describe('challenges (repo)', () => {
  const chal = (over: Partial<Challenge> = {}): Challenge => ({
    id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'active',
    startedAt: Date.now(), ...over,
  });

  it('stores, lists, and upserts challenges by id', async () => {
    await putChallenge(chal({ scopeLabel: 'One' }));
    const c = chal({ scopeLabel: 'Two' });
    await putChallenge(c);
    await putChallenge({ ...c, status: 'won', resultAt: Date.now() });
    const all = await listChallenges();
    expect(all).toHaveLength(2);
    expect(all.find((x) => x.id === c.id)?.status).toBe('won');
  });

  it('lists active challenges via the [type+status] index', async () => {
    await putChallenge(chal({ type: 'streak7', habitId: 'h1' }));
    await putChallenge(chal({ type: 'weekend', status: 'won', resultAt: 1 }));
    const active = await activeChallenges();
    expect(active).toHaveLength(1);
    expect(active[0].type).toBe('streak7');
  });

  it('joinChallenge creates an active instance with startedAt = now', async () => {
    const before = Date.now();
    const c = await joinChallenge({ type: 'streak7', habitId: 'h1', scopeLabel: 'Read' });
    expect(c).toMatchObject({ type: 'streak7', habitId: 'h1', scopeLabel: 'Read', status: 'active' });
    expect(c.startedAt).toBeGreaterThanOrEqual(before);
    expect(await activeChallenges()).toHaveLength(1);
  });

  it('replaces a same-type active instance with `abandoned` (never two actives of one type)', async () => {
    const first = await joinChallenge({ type: 'streak7', habitId: 'h1', scopeLabel: 'Read' });
    const second = await joinChallenge({ type: 'streak7', habitId: 'h2', scopeLabel: 'Run' });
    const all = await listChallenges();
    expect(all.filter((c) => c.status === 'active')).toHaveLength(1);
    const old = all.find((c) => c.id === first.id)!;
    expect(old.status).toBe('abandoned');
    expect(old.resultAt).toBeTypeOf('number');
    expect((await activeChallenges())[0].id).toBe(second.id);
  });

  it('enforces the 3-active cap but a same-type replacement still passes at the cap (Review Focus #4)', async () => {
    await joinChallenge({ type: 'streak7', habitId: 'h1', scopeLabel: 'a' });
    await joinChallenge({ type: 'weekend', scopeLabel: 'b' });
    await joinChallenge({ type: 'category7', category: 'Health', scopeLabel: 'Health' });
    // Cap reached: a fourth DIFFERENT-type join throws …
    await expect(joinChallenge({ type: 'streak7', habitId: 'h2', scopeLabel: 'nope' }))
      .rejects.toThrow('You can hold up to 3 active challenges at once.');
    // … but replacing the existing streak7 (same type) is allowed.
    const replaced = await joinChallenge({ type: 'streak7', habitId: 'h2', scopeLabel: 'retry' });
    expect(replaced.status).toBe('active');
    expect(await activeChallenges()).toHaveLength(3);
  });
});
```

Also add `Challenge` to the existing type import line at the top of `repo.test.ts`: `import type { Challenge, Entry, Habit } from './types';`

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/repo.test.ts`
Expected: FAIL — `putChallenge is not a function` / `db.challenges` undefined.

- [ ] **Step 3: Implement**

In `src/lib/db.ts`, add the import and the v2 delta:

```ts
import type { Challenge, Entry, Habit } from './types';
```

```ts
export class HabibitDexie extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;
  challenges!: Table<Challenge, string>;

  constructor(name = 'habibit') {
    super(name);
    this.version(1).stores({
      habits: 'id, name, category, intention, type, order, createdAt',
      entries: 'id, habitId, date, value, timestamp, [habitId+date]',
    });
    // v2 delta (challenges spec §1): additive only — Dexie creates the new
    // store on upgrade and leaves the v1 tables untouched.
    this.version(2).stores({
      challenges: 'id, type, status, [type+status], startedAt',
    });
  }
}
```

In `src/lib/db.ts`, extend `resetDb` so a raw wipe clears challenges too (same single-transaction rule):

```ts
  await db.transaction('rw', db.habits, db.entries, db.challenges, async () => {
    await db.habits.clear();
    await db.entries.clear();
    await db.challenges.clear();
  });
```

Append to `src/lib/repo.ts` (add `Challenge`, `ChallengeType` to the types import):

```ts
export const MAX_ACTIVE_CHALLENGES = 3;

export async function listChallenges(): Promise<Challenge[]> {
  await ensureDb();
  return db.challenges.toArray();
}

export async function activeChallenges(): Promise<Challenge[]> {
  await ensureDb();
  return db.challenges.where('status').equals('active').toArray();
}

export async function putChallenge(c: Challenge): Promise<Challenge> {
  await ensureDb();
  await db.challenges.put(c);
  return c;
}

/**
 * Join a challenge (challenges spec Q4): one active per type — a same-type
 * active instance is replaced with `abandoned`; at most MAX_ACTIVE_CHALLENGES
 * concurrent actives. All checks and writes run in one transaction.
 */
export async function joinChallenge(input: {
  type: ChallengeType; habitId?: string; category?: string; scopeLabel: string;
}): Promise<Challenge> {
  await ensureDb();
  return db.transaction('rw', db.challenges, async () => {
    const active = await db.challenges.where('status').equals('active').toArray();
    const sameType = active.filter((c) => c.type === input.type);
    if (sameType.length === 0 && active.length >= MAX_ACTIVE_CHALLENGES) {
      throw new Error('You can hold up to 3 active challenges at once.');
    }
    const now = Date.now();
    if (sameType.length) {
      await db.challenges.bulkPut(
        sameType.map((c) => ({ ...c, status: 'abandoned' as const, resultAt: now })),
      );
    }
    const challenge: Challenge = {
      id: newId(),
      type: input.type,
      ...(input.habitId ? { habitId: input.habitId } : {}),
      ...(input.category ? { category: input.category } : {}),
      scopeLabel: input.scopeLabel,
      status: 'active',
      startedAt: now,
    };
    await db.challenges.put(challenge);
    return challenge;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/repo.test.ts src/lib/db.test.ts`
Expected: PASS (repo tests; no `db.test.ts` exists — vitest reports no matching test file for it, which is fine; the repo suite exercises the schema).

- [ ] **Step 5: Run the full suite (schema change touches everything)**

Run: `pnpm test`
Expected: PASS — no regressions (v1 data path unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/repo.ts src/lib/repo.test.ts
git commit -m "feat: challenges Dexie store (schema v2) with join/cap/replace repo"
```

---

### Task 4: Export/import/reset + evaluateChallenges (boot pass)

**Files:**
- Modify: `src/lib/repo.ts`
- Modify: `src/components/NavShell.tsx`
- Test: `src/lib/repo.test.ts` (append describes)

**Interfaces:**
- Consumes: Task 1's `challengeOutcome`; Task 3's store and CRUD.
- Produces (relied on by Tasks 5–7):
  - `exportState()` now returns `{ habits: Habit[]; entries: Entry[]; challenges: Challenge[] }`
  - `importState(data)` accepts an optional `challenges` array (legacy exports without it still import; challenges are cleared then restored when present); structurally invalid challenges reject the file
  - `resetToEmpty()` clears the challenges store
  - `evaluateChallenges(now?: number): Promise<Challenge[]>` — persists won/failed transitions and boot-orphan `abandoned` closes; RETURNS the changed challenges (empty array when nothing transitioned) so callers can celebrate wins exactly once

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/repo.test.ts`:

```ts
describe('challenges export/import/reset', () => {
  const chal = (over: Partial<Challenge> = {}): Challenge => ({
    id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'active',
    startedAt: Date.now(), ...over,
  });

  it('exportState includes challenges', async () => {
    await putHabit(habit());
    await putChallenge(chal());
    const data = await exportState();
    expect(data.challenges).toHaveLength(1);
  });

  it('imports an OLD export with no challenges key without crashing, and clears stale challenges (Review Focus #3)', async () => {
    await putChallenge(chal()); // stale local challenge
    const h = habit();
    await importState({ habits: [h], entries: [] }); // legacy payload: no challenges key
    expect(await listHabits()).toHaveLength(1);
    expect(await listChallenges()).toHaveLength(0); // import replaces the world
  });

  it('restores challenges from a new-style export', async () => {
    const h = habit();
    await putHabit(h);
    const won = chal({ status: 'won', resultAt: 123 });
    await putChallenge(won);
    const data = await exportState();
    await clearAll();
    await importState(data);
    const restored = await listChallenges();
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: won.id, status: 'won', resultAt: 123 });
  });

  it('rejects a file whose challenges are structurally invalid (nothing half-applied)', async () => {
    const h = habit();
    const before = await exportState();
    await expect(importState({
      habits: [h], entries: [],
      challenges: [{ id: 'x', type: 'binge', status: 'active', scopeLabel: '', startedAt: 1 }],
    })).rejects.toThrow();
    expect(await listHabits()).toHaveLength(0); // validation ran before any write
    expect(await listChallenges()).toHaveLength(0);
    expect(before).toBeTruthy();
  });

  it('resetToEmpty clears challenges', async () => {
    await putHabit(habit());
    await putChallenge(chal());
    await resetToEmpty();
    expect(await listChallenges()).toHaveLength(0);
    expect(await hasSeeded()).toBe(true); // marker still claimed
  });
});

describe('evaluateChallenges', () => {
  const chal = (over: Partial<Challenge> = {}): Challenge => ({
    id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'active',
    startedAt: Date.now(), ...over,
  });

  it('transitions a won weekend challenge and returns it exactly once (Review Focus #5)', async () => {
    const h = habit();
    await putHabit(h);
    // Joined Wed 2026-10-21 → weekend Sat 24 / Sun 25, both perfect.
    const c = chal({ startedAt: Date.parse('2026-10-21T09:00:00') });
    await putChallenge(c);
    await putEntry(h.id, '2026-10-24', 1);
    await putEntry(h.id, '2026-10-25', 1);
    const now = Date.parse('2026-10-25T20:00:00'); // Sunday evening

    const first = await evaluateChallenges(now);
    expect(first.map((x) => x.id)).toEqual([c.id]);
    expect((await listChallenges())[0].status).toBe('won');

    // Second pass (e.g. next boot): nothing transitions — no replayed wins.
    expect(await evaluateChallenges(now)).toHaveLength(0);
  });

  it('fails a broken streak7 immediately and stamps resultAt', async () => {
    const h = habit();
    await putHabit(h);
    const c = chal({ type: 'streak7', habitId: h.id, scopeLabel: h.name, startedAt: Date.parse('2026-10-18T09:00:00') });
    await putChallenge(c);
    await putEntry(h.id, '2026-10-19', 1); // perfect yesterday …
    // … but 2026-10-20 (scheduled, post-join) has no entry and today is 2026-10-21.
    const changed = await evaluateChallenges(Date.parse('2026-10-21T12:00:00'));
    expect(changed).toHaveLength(1);
    const after = (await listChallenges())[0];
    expect(after.status).toBe('failed');
    expect(after.resultAt).toBeTypeOf('number');
  });

  it('closes an orphaned active challenge as abandoned at boot', async () => {
    const c = chal({ type: 'streak7', habitId: 'deleted-habit', scopeLabel: 'Ghost', startedAt: Date.now() });
    await putChallenge(c);
    const changed = await evaluateChallenges();
    expect(changed[0].status).toBe('abandoned');
  });

  it('never touches terminal statuses', async () => {
    const h = habit();
    await putHabit(h);
    await putChallenge(chal({ status: 'won', resultAt: 1, startedAt: Date.parse('2026-10-21T09:00:00') }));
    await putChallenge(chal({ status: 'failed', resultAt: 2, startedAt: Date.parse('2026-10-21T09:00:00') }));
    await putChallenge(chal({ status: 'abandoned', resultAt: 3, startedAt: Date.parse('2026-10-21T09:00:00') }));
    expect(await evaluateChallenges(Date.parse('2026-11-01T12:00:00'))).toHaveLength(0);
    const all = await listChallenges();
    expect(all.map((c) => c.resultAt).sort()).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/repo.test.ts`
Expected: NEW describe blocks FAIL (`challenges` missing from export shape; `evaluateChallenges` not a function).

- [ ] **Step 3: Implement**

In `src/lib/repo.ts`:
1. Extend the types import: `import type { Challenge, ChallengeType, Entry, Habit } from './types';`
2. Add `import { challengeOutcome } from './challenges';` and `import { toKey } from './dates';`
3. `exportState` — add the challenges array:

```ts
export async function exportState(): Promise<{ habits: Habit[]; entries: Entry[]; challenges: Challenge[] }> {
  await ensureDb();
  return {
    habits: (await db.habits.toArray()).filter((h) => h.id !== SEED_FLAG_ID),
    entries: (await db.entries.toArray()).filter(
      (e) => e.id !== SEED_FLAG_ID && e.habitId !== SEED_FLAG_ID,
    ),
    challenges: await db.challenges.toArray(),
  };
}
```

4. Add the challenge validator next to `isEntryShape`:

```ts
const isChallengeShape = (x: unknown): boolean => {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    (c.type === 'streak7' || c.type === 'weekend' || c.type === 'category7') &&
    (c.status === 'active' || c.status === 'won' || c.status === 'failed' || c.status === 'abandoned') &&
    typeof c.scopeLabel === 'string' &&
    typeof c.startedAt === 'number' && Number.isFinite(c.startedAt) &&
    (c.habitId === undefined || typeof c.habitId === 'string') &&
    (c.category === undefined || typeof c.category === 'string') &&
    (c.resultAt === undefined || typeof c.resultAt === 'number')
  );
};
```

5. `importState` — accept the optional array. Change the payload type to `{ habits?: unknown; entries?: unknown; challenges?: unknown }`, add after the entries shape check:

```ts
  if (payload.challenges !== undefined && !Array.isArray(payload.challenges)) {
    throw new Error("That file isn't a Habibit export.");
  }
  if (payload.challenges !== undefined && !(payload.challenges as unknown[]).every(isChallengeShape)) {
    throw new Error(VALUES_MESSAGE);
  }
```

And inside the existing transaction — add `db.challenges` to the transaction tables, plus after the entries bulkPut:

```ts
  await db.transaction('rw', db.habits, db.entries, db.challenges, async () => {
    await db.habits.clear();
    await db.entries.clear();
    await db.challenges.clear();                                  // import replaces the world
    await db.habits.bulkPut(habits as Habit[]);
    await db.entries.bulkPut(entries);
    if (payload.challenges !== undefined) {
      await db.challenges.bulkPut(payload.challenges as Challenge[]);
    }
    // …existing seed-marker write stays exactly as-is…
```

6. `resetToEmpty` — add `db.challenges` to the transaction tables and `await db.challenges.clear();` after the entries clear (the seed-marker put stays last).
7. Append the evaluator:

```ts
/**
 * Evaluate every ACTIVE challenge once and persist transitions (challenges
 * spec §2): won/failed from the pure rule engine, plus the boot orphan pass
 * (habit/category gone → abandoned). Returns only the challenges that changed
 * this call — callers celebrate a returned `won` exactly once, since a
 * terminal challenge is never evaluated again.
 */
export async function evaluateChallenges(now = Date.now()): Promise<Challenge[]> {
  await ensureDb();
  const active = await db.challenges.where('status').equals('active').toArray();
  if (active.length === 0) return [];
  const habits = await db.habits.toArray();
  const today = toKey(new Date(now));
  // Entries only from the earliest join day — a challenge never reads history
  // older than its own start for the anti-instant-win guard.
  const from = active.reduce((min, c) => {
    const d = toKey(new Date(c.startedAt));
    return d < min ? d : min;
  }, today);
  const entries = (await db.entries.where('date').between(from, today, true, true).toArray())
    .filter((e) => e.id !== SEED_FLAG_ID);
  const habitIds = new Set(habits.map((h) => h.id));
  const categories = new Set(habits.map((h) => h.category));

  const changed: Challenge[] = [];
  for (const c of active) {
    const orphaned =
      (c.type === 'streak7' && (!c.habitId || !habitIds.has(c.habitId))) ||
      (c.type === 'category7' && (!c.category || !categories.has(c.category)));
    const next: Challenge['status'] | null = orphaned
      ? 'abandoned'
      : (() => {
          const outcome = challengeOutcome(c, habits, entries, today);
          return outcome === 'active' ? null : outcome;
        })();
    if (next) {
      const updated: Challenge = { ...c, status: next, resultAt: now };
      await db.challenges.put(updated);
      changed.push(updated);
    }
  }
  return changed;
}
```

8. In `src/components/NavShell.tsx`, extend the boot pass (add the import `evaluateChallenges` from `@/lib/repo`):

```ts
      void ensureDb().then((s) => {
        setDegraded(s === 'degraded');
        void pruneOrphans().catch(reportWriteError);   // stray entries never reach stats
        void clampLegacyEntries().catch(reportWriteError);   // spec R1 §2.3 boot migration
        void evaluateChallenges().catch(reportWriteError);   // challenges: close weekend/fail orphans
      }).catch(reportWriteError);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm test` then `pnpm typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/repo.ts src/components/NavShell.tsx src/lib/repo.test.ts
git commit -m "feat: challenge export/import/reset and boot evaluation pass"
```

---

### Task 5: Win celebration store + overlay (transition-only)

**Files:**
- Create: `src/lib/challengeWin.ts`
- Create: `src/components/ChallengeWinOverlay.tsx`
- Modify: `src/components/NavShell.tsx`
- Test: `src/lib/challengeWin.test.ts`, `src/components/ChallengeWinOverlay.test.tsx`

**Interfaces:**
- Consumes: Task 3's `Challenge`; `evaluateChallenges()` from Task 4.
- Produces (relied on by Tasks 6–7):
  - `celebrateChallengeWin(c: Challenge): void` — shows the overlay for `AUTO_DISMISS_MS` (4000), replacing any visible win
  - `dismissChallengeWin(): void`
  - `useChallengeWin(): Challenge | null`
  - `celebrateWins(transitions: Challenge[]): void` — convenience: celebrates each returned challenge whose `status === 'won'`
  - `<ChallengeWinOverlay />` mounted in NavShell (renders `null` with no active win)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/challengeWin.test.ts` (mirrors `completionToast.test.ts` mechanics; the store lives outside React, so tests read it through the hook with `renderHook`):
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrateChallengeWin, celebrateWins, dismissChallengeWin, useChallengeWin } from './challengeWin';
import type { Challenge } from './types';

const win = (id = 'c1', status: Challenge['status'] = 'won'): Challenge => ({
  id, type: 'weekend', scopeLabel: 'All habits', status, startedAt: 1, resultAt: 2,
});

beforeEach(() => { dismissChallengeWin(); });

describe('challengeWin store', () => {
  it('publishes a win to subscribers', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateChallengeWin(win()); });
    expect(result.current?.id).toBe('c1');
  });

  it('dismiss clears the win', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateChallengeWin(win()); });
    act(() => { dismissChallengeWin(); });
    expect(result.current).toBeNull();
  });

  it('auto-dismisses after 4s', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateChallengeWin(win()); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBeNull();
    vi.useRealTimers();
  });

  it('celebrateWins ignores non-won transitions', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateWins([win('f1', 'failed'), win('a1', 'abandoned')]); });
    expect(result.current).toBeNull();
  });

  it('celebrateWins celebrates a returned won transition', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateWins([win('w1')]); });
    expect(result.current?.id).toBe('w1');
  });
});
```

Create `src/components/ChallengeWinOverlay.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrateChallengeWin, dismissChallengeWin } from '@/lib/challengeWin';
import { ChallengeWinOverlay } from './ChallengeWinOverlay';
import type { Challenge } from '@/lib/types';

const win: Challenge = {
  id: 'c1', type: 'streak7', habitId: 'h1', scopeLabel: 'Read',
  status: 'won', startedAt: 1, resultAt: 2,
};

beforeEach(() => { dismissChallengeWin(); vi.useRealTimers(); });

describe('ChallengeWinOverlay', () => {
  it('renders nothing without a win', () => {
    render(<ChallengeWinOverlay />);
    expect(screen.queryByTestId('challenge-win')).not.toBeInTheDocument();
  });

  it('announces the win politely with title, scope, and status text', () => {
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    const region = screen.getByTestId('challenge-win');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Challenge complete!')).toBeInTheDocument();
    expect(screen.getByText('7-Day Streak — Read')).toBeInTheDocument();
  });

  it('dismisses via the Done button', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('challenge-win')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the timer', () => {
    vi.useFakeTimers();
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByTestId('challenge-win')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('uses the motion-safe animation class (reduced-motion stays static)', () => {
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    const card = screen.getByTestId('challenge-win-card');
    expect(card.className).toContain('motion-safe:animate-[toast-in_200ms_ease-out]');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/challengeWin.test.ts src/components/ChallengeWinOverlay.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `src/lib/challengeWin.ts`:

```ts
'use client';

import { useSyncExternalStore } from 'react';
import type { Challenge } from './types';

const AUTO_DISMISS_MS = 4000;

let current: Challenge | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/**
 * Challenges spec §UX: celebrate only the TRANSITION to won — callers pass
 * challenges returned by evaluateChallenges(), which never re-returns a
 * terminal challenge, so an already-won challenge can never replay on boot.
 * A fresh win replaces any visible one and restarts the single timer
 * (same mechanics as celebrateIfCompleted).
 */
export function celebrateChallengeWin(c: Challenge): void {
  current = c;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { current = null; timer = null; emit(); }, AUTO_DISMISS_MS);
  emit();
}

/** Filter helper for evaluateChallenges() results: only `won` pops the overlay. */
export function celebrateWins(transitions: Challenge[]): void {
  for (const c of transitions) if (c.status === 'won') celebrateChallengeWin(c);
}

export function dismissChallengeWin(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  current = null;
  emit();
}

export function useChallengeWin(): Challenge | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
```

Create `src/components/ChallengeWinOverlay.tsx`:

```tsx
'use client';

import { Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { challengeTitle } from '@/lib/challenges';
import { dismissChallengeWin, useChallengeWin } from '@/lib/challengeWin';

/**
 * Challenges spec §UX: the one deliberate moment of delight. A non-portaled
 * glass overlay over a soft scrim; the polite region announces the win, Done
 * (and Escape) dismiss immediately, and the timer auto-dismisses. Reduced
 * motion gets the static card — toast-in only ever runs under motion-safe.
 */
export function ChallengeWinOverlay() {
  const c = useChallengeWin();
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!c) return;
    doneRef.current?.focus();                       // focus lands on the dismiss action
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissChallengeWin(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [c]);

  if (!c) return null;
  return (
    <div role="status" aria-live="polite" data-testid="challenge-win"
         className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div data-testid="challenge-win-card"
           className="glass-heavy w-full max-w-sm rounded-[28px] p-8 text-center motion-safe:animate-[toast-in_200ms_ease-out]">
        <Trophy size={44} className="mx-auto mb-3 text-[var(--color-accent)]" aria-hidden />
        <h2 className="mb-1 text-xl font-extrabold">Challenge complete!</h2>
        <p className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
          {challengeTitle(c.type)} — {c.scopeLabel}
        </p>
        <p className="mb-5 text-xs text-[var(--color-subtle)]">Won</p>
        <button ref={doneRef} type="button" onClick={dismissChallengeWin}
                className="btn-primary min-h-11 w-full text-sm">
          Done
        </button>
      </div>
    </div>
  );
}
```

Mount it in `src/components/NavShell.tsx` next to `<CompletionToast />` (import `ChallengeWinOverlay`):

```tsx
        <CompletionToast />
        <ChallengeWinOverlay />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/challengeWin.test.ts src/components/ChallengeWinOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/challengeWin.ts src/lib/challengeWin.test.ts src/components/ChallengeWinOverlay.tsx src/components/ChallengeWinOverlay.test.tsx src/components/NavShell.tsx
git commit -m "feat: transition-only challenge win overlay"
```

---

### Task 6: `/challenges` page — screen, join flow, pickers, results shelf

**Files:**
- Create: `src/app/challenges/page.tsx`
- Create: `src/components/ChallengesScreen.tsx`
- Test: `src/components/ChallengesScreen.test.tsx`

**Interfaces:**
- Consumes: `challengeProgress`, `challengeTitle` (Task 1); `listChallenges`, `listHabits`, `loadRange`, `joinChallenge`, `evaluateChallenges`, `MAX_ACTIVE_CHALLENGES` (Tasks 3–4); `celebrateWins` (Task 5); `useLiveQuery` (`src/lib/useLiveQuery.ts`); `Sheet` (`src/components/Sheet.tsx`).
- Produces: the `/challenges` route (rendered inside `NavShell`). Tasks 7 links here.

- [ ] **Step 1: Write the failing test**

Create `src/components/ChallengesScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listChallenges, newId, putChallenge, putEntry, putHabit } from '@/lib/repo';
import { ChallengesScreen } from './ChallengesScreen';
import type { Challenge, Habit } from '@/lib/types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: Date.now(), ...over,
});

beforeEach(async () => { await clearAll(); });

describe('ChallengesScreen', () => {
  it('shows the three join cards on an empty account', async () => {
    render(<ChallengesScreen />);
    expect(await screen.findByText('7-Day Streak')).toBeInTheDocument();
    expect(screen.getByText('Weekend Warrior')).toBeInTheDocument();
    expect(screen.getByText('Category Sprint')).toBeInTheDocument();
  });

  it('blocks joining when the scope would be empty (join guard)', async () => {
    render(<ChallengesScreen />); // no habits at all
    const joinButtons = screen.getAllByRole('button', { name: /^Join/ });
    for (const b of joinButtons) expect(b).toBeDisabled();
    expect(screen.getByText(/add a habit/i)).toBeInTheDocument();
  });

  it('joins streak7 via the habit picker and persists an active challenge', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const h = habit();
    await putHabit(h);
    render(<ChallengesScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /Join/ })); // first Join = streak7
    await userEvent.click(await screen.findByRole('button', { name: h.name }));
    await waitFor(async () => {
      const all = await listChallenges();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ type: 'streak7', habitId: h.id, status: 'active' });
    });
  });

  it('lists an active challenge with live progress and groups results', async () => {
    const h = habit();
    await putHabit(h);
    // Active streak7 with a 3-day run (today + 2 back).
    const key = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    for (let i = 0; i < 3; i++) await putEntry(h.id, key(i), 1);
    await putChallenge({ id: newId(), type: 'streak7', habitId: h.id, scopeLabel: h.name, status: 'active', startedAt: Date.now() - 86_400_000 });
    await putChallenge({ id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'won', startedAt: 1, resultAt: 2 });
    render(<ChallengesScreen />);
    expect(await screen.findByText(/Day 3\/7/)).toBeInTheDocument();
    // Results shelf: won row carries the word "Won" (never color-only).
    expect(await screen.findByText('Won')).toBeInTheDocument();
  });

  it('shows the cap message when 3 actives are held', async () => {
    for (const type of ['streak7', 'weekend', 'category7'] as const) {
      await putChallenge({ id: newId(), type, scopeLabel: type, status: 'active', startedAt: Date.now() });
    }
    render(<ChallengesScreen />);
    expect(await screen.findByText(/up to 3 active challenges/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/ChallengesScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/app/challenges/page.tsx`:

```tsx
'use client';

import { NavShell } from '@/components/NavShell';
import { ChallengesScreen } from '@/components/ChallengesScreen';

export default function ChallengesPage() {
  return (
    <NavShell>
      <ChallengesScreen />
    </NavShell>
  );
}
```

Create `src/components/ChallengesScreen.tsx`:

```tsx
'use client';

import { Check, Plus, Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { challengeProgress, challengeTitle } from '@/lib/challenges';
import { celebrateWins } from '@/lib/challengeWin';
import { todayKey } from '@/lib/dates';
import { evaluateChallenges, joinChallenge, listChallenges, listHabits, loadRange, MAX_ACTIVE_CHALLENGES } from '@/lib/repo';
import { reportWriteError } from '@/lib/writeError';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { Challenge, ChallengeType, Habit } from '@/lib/types';
import { Sheet } from './Sheet';

const MODES: ReadonlyArray<{ type: ChallengeType; blurb: string }> = [
  { type: 'streak7', blurb: 'Keep one habit alive for 7 straight days.' },
  { type: 'weekend', blurb: 'Complete everything scheduled this Saturday and Sunday.' },
  { type: 'category7', blurb: '7 perfect days in a row across one category.' },
];

const dateKey = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function ChallengesScreen() {
  const habits = useLiveQuery(() => listHabits(), []);
  const challenges = useLiveQuery(() => listChallenges(), []);
  const [picking, setPicking] = useState<ChallengeType | null>(null);
  const [joining, setJoining] = useState<ChallengeType | null>(null);
  const today = todayKey();

  // Surface load evaluation: closes time-based weekend fails and catches wins
  // earned since the last boot pass; returned `won` transitions celebrate once.
  useEffect(() => {
    evaluateChallenges().then(celebrateWins).catch(reportWriteError);
  }, []);

  // Entries needed to derive progress: from the earliest active join day.
  const activeStarts = useMemo(() => (challenges ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => dateKey(new Date(c.startedAt))), [challenges]);
  const from = activeStarts.length ? activeStarts.reduce((a, b) => (a < b ? a : b)) : today;
  const entries = useLiveQuery(() => loadRange(from, today), [from, today]);

  const active = useMemo(() => (challenges ?? []).filter((c) => c.status === 'active'), [challenges]);
  const results = useMemo(() => (challenges ?? [])
    .filter((c) => c.status !== 'active')
    .sort((a, b) => (b.resultAt ?? 0) - (a.resultAt ?? 0)), [challenges]);
  const won = results.filter((c) => c.status === 'won');
  const closed = results.filter((c) => c.status !== 'won');

  const activeOfType = (type: ChallengeType) => active.some((c) => c.type === type);
  const scopeReady = (type: ChallengeType): boolean => {
    if (!habits) return false;
    if (type === 'streak7') return habits.length > 0;
    if (type === 'weekend') return habits.length > 0;
    return habits.some((h) => h.category.trim().length > 0);
  };
  const capFull = active.length >= MAX_ACTIVE_CHALLENGES;

  const categories = useMemo(() => {
    const set = new Set((habits ?? []).map((h) => h.category).filter((c) => c.trim().length > 0));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [habits]);

  const join = async (type: ChallengeType, opts: { habitId?: string; category?: string; scopeLabel: string } | null) => {
    if (!opts) return;
    setJoining(type);
    try {
      await joinChallenge({ type, ...opts });
      setPicking(null);
    } catch (err) { reportWriteError(err); }
    finally { setJoining(null); }
  };

  const pickFor = (type: ChallengeType): { habitId?: string; category?: string; scopeLabel: string } | null => {
    if (type === 'weekend') return { scopeLabel: 'All habits' };
    return null; // pickers resolve via the Sheet below
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold">Challenges</h1>

      {/* 1 — Active */}
      {active.length > 0 && (
        <section aria-label="Active challenges" className="mb-8">
          <h2 className="mb-2 text-sm font-bold text-[var(--color-subtle)]">Active</h2>
          <ul className="flex flex-col gap-3">
            {active.map((c) => {
              const p = challengeProgress(c, habits ?? [], entries ?? [], today);
              const pct = Math.round((p.current / p.total) * 100);
              return (
                <li key={c.id} className="glass-card rounded-2xl p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Trophy size={16} className="text-[var(--color-accent)]" aria-hidden />
                    <span className="text-sm font-bold">{challengeTitle(c.type)}</span>
                    <span className="text-xs text-[var(--color-subtle)]">— {c.scopeLabel}</span>
                  </div>
                  <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">{p.label}</p>
                  <div role="progressbar" aria-valuenow={p.current} aria-valuemin={0} aria-valuemax={p.total}
                       aria-label={`${challengeTitle(c.type)} progress`}
                       className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 2 — Join */}
      <section aria-label="Join a challenge" className="mb-8">
        <h2 className="mb-2 text-sm font-bold text-[var(--color-subtle)]">Start a new challenge</h2>
        {capFull && (
          <p className="mb-3 rounded-2xl glass-card px-4 py-3 text-sm">
            You can hold up to 3 active challenges at once — finish or replace one to join another.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {MODES.map(({ type, blurb }) => {
            const ready = scopeReady(type);
            const replacing = activeOfType(type);
            const blocked = capFull && !replacing;
            return (
              <li key={type} className="glass-card rounded-2xl p-4">
                <p className="mb-1 text-sm font-bold">{challengeTitle(type)}</p>
                <p className="mb-3 text-xs text-[var(--color-subtle)]">{blurb}</p>
                {!ready && <p className="mb-2 text-xs text-[var(--color-subtle)]">Add a habit first — a challenge needs a scope.</p>}
                <button type="button" disabled={!ready || blocked || joining === type}
                        onClick={() => {
                          const direct = pickFor(type);
                          if (direct) void join(type, direct);
                          else setPicking(type);
                        }}
                        className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm">
                  <Plus size={16} aria-hidden />
                  {replacing ? 'Replace' : 'Join'} {challengeTitle(type)}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3 — Results shelf */}
      {(won.length > 0 || closed.length > 0) && (
        <section aria-label="Past challenges">
          <h2 className="mb-2 text-sm font-bold text-[var(--color-subtle)]">Results</h2>
          <ul className="flex flex-col gap-2">
            {won.map((c) => (
              <li key={c.id} className="glass-row flex items-center gap-2 rounded-2xl px-4 py-3 text-sm">
                <Check size={16} className="text-[var(--color-accent)]" aria-hidden />
                <span className="font-semibold">{challengeTitle(c.type)}</span>
                <span className="text-xs text-[var(--color-subtle)]">{c.scopeLabel}</span>
                <span className="ml-auto text-xs font-semibold">Won</span>
              </li>
            ))}
            {closed.map((c) => (
              <li key={c.id} className="glass-row flex items-center gap-2 rounded-2xl px-4 py-3 text-sm opacity-70">
                <X size={16} className="text-[var(--color-subtle)]" aria-hidden />
                <span className="font-semibold">{challengeTitle(c.type)}</span>
                <span className="text-xs text-[var(--color-subtle)]">{c.scopeLabel}</span>
                <span className="ml-auto text-xs font-semibold">{c.status === 'failed' ? 'Failed' : 'Replaced'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Scope pickers — the existing Sheet pattern (role=dialog, focus trap) */}
      {picking && (
        <Sheet open onClose={() => setPicking(null)} title={`Choose a scope — ${challengeTitle(picking)}`}>
          {picking === 'streak7' && (
            <ul className="flex flex-col gap-2">
              {(habits ?? []).map((h) => (
                <li key={h.id}>
                  <button type="button"
                          onClick={() => void join('streak7', { habitId: h.id, scopeLabel: h.name })}
                          className="min-h-11 w-full rounded-2xl bg-[var(--color-muted)] px-4 py-3 text-left text-sm font-medium">
                    {h.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picking === 'category7' && (
            <ul className="flex flex-col gap-2">
              {categories.map((cat) => (
                <li key={cat}>
                  <button type="button"
                          onClick={() => void join('category7', { category: cat, scopeLabel: cat })}
                          className="min-h-11 w-full rounded-2xl bg-[var(--color-muted)] px-4 py-3 text-left text-sm font-medium">
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/ChallengesScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck` then `pnpm lint`
Expected: clean (no unused imports; no new warnings).

- [ ] **Step 6: Commit**

```bash
git add src/app/challenges/page.tsx src/components/ChallengesScreen.tsx src/components/ChallengesScreen.test.tsx
git commit -m "feat: /challenges page with join flow, live progress, results shelf"
```

---

### Task 7: Home strip, MenuDrawer entry, write-path evaluation

**Files:**
- Create: `src/components/ActiveChallengesStrip.tsx`
- Modify: `src/components/HomeScreen.tsx`
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/NoteScreen.tsx` and `src/components/TimerModal.tsx` (evaluation after entry writes)
- Test: `src/components/ActiveChallengesStrip.test.tsx`

**Interfaces:**
- Consumes: `activeChallenges`, `evaluateChallenges`, `listHabits`, `loadRange` (Tasks 3–4); `challengeProgress`, `challengeTitle` (Task 1); `celebrateWins` (Task 5); `allTimeStart` from `src/lib/stats.ts`; `useLiveQuery`.
- Produces: the Home "Active challenges" strip (below CoachCard, hidden when none active) linking to `/challenges`; MenuDrawer "Challenges" item; timely win detection after every entry write.

- [ ] **Step 1: Write the failing test**

Create `src/components/ActiveChallengesStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, newId, putChallenge, putEntry, putHabit } from '@/lib/repo';
import { ActiveChallengesStrip } from './ActiveChallengesStrip';
import type { Habit } from '@/lib/types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: Date.now(), ...over,
});

beforeEach(async () => { await clearAll(); });

describe('ActiveChallengesStrip', () => {
  it('renders nothing when no challenge is active', async () => {
    const { container } = render(<ActiveChallengesStrip />);
    await screen.findByText(/./).catch(() => {}); // allow the liveQuery to settle
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each active challenge with live progress as a link to /challenges', async () => {
    const h = habit();
    await putHabit(h);
    const key = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    for (let i = 0; i < 3; i++) await putEntry(h.id, key(i), 1);
    await putChallenge({ id: newId(), type: 'streak7', habitId: h.id, scopeLabel: h.name, status: 'active', startedAt: Date.now() - 86_400_000 });
    render(<ActiveChallengesStrip />);
    expect(await screen.findByRole('link', { name: /7-Day Streak/ })).toHaveAttribute('href', '/challenges');
    expect(screen.getByText(/Day 3\/7/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/ActiveChallengesStrip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/ActiveChallengesStrip.tsx`:

```tsx
'use client';

import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { challengeProgress, challengeTitle } from '@/lib/challenges';
import { todayKey } from '@/lib/dates';
import { activeChallenges, listHabits, loadRange } from '@/lib/repo';
import { allTimeStart } from '@/lib/stats';
import { useLiveQuery } from '@/lib/useLiveQuery';

/** Home check-in strip (challenges spec §UX): coach-card-style rows for each
 *  active challenge with live progress; hidden entirely when none are active. */
export function ActiveChallengesStrip() {
  const habits = useLiveQuery(() => listHabits(), []);
  const active = useLiveQuery(() => activeChallenges(), []);
  const today = todayKey();
  const entries = useLiveQuery(() => loadRange(allTimeStart(habits ?? []), today), [habits, today]);

  if (!active?.length || habits === undefined || entries === undefined) return null;

  return (
    <section aria-label="Active challenges" className="mb-4 flex flex-col gap-2 px-1">
      {active.map((c) => {
        const p = challengeProgress(c, habits, entries, today);
        return (
          <Link key={c.id} href="/challenges"
                className="glass-card flex items-center gap-2 rounded-2xl px-4 py-3 text-sm">
            <Trophy size={16} className="shrink-0 text-[var(--color-accent)]" aria-hidden />
            <span className="font-semibold">{challengeTitle(c.type)}</span>
            <span className="min-w-0 truncate text-xs text-[var(--color-subtle)]">— {c.scopeLabel}</span>
            <span className="ml-auto shrink-0 text-xs font-bold">{p.label}</span>
          </Link>
        );
      })}
    </section>
  );
}
```

In `src/components/HomeScreen.tsx`: import `ActiveChallengesStrip` and render it directly after the CoachCard block:

```tsx
      {habits !== undefined && entries !== undefined && habits.length > 0 && (
        <CoachCard insights={coach} habits={habits} date={date} />
      )}

      <ActiveChallengesStrip />
```

Also extend HomeScreen's `setValue` so every successful entry write re-evaluates challenges (wins pop the moment they happen). Add imports `evaluateChallenges` (from `@/lib/repo`) and `celebrateWins` (from `@/lib/challengeWin`), then inside `setValue` after `celebrateIfCompleted`:

```ts
      await putEntry(habit.id, date, value);   // putEntry owns the clamp (R1)
      celebrateIfCompleted(habit, before, value);   // A2: only after a successful write
      void evaluateChallenges().then(celebrateWins).catch(() => { /* boot pass owns reporting */ });
```

In `src/components/NoteScreen.tsx`: after its `.then(() => celebrateIfCompleted(...))` entry write (around line 120), chain evaluation the same way (`void evaluateChallenges().then(celebrateWins).catch(() => {})` — add the two imports).

In `src/components/TimerModal.tsx`: after its `.then(() => celebrateIfCompleted(...))` full-session write (around line 71), chain the same evaluation (add the two imports).

In `src/components/MenuDrawer.tsx`: add a Challenges item above Settings (import `Trophy` from lucide-react):

```tsx
        <button type="button"
                onClick={() => { router.push('/challenges'); onClose(); }}
                className="flex items-center gap-3 rounded-2xl bg-[var(--color-muted)] px-3 py-2.5 text-sm font-medium">
          <Trophy size={18} />
          Challenges
        </button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/ActiveChallengesStrip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the affected component suites**

Run: `pnpm vitest run src/components/HomeScreen.test.tsx src/components/NoteScreen.test.tsx src/components/TimerModal.test.tsx src/components/MenuDrawer.test.tsx`
Expected: PASS (evaluation calls are fire-and-forget; existing celebrate tests unaffected). If a MenuDrawer test asserts the exact nav item count, update it to include Challenges.

- [ ] **Step 6: Commit**

```bash
git add src/components/ActiveChallengesStrip.tsx src/components/ActiveChallengesStrip.test.tsx src/components/HomeScreen.tsx src/components/MenuDrawer.tsx src/components/NoteScreen.tsx src/components/TimerModal.tsx
git commit -m "feat: home challenges strip, menu entry, write-path evaluation"
```

---

### Task 8: Final verification gates

**Files:**
- No new files; verification only (fix regressions in the owning file if found).

**Interfaces:**
- Consumes: everything from Tasks 1–7.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all green (previous baseline 567 tests + this plan's new suites).

- [ ] **Step 2: Lint, typecheck, build**

Run: `pnpm lint`, then `pnpm typecheck`, then `pnpm build`
Expected: lint 0 errors and no new warnings; typecheck clean; build succeeds.

- [ ] **Step 3: Browser V-run of the whole flow**

Run: `pnpm dev`, then in the browser:
1. Open `/challenges` via MenuDrawer → Challenges. Join "7-Day Streak" on an existing habit (picker opens, habit list renders).
2. Check the Home page → the Active challenges strip shows "7-Day Streak — <habit> · Day X/7" below the coach card.
3. Complete today's habit on Home → strip progress increments; if a win transitions, the overlay appears once with "Challenge complete!", "7-Day Streak — <habit>", "Won", and a Done button (test with a synthetic data seed if a real 7-day win is impractical: join, then use DevTools → Application → IndexedDB → habibit → entries to add perfect entries for the 7 days including one written after the join).
4. Reload the app with an active challenge whose weekend has passed (or a broken streak) → on next open the challenge appears under Results as Failed (time-based failures persist per spec); no overlay replays for previously-won challenges.
5. Join two more challenges of different types (cap = 3), then attempt a fourth → the cap message appears and the button is disabled.
6. Settings → Export → download; confirm the JSON contains a `challenges` array. Reset-to-empty → `/challenges` shows the three join cards and no shelf.
7. Keyboard: Tab to the win overlay's Done button (focus lands there when it opens), Escape closes it; picker Sheet traps focus and Escape closes.
8. Toggle OS reduced-motion → the win overlay appears instantly with no animation.

- [ ] **Step 4: Commit any fixes produced by the V-run**

```bash
git add -A -- src
git commit -m "fix: issues found in challenge modes browser verification"
```

(Only if fixes were needed; otherwise skip this step.)

---

## Self-Review notes (plan author)

- **Spec coverage:** types/persistence → Task 1/3; rules G1–G3, weekend window, win-before-fail, anti-instant-win, join guards → Tasks 1–2; evaluation points (boot/after writes/surface loads) → Tasks 4, 6, 7; orphan pass → Task 4; export/import/reset → Task 4; `/challenges` + Home strip + MenuDrawer → Tasks 6–7; win moment (transition-only) → Tasks 4+5; failure surfacing (quiet shelf) → Task 6; style/a11y constraints → Tasks 5–7 code + Task 8 checks; testing strategy → colocated suites in each task; out-of-scope B/C → untouched.
- **Deliberate defers left to the executor per spec:** win overlay is implemented as a `role="status" aria-live="polite"` region over a scrim (non-modal, focus on Done, Escape closes) — matching the house CompletionToast a11y posture rather than a focus-trapped dialog; flagged in the spec as an acceptable plan-author call.
- **Type consistency:** `Challenge`/`ChallengeType`/`ChallengeStatus` (types.ts) → `challengeOutcome`/`challengeProgress`/`challengeTitle`/`weekendWindow` (challenges.ts) → `listChallenges`/`activeChallenges`/`putChallenge`/`joinChallenge`/`evaluateChallenges`/`MAX_ACTIVE_CHALLENGES` (repo.ts) → `celebrateChallengeWin`/`celebrateWins`/`dismissChallengeWin`/`useChallengeWin` (challengeWin.ts) — names used identically in every consuming task.
- **Review Focus:** all five lines have pinned tests (Task 2 Sunday-join window; Task 2 anti-instant-win ×2; Task 4 legacy import; Task 3 cap+replace; Task 4 transition-once + Task 5 store).
