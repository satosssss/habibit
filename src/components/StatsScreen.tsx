'use client';

import { CalendarCheck, CheckSquare, Flame, Star, Trophy, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { intentionColor } from '@/lib/colors';
import { intentionIcon } from '@/lib/icons';
import { listHabits, loadRange } from '@/lib/repo';
import {
  buildDayStats, completionRate, countActiveDays, countPerfectDays,
  currentStreak, longestStreak, perIntentionTotals, sumCompletions,
} from '@/lib/stats';
import { todayKey } from '@/lib/dates';
import { useLiveQuery } from '@/lib/useLiveQuery';
import { IntentionBar } from './IntentionBar';
import { StatTile } from './StatTile';
import { YearNav } from './YearNav';

export function StatsScreen() {
  const today = todayKey();
  const maxYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(maxYear);
  const [minYear, setMinYear] = useState(maxYear - 1);

  const habits = useLiveQuery(() => listHabits(), []);
  const entries = useLiveQuery(
    () => loadRange(`${year}-01-01`, `${year}-12-31`),
    [year],
  );
  // A separate, year-independent query so the all-time tiles are not limited
  // to whichever year is selected.
  const allEntries = useLiveQuery(
    () => loadRange(`${minYear}-01-01`, today),
    [minYear, today],
  );

  useEffect(() => {
    if (!habits?.length) return;
    const earliest = new Date(Math.min(...habits.map((h) => h.createdAt))).getFullYear();
    setMinYear(Math.min(earliest, maxYear));
  }, [habits, maxYear]);

  const stats = useMemo(
    () => buildDayStats(habits ?? [], entries ?? [], {
      from: `${year}-01-01`,
      to: year === maxYear ? today : `${year}-12-31`,
    }),
    [habits, entries, year, maxYear, today],
  );

  const allTime = useMemo(
    () => buildDayStats(habits ?? [], allEntries ?? [], { from: `${minYear}-01-01`, to: today }),
    [habits, allEntries, minYear, today],
  );

  const rate = useMemo(() => completionRate(stats), [stats]);

  // Spec §7.3: rows follow habit `order`. That field restarts per category, so
  // equal orders fall back to retrieval order (stable sort).
  const orderedHabits = useMemo(
    () => [...(habits ?? [])].sort((a, b) => a.order - b.order),
    [habits],
  );

  const intentions = useMemo(
    () => perIntentionTotals(orderedHabits, entries ?? [], year, today),
    [orderedHabits, entries, year, today],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10">
      <YearNav year={year} minYear={minYear} maxYear={maxYear} onChange={setYear} />

      <h2 className="mb-2 mt-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Year stats</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile icon={CalendarCheck} value={countActiveDays(stats)} caption="Active Days" />
        <StatTile icon={Star} value={countPerfectDays(stats)} caption="Perfect Days" />
        <StatTile icon={Zap} value={`${Math.round(rate.rate * 100)}%`} caption="Completion Rate" />
        <StatTile icon={CheckSquare} value={sumCompletions(stats)} caption="Completions" />
      </div>

      <h2 className="mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">By intention</h2>
      <div className="rounded-2xl bg-[var(--color-panel)] px-4 py-2">
        {intentions.length === 0 ? (
          <p className="py-3 text-sm text-[var(--color-subtle)]">No habits yet.</p>
        ) : (
          intentions.map((stat) => (
            <IntentionBar
              key={stat.intention}
              intention={stat.intention}
              completed={stat.completed}
              scheduled={stat.scheduled}
              color={intentionColor(stat.intention)}
              icon={intentionIcon(orderedHabits.filter((h) => h.intention === stat.intention))}
            />
          ))
        )}
      </div>

      {/* Heatmap — added by Task 11 */}
      {/* <Heatmap year={year} habits={habits ?? []} entries={entries ?? []} today={today} /> */}

      <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">All time</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile icon={Flame} value={currentStreak(allTime, today)} caption="Current Streak" />
        <StatTile icon={Trophy} value={longestStreak(allTime)} caption="Longest Streak" />
        <StatTile icon={CalendarCheck} value={countActiveDays(allTime)} caption="Total Active Days" />
        <StatTile icon={Star} value={countPerfectDays(allTime)} caption="Total Perfect Days" />
      </div>
    </div>
  );
}
