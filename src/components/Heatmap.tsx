'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatShort } from '@/lib/dates';
import { monthLabelPositions, weekColumn } from '@/lib/dates';
import { heatmapCells, type HeatCell } from '@/lib/stats';
import type { Entry, Habit } from '@/lib/types';

const WEEKDAYS = ['Mon', 'Wed', 'Fri'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 13;         // px, gap handled by the grid gap
const COMPACT_CELL = 10; // px — spec §8's "smaller cells" for the compact variant
const GAP = 3;

export function Heatmap({
  year, habits, entries, today, compact = false, focusDate,
}: {
  year: number;
  habits: Habit[];
  entries: Entry[];
  today: string;
  compact?: boolean;
  /** Day whose column the auto-scroll brings into view (defaults to `today`).
      The note view passes its viewed date so the grid shows that day. */
  focusDate?: string;
}) {
  const router = useRouter();
  // Clock gate: /stats and the note view prerender, so a build-day `today`
  // must not reach the server HTML (cell levels and the clamped
  // `completed of scheduled` payload are both today-derived). Pre-mount the
  // clock reads as '' — every cell is future, so prerendered markup is
  // neutral filler that the client's first render matches; the effect then
  // applies the real today. Interaction guards below only run post-mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const clock = mounted ? today : '';
  // Clamp to today before indexing: heatmapCells guards `level` for future
  // cells but not their `completed of scheduled` payload (Review Focus #5).
  const cells = useMemo(
    () => heatmapCells(year, habits, entries.filter((e) => e.date <= clock), clock),
    [year, habits, entries, clock],
  );
  const months = useMemo(() => monthLabelPositions(year), [year]);

  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Touch taps emit compatibility mouse events without a usable pointerType;
  // remember the last real pointer so touch never sets hover (tap must pin).
  const touchPointer = useRef(false);

  const [hover, setHover] = useState<HeatCell | null>(null);
  const [pinned, setPinned] = useState<HeatCell | null>(null);
  const tooltip = pinned ?? hover;

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(null); };
    const onDown = (e: MouseEvent) => {
      if (!sectionRef.current?.contains(e.target as Node)) setPinned(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDown);
    };
  }, [pinned]);

  // Spec §8: compact = smaller cells, same code path. The window is always the
  // whole year passed in (the note view passes the *viewed* date's year), so
  // the viewed date can never be sliced out of its own heatmap.
  const cellSize = compact ? COMPACT_CELL : CELL;
  const columnCount = cells.length / 7;

  // Spec §5/R3: bring the column containing the focus day fully into view —
  // today by default, the note view's viewed date when pinned to a day;
  // current year only, post-mount only, instant under prefers-reduced-motion.
  // Deps exclude entries/cells so data arrivals never re-scroll the viewport.
  useEffect(() => {
    if (!mounted || year !== Number(today.slice(0, 4))) return;
    const el = scrollRef.current;
    if (!el) return;
    const focus = focusDate ?? today;
    const left = Math.max(0, weekColumn(focus, year) * (cellSize + GAP) + cellSize - el.clientWidth);
    if (el.scrollLeft >= left) return; // already visible — leave the user's position alone
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollLeft = left;
    } else {
      el.scrollTo({ left, behavior: 'smooth' });
    }
  }, [mounted, today, focusDate, year, cellSize]);

  const open = (cell: HeatCell) => {
    if (hover?.date === cell.date || pinned?.date === cell.date) {
      setPinned(null);
      // Only past dates have a note view; today/future cells just pin.
      if (cell.date < today) router.push(`/today/${cell.date}`);
    } else {
      setPinned(cell);
    }
  };

  return (
    <section ref={sectionRef} className="rounded-2xl bg-[var(--color-panel)] p-4" aria-label="Activity heatmap">
      <div className="relative">
        {tooltip && (
          <div data-testid="hm-tooltip"
               className="absolute -top-2 left-1/2 z-20 w-56 -translate-x-1/2 -translate-y-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-xs shadow-lg">
            <p className="font-bold">{formatShort(tooltip.date)}, {tooltip.date.slice(0, 4)}</p>
            {tooltip.scheduled === 0 && tooltip.bonus > 0 ? (
              <p className="text-[var(--color-subtle)]">
                {tooltip.completed + tooltip.bonus} completed (off schedule)
              </p>
            ) : (
              <>
                <p className="text-[var(--color-subtle)]">
                  {tooltip.completed} of {tooltip.scheduled} completed
                </p>
                <p className="text-[var(--color-subtle)]">
                  {tooltip.scheduled ? Math.round((tooltip.completed / tooltip.scheduled) * 100) : 0}%
                </p>
              </>
            )}
          </div>
        )}

        <div className="flex gap-1.5">
          <div className="flex w-8 shrink-0 flex-col justify-between py-0.5 text-[9px] text-[var(--color-subtle)]">
            {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
          </div>

          <div ref={scrollRef} data-testid="hm-scroll" className="min-w-0 flex-1 overflow-x-auto pb-1">
            <div style={{ width: columnCount * (cellSize + GAP) }}>
              {/* Month labels */}
              <div className="relative mb-1 h-3 text-[9px] text-[var(--color-subtle)]">
                {months.map(({ month, column }) => (
                  <span key={month} suppressHydrationWarning className="absolute"
                        style={{ left: column * (cellSize + GAP), visibility: column >= columnCount ? 'hidden' : 'visible' }}>
                    {MONTHS[month]}
                  </span>
                ))}
              </div>

              {/* 7 weekday rows × week columns */}
              <div className="grid grid-flow-col grid-rows-7 gap-[3px]"
                   style={{ gridAutoColumns: cellSize }}>
                {cells.map((cell) =>
                  cell.inYear ? (
                    <button
                      key={cell.date}
                      type="button"
                      suppressHydrationWarning
                      data-testid={`hm-cell-${cell.date}`}
                      aria-label={cell.scheduled === 0 && cell.bonus > 0
                        ? `${cell.date}: ${cell.completed + cell.bonus} completed (off schedule)`
                        : `${cell.date}: ${cell.completed} of ${cell.scheduled} completed`}
                      onPointerEnter={(e) => { touchPointer.current = e.pointerType === 'touch'; }}
                      onMouseEnter={() => { if (!touchPointer.current) setHover(cell); }}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => open(cell)}
                      className="rounded-[3px]"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        background: !cell.future ? `var(--hm-${cell.level})` : 'var(--hm-empty)',
                        outline: tooltip?.date === cell.date ? '1px solid var(--color-fg)' : 'none',
                      }}
                    />
                  ) : (
                    // Spec §7.4 clips the year at both ends: out-of-year padding
                    // keeps its grid slot but is inert — no tooltip, no deep link
                    // outside the viewed year.
                    <div
                      key={cell.date}
                      suppressHydrationWarning
                      data-testid={`hm-cell-${cell.date}`}
                      aria-hidden
                      className="rounded-[3px]"
                      style={{ width: cellSize, height: cellSize, background: 'var(--hm-empty)' }}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-testid="hm-legend" className="mt-3 flex items-center justify-end gap-1 text-[10px] text-[var(--color-subtle)]">
        <span className="mr-1">Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} data-level={level} className="h-[10px] w-[10px] rounded-[2px]"
                style={{ background: `var(--hm-${level})` }} />
        ))}
        <span className="ml-1">More</span>
      </div>
    </section>
  );
}
