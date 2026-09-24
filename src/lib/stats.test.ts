import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from './types';
import {
  buildDayStats, completionRate, countActiveDays, countPerfectDays, currentStreak,
  heatmapCells, isCompleted, longestStreak, perIntentionTotals, sumCompletions,
} from './stats';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const entry = (habitId: string, date: string, value: number): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

describe('isCompleted', () => {
  it('treats boolean as value > 0 and quantity/timer as reaching target', () => {
    expect(isCompleted(habit(), 1)).toBe(true);
    expect(isCompleted(habit(), 0)).toBe(false);
    expect(isCompleted(habit({ type: 'quantity', target: 8 }), 8)).toBe(true);
    expect(isCompleted(habit({ type: 'quantity', target: 8 }), 7)).toBe(false);
    expect(isCompleted(habit({ type: 'timer', target: 900 }), 900)).toBe(true);
    expect(isCompleted(habit({ type: 'timer', target: 900 }), 899)).toBe(false);
  });
});

describe('buildDayStats', () => {
  it('counts scheduled vs completed per day', () => {
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b', type: 'quantity', target: 8 });
    const stats = buildDayStats([a, b], [entry('a', '2026-09-20', 1), entry('b', '2026-09-20', 4)], {
      from: '2026-09-20', to: '2026-09-20',
    });
    const day = stats.get('2026-09-20')!;
    expect(day.scheduled).toBe(2);
    expect(day.completed).toBe(1);
    expect(day.ratio).toBe(0.5);
    expect(day.active).toBe(true);
    expect(day.perfect).toBe(false);
  });

  it('excludes habits on unscheduled weekdays', () => {
    const weekdaysOnly = habit({ frequency: [1, 2, 3, 4, 5] });
    const stats = buildDayStats([weekdaysOnly], [], { from: '2026-09-18', to: '2026-09-21' });
    expect(stats.get('2026-09-18')!.scheduled).toBe(1); // Friday
    expect(stats.get('2026-09-19')!.scheduled).toBe(0); // Saturday — skipped
    expect(stats.get('2026-09-21')!.scheduled).toBe(1); // Monday
  });

  it('excludes habits created after the day in question', () => {
    const late = habit({ createdAt: Date.parse('2026-09-21T00:00:00') });
    const stats = buildDayStats([late], [], { from: '2026-09-20', to: '2026-09-22' });
    expect(stats.get('2026-09-20')!.scheduled).toBe(0);
    expect(stats.get('2026-09-22')!.scheduled).toBe(1);
  });

  it('ignores future-dated entries', () => {
    const a = habit({ id: 'a' });
    const stats = buildDayStats([a], [entry('a', '2027-01-01', 1)], {
      from: '2026-01-01', to: '2026-12-31',
    });
    expect(stats.has('2027-01-01')).toBe(false);
    expect(countActiveDays(stats)).toBe(0);
  });

  it('treats a day with no scheduled habits as neither active nor perfect', () => {
    const stats = buildDayStats([], [], { from: '2026-09-20', to: '2026-09-20' });
    const day = stats.get('2026-09-20')!;
    expect(day.active).toBe(false);
    expect(day.perfect).toBe(false);
    expect(day.ratio).toBe(0);
  });
});

