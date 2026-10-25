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
    // TODAY is Wednesday. 15 calendar days back is the smallest window that
    // contains 7 scheduled Mon/Wed/Fri days (n = 0,2,5,7,9,12,14), all completed.
    const scheduled = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'].map((n) =>
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

  it('never fails on days that predate the habit itself (isScheduled gating)', () => {
    // Created Tue Oct 20, joined Sat Oct 17: the Mon Oct 19 slot is before the
    // habit existed — the house scheduling rule (isScheduled) must treat it as
    // unscheduled, not as a missed due day.
    const h = habit({ frequency: [1, 3, 5], createdAt: Date.parse(`${daysBack(1, TODAY)}T10:00:00`) });
    expect(challengeOutcome(streak7(h, startedBefore(4)), [h], [], TODAY)).toBe('active');
  });
});

describe('G3: unscheduled days neither count nor break (category7 scope)', () => {
  it('skips unscheduled gaps after joining: stays active and never inflates progress', () => {
    const h = habit({ frequency: [1, 3, 5] }); // Mon/Wed/Fri only
    // Completed scheduled days only (Wed 21, Mon 19, Fri 16); Tue/Thu/Sat/Sun
    // carry no entry at all — gaps, not misses.
    const completed = ['0', '2', '5'].map((n) => entry(h.id, daysBack(Number(n), TODAY), 1));
    const c: Challenge = {
      id: newId(), type: 'category7', category: h.category, scopeLabel: h.category,
      status: 'active', startedAt: startedBefore(6),
    };
    // Run = 3 scheduled-and-perfect days < 7: the four gap days must not pad it to a win.
    expect(challengeOutcome(c, [h], completed, TODAY)).toBe('active'); // run = 3 < 7
    expect(challengeProgress(c, [h], completed, TODAY)).toEqual({ label: 'Day 3/7', current: 3, total: 7 });
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
    // Scope is re-derived from CURRENT habits, so `late` is in scope — but the
    // scheduling rule is the house isScheduled, which gates on createdAt. Days
    // 2-6 predate `late`'s createdAt, so those days are unscheduled for it and
    // skip (G3: neither count nor break); `a` is perfect across all 7 days and
    // a post-join completion exists → won. Pinned so the semantics stay: adding
    // a habit mid-challenge is safe — it is only judged on days it existed.
    expect(challengeOutcome(cat7('Health', startedBefore(2)), [a, late], entries, TODAY)).toBe('won');
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

// Final fix 1 — spec line 25 "Joining never produces an instant win" and line 30
// "no vacuous wins": a weekday-only account had dayPerfect() vacuously true on
// the FUTURE target Saturday too, so a midweek join won instantly. The window
// must actually arrive before either day can be decided.
describe('weekend: no vacuous win on future days (final fix 1)', () => {
  const weekdayOnly = habit({ frequency: [1, 2, 3, 4, 5] }); // Mon–Fri
  const weekendScheduled = habit({ id: 'wk', frequency: [6, 0] }); // Sat + Sun
  const wk = (startedAt: number): Challenge => ({
    id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'active', startedAt,
  });
  const joinedWed = Date.parse('2026-10-21T09:00:00'); // window Sat 24 / Sun 25

  it('stays active on the target Saturday — Sunday has not arrived yet', () => {
    expect(challengeOutcome(wk(joinedWed), [weekdayOnly], [], '2026-10-24')).toBe('active');
  });

  it('wins on Sunday once both days have arrived and are perfect', () => {
    expect(challengeOutcome(wk(joinedWed), [weekdayOnly], [], '2026-10-25')).toBe('won');
  });

  it('an imperfect weekend stays active through Sunday and fails on Monday', () => {
    // Weekend-scheduled habit with no entries: Sat/Sun are scheduled misses.
    expect(challengeOutcome(wk(joinedWed), [weekendScheduled], [], '2026-10-25')).toBe('active'); // win-before-fail: Sunday pending
    expect(challengeOutcome(wk(joinedWed), [weekendScheduled], [], '2026-10-26')).toBe('failed'); // Monday arrives
  });

  it('progress never shows future days as perfect (0/2 midweek, not 2/2)', () => {
    const c = wk(joinedWed);
    // Midweek: both window days are in the future — neither counts.
    expect(challengeProgress(c, [weekdayOnly], [], '2026-10-21')).toEqual({ label: '0/2 weekend days', current: 0, total: 2 });
    // Saturday has arrived (vacuously perfect — the G3 fail-path convention
    // applies to ARRIVED days only); Sunday is still future → 0 for it.
    expect(challengeProgress(c, [weekdayOnly], [], '2026-10-24')).toEqual({ label: '1/2 weekend days', current: 1, total: 2 });
  });
});

// Final fix 6 — scopeRun's walk is bounded by the scope's earliest createdAt:
// nothing earlier can be scheduled (isScheduled gates on createdAt), so the
// 36,500-day guard run never happens for fresh scopes.
describe('scopeRun earliest-createdAt bound (final fix 6)', () => {
  const cat7 = (category: string, startedAt: number): Challenge => ({
    id: newId(), type: 'category7', category, scopeLabel: category, status: 'active', startedAt,
  });

  it('a recently-created category scope still computes the correct run', () => {
    const a = habit({
      id: 'fresh', category: 'Health',
      createdAt: Date.parse(`${daysBack(4, TODAY)}T12:00:00`), // created 4 days ago
    });
    // Perfect on the 4 days since it existed (days 3 and 4 predate creation).
    const entries = Array.from({ length: 4 }, (_, i) => entry('fresh', daysBack(i, TODAY), 1));
    const run4: Challenge = cat7('Health', startedBefore(2));
    expect(challengeOutcome(run4, [a], entries, TODAY)).toBe('active'); // run 4 < 7, post-join completion exists
    expect(challengeProgress(run4, [a], entries, TODAY)).toEqual({ label: 'Day 4/7', current: 4, total: 7 });
  });
});
