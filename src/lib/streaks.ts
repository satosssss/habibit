import { addDays, weekdayIndex } from './dates';
import { isCompleted } from './stats';
import type { Entry, Habit } from './types';

/**
 * Consecutive scheduled-and-completed days for each habit, walking back from
 * `today`. Unscheduled days are skipped (they neither count nor break); an
 * incomplete `today` does not break yesterday's streak.
 */
export function habitStreaks(
  habits: Habit[],
  entries: Entry[],
  today: string,
): Record<string, number> {
  const values = new Map(entries.map((e) => [`${e.habitId}|${e.date}`, e.value]));
  const streaks: Record<string, number> = {};

  for (const habit of habits) {
    const scheduledOn = (date: string) => habit.frequency.includes(weekdayIndex(date));
    const completedOn = (date: string) => isCompleted(habit, values.get(`${habit.id}|${date}`) ?? 0);

    let cursor = today;
    let streak = 0;

    // Today only extends the streak; it never breaks it.
    if (scheduledOn(cursor) && completedOn(cursor)) streak = 1;
    cursor = addDays(cursor, -1);

    for (let guard = 0; guard < 370; guard++, cursor = addDays(cursor, -1)) {
      if (!scheduledOn(cursor)) continue;   // unscheduled: neither counts nor breaks
      if (!completedOn(cursor)) break;      // a missed scheduled day ends the run
      streak++;
    }
    streaks[habit.id] = streak;
  }
  return streaks;
}