describe('streaks', () => {
  it('counts consecutive active days back from today', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1), entry('h1', '2026-09-23', 1)],
      { from: '2026-09-15', to: '2026-09-23' },
    );
    expect(currentStreak(stats, '2026-09-23')).toBe(3);
  });

  it('does not break on an incomplete today', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-23' },
    );
    expect(currentStreak(stats, '2026-09-23')).toBe(2);
  });

  it('skips days with no scheduled habits', () => {
    const weekdaysOnly = habit({ id: 'w', frequency: [1, 2, 3, 4, 5] });
    // Fri 18 active, Sat/Sun unscheduled, Mon 21 active → streak 2 across the weekend
    const stats = buildDayStats(
      [weekdaysOnly],
      [entry('w', '2026-09-18', 1), entry('w', '2026-09-21', 1)],
      { from: '2026-09-15', to: '2026-09-21' },
    );
    expect(currentStreak(stats, '2026-09-21')).toBe(2);
  });

  it('breaks on a scheduled day with no completions', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-20', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-23' },
    );
    expect(currentStreak(stats, '2026-09-23')).toBe(1);
  });

  it('finds the longest run of active days', () => {
    const entries = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05', '2026-09-06']
      .map((d) => entry('h1', d, 1));
    const stats = buildDayStats([habit()], entries, { from: '2026-09-01', to: '2026-09-10' });
    expect(longestStreak(stats)).toBe(3);
  });
});

describe('summaries', () => {
  it('counts active days, perfect days, completions and rate', () => {
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b' });
    const stats = buildDayStats(
      [a, b],
      [entry('a', '2026-09-20', 1), entry('b', '2026-09-20', 1), entry('a', '2026-09-21', 1)],
      { from: '2026-09-20', to: '2026-09-21' },
    );
    expect(countActiveDays(stats)).toBe(2);
    expect(countPerfectDays(stats)).toBe(1);
    expect(sumCompletions(stats)).toBe(3);
    expect(completionRate(stats)).toEqual({ completed: 3, scheduled: 4, rate: 0.75 });
  });

  it('returns zero, never NaN, when nothing is scheduled', () => {
    expect(completionRate(buildDayStats([], [], { from: '2026-09-20', to: '2026-09-20' })).rate).toBe(0);
  });
});

describe('perIntentionTotals', () => {
  it('groups completed/scheduled by intention', () => {
    const a = habit({ id: 'a', intention: 'Study' });
    const b = habit({ id: 'b', intention: 'Study' });
    const totals = perIntentionTotals(
      [a, b],
      [entry('a', '2026-09-20', 1)],
      2026,
      '2026-09-21',
    );
    expect(totals).toHaveLength(1);
    expect(totals[0].completed).toBe(1);
    expect(totals[0].scheduled).toBe(2);
  });
});

describe('heatmapCells', () => {
  it('emits exactly the days of the year, padded to whole weeks', () => {
    const cells = heatmapCells(2026, [habit()], [], '2026-12-31');
    expect(cells.filter((c) => c.inYear)).toHaveLength(365);
    expect(cells.length % 7).toBe(0);
    expect(cells.length).toBe(53 * 7);
    expect(cells[0].date <= '2026-01-01').toBe(true);
    expect(cells.at(-1)!.date >= '2026-12-31').toBe(true);
    // Padding cells are not in-year but must not shift later columns.
    const jan1 = cells.findIndex((c) => c.date === '2026-01-01');
    expect(jan1 % 7).toBe((new Date(2026, 0, 1).getDay() + 6) % 7);
  });

  it('maps completion ratio onto 5 levels', () => {
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b' });
    const cells = heatmapCells(
      2026, [a, b],
      [entry('a', '2026-06-10', 1), entry('b', '2026-06-10', 1), entry('a', '2026-06-11', 1)],
      '2026-12-31',
    );
    expect(cells.find((c) => c.date === '2026-06-10')!.level).toBe(4); // 2/2
    expect(cells.find((c) => c.date === '2026-06-11')!.level).toBe(2); // 1/2 = 0.5 → ceil(2)
    expect(cells.find((c) => c.date === '2026-06-12')!.level).toBe(0); // 0 completions
  });

  it('marks days after today as future with level 0', () => {
    const cells = heatmapCells(2026, [habit()], [], '2026-06-01');
    expect(cells.find((c) => c.date === '2026-12-31')!.future).toBe(true);
    expect(cells.find((c) => c.date === '2026-12-31')!.level).toBe(0);
    expect(cells.find((c) => c.date === '2026-05-31')!.future).toBe(false);
  });
});
