import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from './types';
import { buildDayStats, currentStreak } from './stats';
import { streakSeries } from './trends';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const entry = (habitId: string, date: string, value: number): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

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
