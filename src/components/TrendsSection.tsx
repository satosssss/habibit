'use client';

import { useMemo } from 'react';
import { allTimeStart, buildDayStats } from '@/lib/stats';
import { hourHistogram, streakSeries, weekdayRates, weeklyRates } from '@/lib/trends';
import type { Entry, Habit } from '@/lib/types';
import { PatternBars } from './PatternBars';
import { TrendChart } from './TrendChart';

const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOUR_TICK: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };
const hourLabel = (h: number) => {
  const suffix = h < 12 ? 'am' : 'pm';
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base} ${suffix}`;
};
const MICRO = 'mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]';
const SUBTLE = 'text-sm text-[var(--color-subtle)]';

export function TrendsSection({ habits, entries, year, today }: {
  habits: Habit[]; entries: Entry[]; year: number; today: string;
}) {
  // Full history → the streak entering Jan 1 is real; past years clamp to Dec 31.
  const chartEnd = useMemo(() => (`${year}-12-31` < today ? `${year}-12-31` : today), [year, today]);
  const stats = useMemo(
    () => buildDayStats(habits, entries, { from: habits.length ? allTimeStart(habits) : chartEnd, to: chartEnd }),
    [habits, entries, chartEnd],
  );
  const yearStart = `${year}-01-01`;
  const series = useMemo(
    () => streakSeries(stats, today).filter((p) => p.date >= yearStart),
    [stats, today, yearStart],
  );
  const weeks = useMemo(() => weeklyRates(stats, year), [stats, year]);
  const weekdays = useMemo(() => weekdayRates(stats, year), [stats, year]);
  const hours = useMemo(() => hourHistogram(habits, entries, year), [habits, entries, year]);

  const streakMax = series.reduce((m, p) => Math.max(m, p.streak), 0);
  const totals = weeks.reduce(
    (t, w) => ({ completed: t.completed + w.completed, scheduled: t.scheduled + w.scheduled }),
    { completed: 0, scheduled: 0 },
  );
  const average = totals.scheduled > 0 ? Math.round((totals.completed / totals.scheduled) * 100) : 0;
  const weekdaySlots = weekdays.reduce((n, d) => n + d.scheduled, 0);
  const hourTotal = hours.reduce((a, b) => a + b, 0);

  if (habits.length === 0) {
    return (
      <div>
        <h2 className={MICRO}>Trends</h2>
        <div className="glass-card px-4 py-2">
          <p className={`py-3 ${SUBTLE}`}>No habits yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="trends-section">
      <h2 className={MICRO}>Trends</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section aria-labelledby="trend-streak-title" className="glass-card p-4">
          <h3 id="trend-streak-title" className="mb-2 text-sm font-bold">Streak growth</h3>
          {streakMax === 0 ? (
            <p className={`py-3 ${SUBTLE}`}>No streaks in {year}.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[var(--color-subtle)]">Longest this year: {streakMax}</p>
              <TrendChart points={series.map((p) => p.streak)} max={streakMax}
                          ariaLabel={`Streak growth in ${year}, longest ${streakMax} days`}
                          testId="trend-streak" />
            </>
          )}
        </section>

        <section aria-labelledby="trend-consistency-title" className="glass-card p-4">
          <h3 id="trend-consistency-title" className="mb-2 text-sm font-bold">Consistency</h3>
          {totals.scheduled === 0 ? (
            <p className={`py-3 ${SUBTLE}`}>Nothing scheduled in {year}.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[var(--color-subtle)]">Average: {average}%</p>
              <TrendChart points={weeks.map((w) => w.rate)} max={1}
                          ariaLabel={`Weekly completion rate in ${year}, average ${average} percent`}
                          testId="trend-consistency" yTicks={['100%', '50%', '0%']} />
            </>
          )}
        </section>

        <section aria-labelledby="trend-patterns-title" className="glass-card p-4 md:col-span-2">
          <h3 id="trend-patterns-title" className="mb-3 text-sm font-bold">When you show up</h3>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">By weekday</p>
              {weekdaySlots === 0 ? (
                <p className={`py-3 ${SUBTLE}`}>Nothing scheduled in {year}.</p>
              ) : (
                <PatternBars
                  testId="pattern-weekday" max={1} ariaLabel="Completion rate by weekday"
                  data={weekdays.map((d, i) => ({
                    label: WEEKDAY_SHORT[i],
                    value: d.rate,
                    aria: d.rate === null
                      ? `${WEEKDAY_LONG[i]}: nothing scheduled`
                      : `${WEEKDAY_LONG[i]}: ${Math.round(d.rate * 100)}% (${d.completed} of ${d.scheduled})`,
                  }))}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">By hour of day</p>
              {hourTotal === 0 ? (
                <p className={`py-3 ${SUBTLE}`}>No completions in {year}.</p>
              ) : (
                <PatternBars
                  testId="pattern-hour" max={Math.max(1, ...hours)} ariaLabel="Completions by hour of day"
                  data={hours.map((count, h) => ({
                    label: HOUR_TICK[h] ?? '',
                    value: count,
                    aria: `${hourLabel(h)}: ${count} completion${count === 1 ? '' : 's'}`,
                  }))}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
