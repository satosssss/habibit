import type { Habit } from './types';

/**
 * The cap invariant (spec slice A §2): every value the app displays, stores,
 * or imports satisfies `0 ≤ value ≤ habit.target`. Non-finite input is 0.
 * One definition, three enforcement layers (write boundary, UI, import/boot).
 */
export function clampedValue(habit: Habit, value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(0, safe), habit.target);
}
