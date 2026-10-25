import { describe, expect, it } from 'vitest';
import { challengeOutcome, challengeProgress, challengeTitle } from './challenges';
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
