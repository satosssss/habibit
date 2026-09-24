'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatShort } from '@/lib/dates';
import { monthLabelPositions } from '@/lib/dates';
import { heatmapCells, type HeatCell } from '@/lib/stats';
import type { Entry, Habit } from '@/lib/types';

const WEEKDAYS = ['Mon', 'Wed', 'Fri'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 13;   // px, gap handled by the grid gap
const GAP = 3;

export function Heatmap({
  year, habits, entries, today, compact = false,
}: {
  year: number;
  habits: Habit[];
  entries: Entry[];
  today: string;
  compact?: boolean;
}) {
  const router = useRouter();
  // Clamp to today before indexing: heatmapCells guards `level` for future
  // cells but not their `completed of scheduled` payload (Review Focus #5).
  const cells = useMemo(
    () => heatmapCells(year, habits, entries.filter((e) => e.date <= today), today),
    [year, habits, entries, today],
  );
  const months = useMemo(() => monthLabelPositions(year), [year]);

  const sectionRef = useRef<HTMLElement>(null);
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

  const visibleCells = compact ? cells.slice(Math.max(0, cells.length - 26 * 7)) : cells;
  const columnCount = visibleCells.length / 7;

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
            <p className="text-[var(--color-subtle)]">
              {tooltip.completed} of {tooltip.scheduled} completed
            </p>
            <p className="text-[var(--color-subtle)]">
              {tooltip.scheduled ? Math.round((tooltip.completed / tooltip.scheduled) * 100) : 0}%
            </p>
          </div>
        )}

        <div className="flex gap-1.5">
          <div className="flex w-8 shrink-0 flex-col justify-between py-0.5 text-[9px] text-[var(--color-subtle)]">
            {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto pb-1">
            <div style={{ width: columnCount * (CELL + GAP) }}>
              {/* Month labels */}
              <div className="relative mb-1 h-3 text-[9px] text-[var(--color-subtle)]">
                {months.map(({ month, column }) => (
                  <span key={month} className="absolute"
                        style={{ left: column * (CELL + GAP), visibility: column >= columnCount ? 'hidden' : 'visible' }}>
                    {MONTHS[month]}
                  </span>
                ))}
              </div>

              {/* 7 weekday rows × week columns */}
              <div className="grid grid-flow-col grid-rows-7 gap-[3px]"
                   style={{ gridAutoColumns: CELL }}>
                {visibleCells.map((cell) => (
                  <button
                    key={cell.date}
                    type="button"
                    data-testid={`hm-cell-${cell.date}`}
                    aria-label={`${cell.date}: ${cell.completed} of ${cell.scheduled} completed`}
                    onPointerEnter={(e) => { touchPointer.current = e.pointerType === 'touch'; }}
                    onMouseEnter={() => { if (!touchPointer.current) setHover(cell); }}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => open(cell)}
                    className="h-[13px] w-[13px] rounded-[3px]"
                    style={{
                      background: cell.inYear && !cell.future
                        ? `var(--hm-${cell.level})`
                        : 'var(--hm-empty)',
                      outline: tooltip?.date === cell.date ? '1px solid var(--color-fg)' : 'none',
                    }}
                  />
                ))}
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
