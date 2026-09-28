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

const INTENTION_PRESETS = ['Health', 'Calm', 'Growth', 'Joy'];

/**
 * Chip row for the intention field (spec §7/R5): in-use intentions first —
 * trimmed, deduped case-insensitively, shown in first-seen casing — then the
 * presets the user hasn't used yet. Free text stays the input's job.
 */
export function intentionSuggestions(inUse: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...inUse, ...INTENTION_PRESETS]) {
    const value = raw.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
