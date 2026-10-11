import { describe, expect, it } from 'vitest';
import {
  addDays, classifyDate, dayOfYear, formatLong, fromKey, isValidDateKey,
  mondayIndex, mondayOf, monthGrid, monthLabelPositions, stripDays, toKey, weekdayIndex, yearDays,
} from './dates';

describe('date keys', () => {
  it('round-trips without a UTC day shift', () => {
    for (const key of ['2026-01-01', '2026-03-08', '2026-07-04', '2026-12-31']) {
      expect(toKey(fromKey(key))).toBe(key);
    }
  });

  it('parses to local midnight, not UTC midnight', () => {
    const d = fromKey('2026-03-08');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(8);
  });

  it('addDays walks one calendar day across a DST boundary', () => {
    expect(addDays('2026-03-08', -1)).toBe('2026-03-07');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('addDays handles month and year rollover', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('weekdayIndex is 0 for Sunday and 6 for Saturday', () => {
    expect(weekdayIndex('2026-09-20')).toBe(0); // Sunday
    expect(weekdayIndex('2026-09-26')).toBe(6); // Saturday
  });

  it('mondayIndex is Monday-first (Monday = 0 … Sunday = 6)', () => {
    expect(mondayIndex('2026-09-21')).toBe(0); // Monday
    expect(mondayIndex('2026-09-20')).toBe(6); // Sunday
  });

  it('dayOfYear counts from January 1', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-12-31')).toBe(365);
    expect(dayOfYear('2024-12-31')).toBe(366);
  });

  it('stripDays returns 5 previous days, today, and one future preview', () => {
    const strip = stripDays('2026-09-23');
    expect(strip).toHaveLength(7);
    expect(strip[5]).toBe('2026-09-23');
    expect(strip).toEqual([
      '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21',
      '2026-09-22', '2026-09-23', '2026-09-24',
    ]);
  });

  // explicit `today` keeps this deterministic regardless of the wall clock
  it('classifyDate distinguishes past, today, future', () => {
    expect(classifyDate('2026-09-22', '2026-09-23')).toBe('past');
    expect(classifyDate('2026-09-23', '2026-09-23')).toBe('today');
    expect(classifyDate('2026-09-24', '2026-09-23')).toBe('future');
  });

  it('isValidDateKey rejects malformed and impossible values', () => {
    expect(isValidDateKey('2026-09-23')).toBe(true);
    expect(isValidDateKey('2026-9-23')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('nope')).toBe(false);
  });

  it('formatLong renders a readable long date', () => {
    expect(formatLong('2026-05-24')).toMatch(/May 24/);
  });

  it('yearDays returns every day of the year in order', () => {
    expect(yearDays(2026)).toHaveLength(365);
    expect(yearDays(2026)[0]).toBe('2026-01-01');
    expect(yearDays(2026).at(-1)).toBe('2026-12-31');
    expect(yearDays(2024)).toHaveLength(366);
  });

  it('monthLabelPositions maps each month to its week column', () => {
    const labels = monthLabelPositions(2026);
    expect(labels[0]).toEqual({ month: 0, column: 0 });
    expect(labels.map((l) => l.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // columns must be non-decreasing and within the year's week count
    const columns = labels.map((l) => l.column);
    expect([...columns].sort((a, b) => a - b)).toEqual(columns);
    expect(columns.at(-1)).toBeLessThanOrEqual(52);
  });
});

describe('mondayOf', () => {
  it('returns the Monday of the key’s week (Mon→itself, mid-week→back, Sun→back 6)', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(mondayOf('2026-09-30')).toBe('2026-09-28'); // Wednesday
    expect(mondayOf('2026-10-04')).toBe('2026-09-28'); // Sunday
  });
});

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
