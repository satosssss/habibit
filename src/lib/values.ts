import { isCompleted } from './stats';
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

/**
 * One shared completion toggle (spec R2): done → 0, not-done → the full
 * target (boolean habits: 1). TodayScreen's row toggles and NoteScreen's
 * checkboxes now behave identically — a partial quantity completes to its
 * target instead of being zeroed.
 */
export function toggleValue(habit: Habit, value: number): number {
  return isCompleted(habit, value) ? 0 : (habit.type === 'boolean' ? 1 : habit.target);
}
