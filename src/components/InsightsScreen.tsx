'use client';

import { CalendarCheck, CheckSquare, Flame, Star, TrendingUp, Trophy, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateCoachInsights } from '@/lib/coach';
import { intentionColor } from '@/lib/colors';
import { intentionIcon } from '@/lib/icons';
import { listHabits, loadRange } from '@/lib/repo';
import {
  allTimeStart, buildDayStats, completionRate, countActiveDays, countPerfectDays,
  currentStreak, longestStreak, perIntentionTotals, sumCompletions, weekTrend,
} from '@/lib/stats';
import { todayKey } from '@/lib/dates';
import { useLiveQuery } from '@/lib/useLiveQuery';
import { CoachSection } from './CoachSection';
import { Heatmap } from './Heatmap';
import { IntentionBar } from './IntentionBar';
import { StatTile } from './StatTile';
import { YearNav } from './YearNav';

export function InsightsScreen() {
  const today = todayKey();
  const maxYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(maxYear);

  const habits = useLiveQuery(() => listHabits(), []);
  const minYear = useMemo(
    // Empty/loading keeps the old `maxYear - 1` default: allTimeStart([]) is
    // '2000-01-01', which would offer year 2000 with no habits (out-of-range).
    () => (habits?.length ? Math.min(Number(allTimeStart(habits).slice(0, 4)), maxYear) : maxYear - 1),
    [habits, maxYear],
  );
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

  // Spec §8/R6: current-year comparison lives in the tile; past years only
  // aggregate. allEntries is year-independent, so January-crossing windows
  // always have data (flagged decision 5).
  const trend = useMemo(
    () => (year === maxYear ? weekTrend(habits ?? [], allEntries ?? [], today) : null),
    [habits, allEntries, year, maxYear, today],
  );

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

  // Coach spec R3: allEntries spans minYear → today — the full windows the
  // engine needs (14/30/7 days + both week windows), year-independent.
  const coach = useMemo(
    () => generateCoachInsights(habits ?? [], allEntries ?? [], today),
    [habits, allEntries, today],
  );

  if (habits === undefined || entries === undefined || allEntries === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-10">
        <p className="skeleton p-6 text-center text-sm text-[var(--color-subtle)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10">
      <YearNav year={year} minYear={minYear} maxYear={maxYear} onChange={setYear} />

      <h2 className="mb-2 mt-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Year stats</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={CalendarCheck} value={countActiveDays(stats)} caption="Active Days" />
        <StatTile icon={Star} value={countPerfectDays(stats)} caption="Perfect Days" />
        {trend ? (
          <StatTile icon={TrendingUp} value={`${trend.completed} of ${trend.slots}`} caption="This week"
                    sub={`${trend.copy} · All year: ${Math.round(rate.rate * 100)}%`} />
        ) : (
          <StatTile icon={Zap} value={`${rate.completed} of ${rate.scheduled}`} caption={`Completed in ${year}`} />
        )}
        <StatTile icon={CheckSquare} value={sumCompletions(stats)} caption="Completions" />
      </div>

      <CoachSection insights={coach} habits={habits ?? []} />

      {/* Spec §10: bars + heatmap side by side at tablet (md), heatmap full
          width at desktop (xl); mobile stays stacked via the grid gap. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-1">
        <div>
          <h2 className="mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">By intention</h2>
          <div className="glass-card px-4 py-2">
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
        </div>

        {/* key: remount per year so a past year opens at its natural January
            position instead of inheriting the current-year scroll offset (spec §5). */}
        <Heatmap key={year} year={year} habits={habits ?? []} entries={entries ?? []} today={today} />
      </div>

      <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">All time</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Flame} value={currentStreak(allTime, today)} caption="Current Streak" />
        <StatTile icon={Trophy} value={longestStreak(allTime)} caption="Longest Streak" />
        <StatTile icon={CalendarCheck} value={countActiveDays(allTime)} caption="Total Active Days" />
        <StatTile icon={Star} value={countPerfectDays(allTime)} caption="Total Perfect Days" />
      </div>
    </div>
  );
}
