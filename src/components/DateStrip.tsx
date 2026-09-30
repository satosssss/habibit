'use client';

import { useEffect, useState } from 'react';
import { classifyDate, formatWeekday, stripDays } from '@/lib/dates';

const PLACEHOLDERS = [0, 1, 2, 3, 4, 5, 6];

export function DateStrip({
  selected, today, onSelect,
}: { selected: string; today: string; onSelect: (key: string) => void }) {
  // Prerendered HTML must stay clock-independent: a static /today build would
  // otherwise freeze the build week into the DOM (labels out of sync with the
  // click handlers, aria-current on the wrong day), so dates only render once
  // the client has mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const days = stripDays(today);

  if (!mounted) {
    // Same outer group and cell metrics as the real strip, so nothing shifts
    // when the dated cells arrive — but no date text, keys or states.
    // The zero-width space is load-bearing: the real 11px weekday label builds
    // a 16.5px line box (11px × inherited 1.5 line-height) while an empty
    // blockified span is a zero-height flex item (placeholder 72px vs real
    // 88.5px). The ZWSP raises the same strut line box at the same
    // font-size/line-height, making the placeholder exactly as tall as the
    // real strip — no magic height number to drift out of sync.
    return (
      <div className="flex items-center justify-between gap-1 px-4 py-3" role="group" aria-label="Choose a day">
        {PLACEHOLDERS.map((index) => (
          <div key={index} aria-hidden className="relative flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px]">&#8203;</span>
            <div className="h-11 w-11 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-1 px-4 py-3" role="group" aria-label="Choose a day">
      {days.map((key, index) => {
        const kind = classifyDate(key, today);
        const isSelected = key === selected;
        const disabled = kind === 'future';
        const showConnector = index > 0 && index < 6; // joins the 5 past days + today

        return (
          <div key={key} className="relative flex flex-1 flex-col items-center gap-1">
            {showConnector && (
              <span aria-hidden
                    className="absolute top-[26px] right-1/2 left-1/2 h-0.5 -translate-x-1/2 bg-[var(--color-accent)]"
                    style={{ width: '100%' }} />
            )}
            <span className={`text-[11px] ${isSelected ? 'font-bold text-[var(--color-fg)]' : 'text-[var(--color-subtle)]'}`}>
              {formatWeekday(key)}
            </span>
            <button
              type="button"
              disabled={disabled}
              aria-current={isSelected ? 'date' : undefined}
              aria-label={key}
              onClick={() => !disabled && onSelect(key)}
              className={[
                'relative z-10 grid place-items-center rounded-full text-xs font-semibold transition',
                isSelected
                  ? 'h-11 w-11 bg-[var(--color-accent)] text-[var(--color-on-accent)] ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]'
                  : kind === 'past'
                    ? 'h-10 w-10 bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'h-8 w-8 text-[var(--color-subtle)]',
                disabled ? 'opacity-50' : 'hover:opacity-90',
              ].join(' ')}
            >
              {Number(key.slice(8, 10))}
            </button>
          </div>
        );
      })}
    </div>
  );
}
