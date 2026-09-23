import { describe, expect, it } from 'vitest';
import {
  addDays, classifyDate, dayOfYear, formatLong, fromKey, isValidDateKey,
  monthLabelPositions, stripDays, toKey, weekdayIndex, yearDays,
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
