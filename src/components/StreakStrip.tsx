'use client';

import { useMemo } from 'react';
import { habitStreaks } from '@/lib/streaks';
import { buildDayStats } from '@/lib/stats';
import type { Entry, Habit } from '@/lib/types';
import { FlameBadge } from './FlameBadge';

/** Slice E R2: three glance-cards above the masonry. Copy is exact; never shames. */
export function StreakStrip({ habits, entries, today }: { habits: Habit[]; entries: Entry[]; today: string }) {
  const streaks = useMemo(() => habitStreaks(habits, entries, today), [habits, entries, today]);
  const todayStat = useMemo(
    () => buildDayStats(habits, entries, { from: today, to: today }).get(today),
    [habits, entries, today],
  );

  const best = Math.max(0, ...Object.values(streaks));
  const bestHabit = habits.find((h) => streaks[h.id] === best);
  const onStreak = habits.filter((h) => (streaks[h.id] ?? 0) > 0).length;

  const label = 'text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]';

  return (
    <section aria-label="Streak summaries" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="glass-card p-4">
        <p className={label}>Best streak</p>
        {best > 0 && bestHabit ? (
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{bestHabit.name}</p>
              <p className="text-sm text-[var(--color-subtle)]">{best} {best === 1 ? 'day' : 'days'}</p>
            </div>
            <FlameBadge count={best} />
          </div>
        ) : (
          <>
            <p className="mt-1 text-lg font-extrabold">0 days</p>
            <p className="text-sm text-[var(--color-subtle)]">Start today — streaks build as you go</p>
          </>
        )}
      </div>

      <div className="glass-card p-4">
        <p className={label}>On a streak</p>
        <p className="mt-1 text-lg font-extrabold">{onStreak} of {habits.length} habits on a streak</p>
      </div>

      <div className="glass-card p-4">
        <p className={label}>Today</p>
        {todayStat && todayStat.scheduled > 0 ? (
          <p className="mt-1 text-lg font-extrabold">
            {todayStat.completed} of {todayStat.scheduled} done
          </p>
        ) : (
          <p className="mt-1 text-lg font-extrabold">Nothing scheduled today</p>
        )}
      </div>
    </section>
  );
}
