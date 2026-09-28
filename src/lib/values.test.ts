import { describe, expect, it } from 'vitest';
import type { Habit } from './types';
import { clampedValue } from './values';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Drink Water', icon: 'droplet', color: '#6366f1', category: 'Health',
  intention: 'Be Grateful', type: 'quantity', target: 8, unit: 'cups',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

describe('clampedValue (spec R1 — the cap invariant)', () => {
  it('keeps in-range values untouched', () => {
    expect(clampedValue(habit(), 0)).toBe(0);
    expect(clampedValue(habit(), 4)).toBe(4);
    expect(clampedValue(habit(), 8)).toBe(8);
  });

  it('caps at the target and floors at zero', () => {
    expect(clampedValue(habit(), 11)).toBe(8);   // never 11/8
    expect(clampedValue(habit(), -3)).toBe(0);
  });

  it('treats non-finite values as zero', () => {
    expect(clampedValue(habit(), Number.NaN)).toBe(0);
    expect(clampedValue(habit(), Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('caps boolean habits at 1', () => {
    expect(clampedValue(habit({ type: 'boolean', target: 1 }), 5)).toBe(1);
  });
});
