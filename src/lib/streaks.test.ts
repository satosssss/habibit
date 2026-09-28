import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import type { Entry, Habit } from './types';
import { habitStreaks } from './streaks';

const habit = (id: string, frequency = [0, 1, 2, 3, 4, 5, 6]): Habit => ({
  id, name: id, icon: 'flower2', color: '#c026d3', category: 'Morning', intention: 'Study',
  type: 'boolean', target: 1, unit: '', frequency, order: 0, createdAt: 0,
});

const entry = (habitId: string, date: string, value = 1): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

describe('habitStreaks', () => {
  it('counts consecutive scheduled-and-completed days back from today', () => {
    const streaks = habitStreaks(
      [habit('a')],
      [entry('a', '2026-09-21'), entry('a', '2026-09-22'), entry('a', '2026-09-23')],
      '2026-09-23',
    );
    expect(streaks.a).toBe(3);
  });

  it('does not break on a day the habit is not scheduled', () => {
    const weekdayOnly = habit('w', [1, 2, 3, 4, 5]);
    // Fri 18 done, weekend unscheduled, Mon 21 done, today Tue 22 done
    const streaks = habitStreaks(
      [weekdayOnly],
      [entry('w', '2026-09-18'), entry('w', '2026-09-21'), entry('w', '2026-09-22')],
      '2026-09-22',
    );
    expect(streaks.w).toBe(3);
  });

  it('breaks when a scheduled day was missed', () => {
    const streaks = habitStreaks(
      [habit('a')],
      [entry('a', '2026-09-20'), entry('a', '2026-09-22')],
      '2026-09-22',
    );
    expect(streaks.a).toBe(1);
  });

  it('treats an incomplete today as not breaking yesterday', () => {
    const quantity = { ...habit('q'), type: 'quantity' as const, target: 8, unit: 'cups' };
    const streaks = habitStreaks(
      [quantity],
      [entry('q', '2026-09-21', 8), entry('q', '2026-09-22', 3)], // yesterday complete, today partial
      '2026-09-22',
    );
    expect(streaks.q).toBe(1);
  });

  it('returns 0 for a habit with no entries', () => {
    expect(habitStreaks([habit('a')], [], '2026-09-22').a).toBe(0);
  });

  it('counts a completion on a day the habit was not scheduled (spec §6)', () => {
    const weekdayOnly = habit('w', [1, 2, 3, 4, 5]);
    // Fri 18 done, Sat 19 logged off-schedule, Mon 21 done, today Tue 22 done
    const streaks = habitStreaks(
      [weekdayOnly],
      [entry('w', '2026-09-18'), entry('w', '2026-09-19'), entry('w', '2026-09-21'), entry('w', '2026-09-22')],
      '2026-09-22',
    );
    expect(streaks.w).toBe(4);
  });

  it('counts streaks beyond 371 days — the loop guard is a safety net, not a cap (R1)', () => {
    // 400 consecutive completions ending today: the header (currentStreak) has
    // no bound, so the badge must not cap either or the two disagree (R1).
    const today = '2026-09-28';
    const entries = Array.from({ length: 400 }, (_, i) => entry('a', addDays(today, -i)));
    expect(habitStreaks([habit('a')], entries, today).a).toBe(400);
  });
});
