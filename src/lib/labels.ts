import type { Habit } from './types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function frequencyLabel(frequency: number[]): string {
  const sorted = [...frequency].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join(',') === '0,6') return 'Weekends';
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

function minutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
}

/** Exactly the screenshot's subtexts: "Every day, 4/8 cups" / "Every day, 10 minutes/15 minutes". */
export function subtext(habit: Habit, value: number): string {
  const freq = frequencyLabel(habit.frequency);
  if (habit.type === 'quantity') return `${freq}, ${value}/${habit.target} ${habit.unit}`.trimEnd();
  if (habit.type === 'timer') return `${freq}, ${minutes(value)}/${minutes(habit.target)}`;
  return freq;
}
