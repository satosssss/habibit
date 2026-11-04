import { describe, expect, it } from 'vitest';
import { monthLabelPositions } from './dates';
import { heatmapCells } from './stats';
import type { Entry, Habit } from './types';
import { shareCardModel } from './shareCard';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Read', icon: 'book', color: '#f59e0b', category: 'Evening',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: Date.parse('2025-01-01T00:00:00'), ...over,
});

const entry = (date: string, value = 1, habitId = 'h1'): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

describe('shareCardModel (R1)', () => {
  it('stops the current year at today', () => {
    const entries = [entry('2026-01-01'), entry('2026-01-02'), entry('2026-12-31')];
    const model = shareCardModel({
      habits: [habit()], entries, badges: [], year: 2026, today: '2026-11-04',
    });
    expect(model.activeDays).toBe(2);   // the future-dated entry is outside the window
    expect(model.completions).toBe(2);
  });

  it('uses the full calendar year for a past year', () => {
    const entries = [entry('2025-01-01'), entry('2025-12-31')];
    const model = shareCardModel({
      habits: [habit()], entries, badges: [], year: 2025, today: '2026-11-04',
    });
    expect(model.activeDays).toBe(2);
    expect(model.completions).toBe(2);
  });

  it('rounds the completion rate and counts perfect days', () => {
    const model = shareCardModel({
      habits: [habit()],
      entries: [entry('2026-01-01'), entry('2026-01-02')],
      badges: [], year: 2026, today: '2026-01-03',
    });
    expect(model.ratePct).toBe(67);     // 2 of 3 scheduled slots
    expect(model.perfectDays).toBe(2);  // Jan 1 and Jan 2 were fully done
  });

  it('scopes the longest streak to the selected year', () => {
    const entries = [
      entry('2025-12-30'), entry('2025-12-31'),
      entry('2026-01-01'), entry('2026-01-02'),
    ];
    const in2025 = shareCardModel({ habits: [habit()], entries, badges: [], year: 2025, today: '2026-01-03' });
    const in2026 = shareCardModel({ habits: [habit()], entries, badges: [], year: 2026, today: '2026-01-03' });
    expect(in2025.longestStreak).toBe(2);
    expect(in2026.longestStreak).toBe(2);
  });

  it('returns zeros instead of NaN when there is no data', () => {
    const model = shareCardModel({ habits: [], entries: [], badges: [], year: 2026, today: '2026-11-04' });
    expect(model).toMatchObject({
      activeDays: 0, perfectDays: 0, completions: 0, ratePct: 0,
      longestStreak: 0, earnedBadges: 0, totalBadges: 16,
    });
    expect(model.cells.length).toBeGreaterThan(0);
  });

  it('counts known badge ids only, ignoring unknown ones', () => {
    const model = shareCardModel({
      habits: [], entries: [], year: 2026, today: '2026-11-04',
      badges: [
        { id: 'streak-3', earnedAt: 1 },
        { id: 'from-a-newer-version', earnedAt: 2 },
        { id: 'streak-3', earnedAt: 3 },   // duplicate cannot inflate the count
      ],
    });
    expect(model.earnedBadges).toBe(1);
    expect(model.totalBadges).toBe(16);
  });

  it('reuses the heatmap cells and month columns Insights draws', () => {
    const habits = [habit()];
    const entries = [entry('2026-03-01')];
    const model = shareCardModel({ habits, entries, badges: [], year: 2026, today: '2026-11-04' });
    expect(model.cells).toEqual(heatmapCells(2026, habits, entries, '2026-11-04'));
    expect(model.months).toEqual(
      monthLabelPositions(2026).map(({ month, column }) => ({
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month],
        column,
      })),
    );
  });
});
