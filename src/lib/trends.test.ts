import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from './types';
import { buildDayStats, currentStreak } from './stats';
import { hourHistogram, streakSeries, weekdayRates, weeklyRates } from './trends';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const entry = (habitId: string, date: string, value: number): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

const timed = (habitId: string, date: string, value: number, hour: number): Entry => ({
  id: `${habitId}_${date}`, habitId, date, value,
  timestamp: Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00`),
});

describe('streakSeries', () => {
  it('grows the run per active day and stops at today', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1), entry('h1', '2026-09-23', 1)],
      { from: '2026-09-15', to: '2026-09-30' }, // stats run past today…
    );
    const series = streakSeries(stats, '2026-09-23');      // …the series must not
    expect(series.at(-1)).toEqual({ date: '2026-09-23', streak: 3, broke: null });
    expect(series.find((p) => p.date === '2026-09-22')!.streak).toBe(2);
    expect(series.find((p) => p.date === '2026-09-21')!.streak).toBe(1);
    expect(series.some((p) => p.date > '2026-09-23')).toBe(false);
  });

  it('records the broken run length on the first missed day only', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-20', 1), entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-26' },
    );
    const series = streakSeries(stats, '2026-09-26');
    const at = (d: string) => series.find((p) => p.date === d)!;
    expect(at('2026-09-23')).toEqual({ date: '2026-09-23', streak: 0, broke: 3 }); // first miss closes the 3-day run
    expect(at('2026-09-24').broke).toBeNull();                                     // consecutive misses stay plain
    expect(at('2026-09-24').streak).toBe(0);
    expect(at('2026-09-26').broke).toBeNull();                                     // today (grace) never breaks
  });

  it('holds the run across unscheduled gaps', () => {
    const weekdays = habit({ id: 'w', frequency: [1, 2, 3, 4, 5] }); // Mon–Fri
    const stats = buildDayStats(
      [weekdays],
      [entry('w', '2026-09-18', 1), entry('w', '2026-09-21', 1)],    // Fri + Mon (2026-09-21 is a Monday)
      { from: '2026-09-18', to: '2026-09-21' },
    );
    const series = streakSeries(stats, '2026-09-21');
    const at = (d: string) => series.find((p) => p.date === d)!;
    expect(at('2026-09-18').streak).toBe(1);                                       // Fri active
    expect(at('2026-09-19')).toEqual({ date: '2026-09-19', streak: 1, broke: null }); // Sat skipped, run persists
    expect(at('2026-09-20').streak).toBe(1);                                       // Sun skipped
    expect(at('2026-09-21').streak).toBe(2);                                       // Mon continues the run
  });

  it('never breaks on an incomplete today', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-21', to: '2026-09-23' },
    );
    expect(streakSeries(stats, '2026-09-23').at(-1))
      .toEqual({ date: '2026-09-23', streak: 2, broke: null });
  });

  it('keeps the last point equal to currentStreak(stats, today)', () => {
    const growing = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-23' },
    );
    expect(streakSeries(growing, '2026-09-23').at(-1)!.streak)
      .toBe(currentStreak(growing, '2026-09-23')); // 2

    const broken = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-20', 1), entry('h1', '2026-09-22', 1)],
      { from: '2026-09-15', to: '2026-09-23' },
    );
    expect(streakSeries(broken, '2026-09-23').at(-1)!.streak)
      .toBe(currentStreak(broken, '2026-09-23')); // 1
  });

  it('carries a run that entered the window from before it', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2025-12-30', 1), entry('h1', '2025-12-31', 1), entry('h1', '2026-01-01', 1)],
      { from: '2025-12-01', to: '2026-01-01' },
    );
    expect(streakSeries(stats, '2026-01-01').at(-1))
      .toEqual({ date: '2026-01-01', streak: 3, broke: null });
  });
});

describe('weeklyRates', () => {
  it('buckets Monday-first, counts slots-but-nothing-done as 0 (not null)', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-14', 1), entry('h1', '2026-09-15', 1)],
      { from: '2026-09-14', to: '2026-09-27' }, // 2026-09-14 is a Monday
    );
    const weeks = weeklyRates(stats, 2026);
    expect(weeks).toHaveLength(53); // Monday of Jan 1 … Monday of Dec 31, 2026
    const w1 = weeks.find((w) => w.weekStart === '2026-09-14')!;
    expect(w1.completed).toBe(2);
    expect(w1.scheduled).toBe(7);
    expect(w1.rate).toBeCloseTo(2 / 7);
    const w2 = weeks.find((w) => w.weekStart === '2026-09-21')!;
    expect(w2.completed).toBe(0);
    expect(w2.scheduled).toBe(7);
    expect(w2.rate).toBe(0); // slots exist → real 0%, never a gap
  });

  it('reports null for weeks with no scheduled habits (gap, never a fake 0%)', () => {
    const stats = buildDayStats([habit({ frequency: [] })], [], { from: '2026-09-14', to: '2026-09-27' });
    expect(weeklyRates(stats, 2026).every((w) => w.rate === null)).toBe(true);
  });

  it('counts only in-year days at the year edge', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2025-12-30', 1), entry('h1', '2026-01-02', 1)],
      { from: '2025-12-29', to: '2026-01-04' },
    );
    const first = weeklyRates(stats, 2026).find((w) => w.weekStart === '2025-12-29')!;
    expect(first.scheduled).toBe(4); // Jan 1–4 only; Dec 29–30 belong to 2025
    expect(first.completed).toBe(1); // the Dec-30 entry does not leak into 2026
  });
});

describe('weekdayRates', () => {
  it('buckets Monday-first with the slots-family rate', () => {
    const stats = buildDayStats(
      [habit()],
      [entry('h1', '2026-09-14', 1), entry('h1', '2026-09-15', 1)],
      { from: '2026-09-14', to: '2026-09-20' }, // Mon … Sun
    );
    const days = weekdayRates(stats, 2026);
    expect(days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days[0].rate).toBe(1);        // Mon: 1 of 1
    expect(days[1].rate).toBe(1);        // Tue: 1 of 1
    expect(days[2].rate).toBe(0);        // Wed: slots, nothing done → 0
    expect(days[6].scheduled).toBe(1);   // Sun: slot untouched
  });

  it('reports null for weekdays with no scheduled habits', () => {
    const mwf = habit({ frequency: [1, 3] }); // Mon + Wed only
    const stats = buildDayStats([mwf], [], { from: '2026-09-14', to: '2026-09-20' });
    const days = weekdayRates(stats, 2026);
    expect(days[1].rate).toBeNull();   // Tuesday: nothing scheduled
    expect(days[0].scheduled).toBe(1); // Monday: 1 slot
  });
});

describe('hourHistogram', () => {
  it('buckets completed rows by local hour and ignores non-completions', () => {
    const entries = [
      timed('h1', '2026-09-21', 1, 8),
      timed('h1', '2026-09-22', 1, 21),
      timed('h1', '2026-09-23', 0, 8), // untouched row is not a completion
    ];
    const counts = hourHistogram([habit()], entries, 2026);
    expect(counts).toHaveLength(24);
    expect(counts[8]).toBe(1);
    expect(counts[21]).toBe(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('ignores other years and partial quantity rows', () => {
    const quantity = habit({ id: 'q', type: 'quantity', target: 3 });
    const entries = [
      timed('h1', '2025-12-31', 1, 10), // wrong year
      timed('q', '2026-09-21', 2, 9),   // 2 of 3 = not completed
      timed('q', '2026-09-21', 3, 9),   // 3 of 3 = completed
    ];
    const counts = hourHistogram([quantity], entries, 2026);
    expect(counts[9]).toBe(1);
    expect(counts[10]).toBe(0);
  });

  it('counts off-schedule (bonus) completions — the all-completions family', () => {
    const monOnly = habit({ id: 'm', frequency: [1] });  // Mondays only
    const entries = [timed('m', '2026-09-23', 1, 14)];   // Wednesday bonus
    expect(hourHistogram([monOnly], entries, 2026)[14]).toBe(1);
  });
});
