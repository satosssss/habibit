'use client';

import { classifyDate, formatWeekday, stripDays } from '@/lib/dates';

export function DateStrip({
  selected, today, onSelect,
}: { selected: string; today: string; onSelect: (key: string) => void }) {
  const days = stripDays(today);

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
            {/* Weekday label and day numeral are date-derived text; the prerendered
                build week can't match the client's current week on hydration. */}
            <span suppressHydrationWarning
                  className={`text-[11px] ${isSelected ? 'font-bold text-[var(--color-fg)]' : 'text-[var(--color-subtle)]'}`}>
              {formatWeekday(key)}
            </span>
            <button
              type="button"
              suppressHydrationWarning
              disabled={disabled}
              aria-current={isSelected ? 'date' : undefined}
              aria-label={key}
              onClick={() => !disabled && onSelect(key)}
              className={[
                'relative z-10 grid place-items-center rounded-full text-xs font-semibold transition',
                isSelected
                  ? 'h-11 w-11 bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]'
                  : kind === 'past'
                    ? 'h-8 w-8 bg-[var(--color-accent)] text-white'
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
