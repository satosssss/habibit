import { addDays, weekdayIndex } from './dates';
import { isCompleted } from './stats';
import type { Entry, Habit } from './types';

/**
 * Consecutive days with a completion for each habit, walking back from
 * `today`. Off-schedule completions count (spec §6); days with neither a
 * schedule nor a log are skipped (they neither count nor break); a missed
 * scheduled day ends the run; an incomplete `today` never breaks it.
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
    if (completedOn(cursor)) streak = 1;
    cursor = addDays(cursor, -1);

    for (let guard = 0; guard < 370; guard++, cursor = addDays(cursor, -1)) {
      if (completedOn(cursor)) { streak++; continue; }   // scheduled or bonus (spec §6)
      if (!scheduledOn(cursor)) continue;                // neither counts nor breaks
      break;                                             // a missed scheduled day ends the run
    }
    streaks[habit.id] = streak;
  }
  return streaks;
}
