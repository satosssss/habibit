import { addDays, todayKey, weekdayIndex } from './dates';
import { countHabits, hasSeeded, markSeeded, putHabit, setMany } from './repo';
import type { Entry, Habit } from './types';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const t0 = Date.UTC(2026, 0, 1);

export const SEED_HABITS: Habit[] = [
  { id: 'seed-meditate', name: 'Meditate', icon: 'flower2', color: '#c026d3',
    category: 'Morning', intention: 'Do Hard Things', type: 'timer', target: 900, unit: '',
    frequency: EVERY_DAY, order: 0, createdAt: t0 },
  { id: 'seed-weight', name: 'Record Weight', icon: 'scale', color: '#22d3ee',
    category: 'Morning', intention: 'Avoid Traps', type: 'quantity', target: 1, unit: 'reading',
    frequency: EVERY_DAY, order: 1, createdAt: t0 },
  { id: 'seed-shower', name: 'Take a Cold Shower', icon: 'showerHead', color: '#3b82f6',
    category: 'Morning', intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
    frequency: EVERY_DAY, order: 2, createdAt: t0 },
  { id: 'seed-calories', name: 'Burn Calories', icon: 'flame', color: '#22c55e',
    category: 'Health', intention: 'Do Hard Things', type: 'quantity', target: 1000, unit: 'calories',
    frequency: EVERY_DAY, order: 0, createdAt: t0 },
  { id: 'seed-snack', name: "Don't Snack", icon: 'popcorn', color: '#ef4444',
    category: 'Health', intention: 'Avoid Traps', type: 'boolean', target: 1, unit: '',
    frequency: EVERY_DAY, order: 1, createdAt: t0 },
  { id: 'seed-water', name: 'Drink Water', icon: 'droplet', color: '#6366f1',
    category: 'Health', intention: 'Be Grateful', type: 'quantity', target: 8, unit: 'cups',
    frequency: EVERY_DAY, order: 2, createdAt: t0 },
  { id: 'seed-spanish', name: 'Learn Spanish', icon: 'languages', color: '#f97316',
    category: 'Evening', intention: 'Study', type: 'quantity', target: 45, unit: 'minutes',
    frequency: EVERY_DAY, order: 0, createdAt: t0 },
  { id: 'seed-read', name: 'Read', icon: 'bookOpen', color: '#14b8a6',
    category: 'Evening', intention: 'Be Grateful', type: 'boolean', target: 1, unit: '',
    frequency: EVERY_DAY, order: 1, createdAt: t0 },
];

/** mulberry32 — tiny deterministic PRNG so every fresh install seeds identically. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueFor(habit: Habit, complete: boolean, rnd: () => number): number {
  if (habit.type === 'boolean') return complete ? 1 : 0;
  if (!complete) return Math.max(0, Math.floor(rnd() * habit.target * 0.6));
  return habit.target;
}

export function generateSeedEntries(habits: Habit[], anchorDate: string, weeks = 13): Entry[] {
  const rnd = mulberry32(20_260_923);
  const entries: Entry[] = [];
  const start = addDays(anchorDate, -(weeks * 7 - 1));
  const totalDays = weeks * 7;

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(start, i);
    const scheduled = habits.filter((h) => h.frequency.includes(weekdayIndex(date)));
    if (scheduled.length === 0) continue;

    const recent = i >= totalDays - 8;   // keep the seeded current streak alive
    const perfect = rnd() < 0.12;        // ~12% perfect days

    let anyComplete = false;
    for (const habit of scheduled) {
      const complete = perfect ? true : recent ? rnd() < 0.85 : rnd() < 0.78;
      if (complete) anyComplete = true;
      entries.push({
        id: `${habit.id}_${date}`,
        habitId: habit.id,
        date,
        value: valueFor(habit, complete, rnd),
        timestamp: Date.parse(`${date}T09:00:00`),
      });
    }
    // A recent day must be active, or the seeded current streak reads 0.
    if (recent && !anyComplete) {
      const habit = scheduled[0];
      const idx = entries.findIndex((e) => e.id === `${habit.id}_${date}`);
      if (idx >= 0) entries[idx] = { ...entries[idx], value: valueFor(habit, true, rnd) };
    }
  }
  return entries;
}

/** Returns true only when this call performed the seed. */
export async function seedIfEmpty(): Promise<boolean> {
  // countHabits alone can't tell "fresh install" from "user deleted everything";
  // the marker row (kept even when 0 habits remain) makes seeding run exactly once.
  if ((await countHabits()) > 0 || (await hasSeeded())) return false;
  for (const habit of SEED_HABITS) await putHabit(habit);
  await setMany(generateSeedEntries(SEED_HABITS, todayKey()));
  await markSeeded();
  return true;
}
