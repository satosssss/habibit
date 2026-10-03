'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listHabits, loadRange } from '@/lib/repo';
import { classifyDate, fromKey, monthGrid, todayKey, toKey } from '@/lib/dates';
import { buildDayStats } from '@/lib/stats';
import { useLiveQuery } from '@/lib/useLiveQuery';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** `October 3` — unpadded, matches the spec's aria-label examples (R5). */
const labelDate = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;

export function CalendarScreen() {
  const today = todayKey();
  const todayDate = fromKey(today);
  const [mounted, setMounted] = useState(false);
  const [cursor, setCursor] = useState({ y: todayDate.getFullYear(), m: todayDate.getMonth() }); // m 0-based

  useEffect(() => setMounted(true), []);

  const monthStart = toKey(new Date(cursor.y, cursor.m, 1));
  const monthEnd = toKey(new Date(cursor.y, cursor.m + 1, 0));

  const habits = useLiveQuery(() => listHabits(), []);
  const entries = useLiveQuery(() => loadRange(monthStart, monthEnd), [monthStart, monthEnd]);

  const stats = useMemo(
    () => (habits && entries ? buildDayStats(habits, entries, { from: monthStart, to: monthEnd }) : undefined),
    [habits, entries, monthStart, monthEnd],
  );
  const grid = useMemo(() => monthGrid(cursor.y, cursor.m + 1), [cursor]);

  const step = (n: number) =>
    setCursor(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const goToday = () => setCursor({ y: todayDate.getFullYear(), m: todayDate.getMonth() });

  const skeletonGrid = (
    <div className="grid grid-cols-7 justify-items-center gap-1" aria-hidden>
      {Array.from({ length: 35 }, (_, i) => <span key={i} className="skeleton h-11 w-11" />)}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Calendar</h1>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => step(-1)}
                  className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-muted)]">
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-36 text-center text-sm font-bold">
            {mounted ? `${MONTHS[cursor.m]} ${cursor.y}` : <span className="skeleton inline-block h-5 w-28" />}
          </p>
          <button type="button" aria-label="Next month" onClick={() => step(1)}
                  className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-muted)]">
            <ChevronRight size={18} />
          </button>
        </div>
        <button type="button" onClick={goToday}
                className="min-h-10 rounded-full px-3 py-2 text-sm font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-muted)]">
          Today
        </button>
      </div>

      {/* Monday-first headers (spec R5; matches the heatmap's week start) */}
      <div aria-hidden className="grid grid-cols-7 justify-items-center pb-1 text-center text-xs font-semibold text-[var(--color-subtle)]">
        {WEEKDAYS.map((d) => (
          <span key={d} className="flex h-8 w-11 items-center justify-center">{d}</span>
        ))}
      </div>

      {!mounted || !stats ? (
        skeletonGrid
      ) : (
        <div className="grid grid-cols-7 justify-items-center gap-1">
          {grid.map((key, i) => {
            if (!key) return <span key={`blank-${i}`} aria-hidden className="h-11 w-11" />;
            const kind = classifyDate(key, today);
            const stat = stats.get(key);

            const label =
              kind === 'future'
                ? `${labelDate(key)}: upcoming`
                : stat && stat.scheduled > 0
                  ? `${labelDate(key)}: ${stat.completed} of ${stat.scheduled} done, ${Math.round(stat.ratio * 100)}%`
                  : `${labelDate(key)}: nothing scheduled`;

            // Spec R5: filled = perfect; hollow = active but not perfect;
            // no dot = untouched / unscheduled / no data. Future never implies failure.
            const dot =
              kind === 'future' || !stat
                ? 'none'
                : stat.perfect
                  ? 'filled'
                  : stat.active
                    ? 'hollow'
                    : 'none';

            const content = (
              <>
                <span aria-hidden>{Number(key.slice(8))}</span>
                {dot !== 'none' && (
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      dot === 'filled'
                        ? 'bg-[var(--color-accent)]'
                        : 'border border-[var(--color-subtle)]'
                    }`}
                  />
                )}
              </>
            );
            const base = 'flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sm';

            if (kind === 'future') {
              return (
                <span key={key} aria-disabled="true" aria-label={label}
                      className={`${base} text-[var(--color-subtle)]`}>
                  {content}
                </span>
              );
            }
            return (
              <Link key={key} href={`/today/${key}`} aria-label={label}
                    aria-current={key === today ? 'date' : undefined}
                    className={`${base} hover:bg-[var(--color-muted)]${key === today ? ' ring-2 ring-[var(--color-accent)]' : ''}`}>
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
