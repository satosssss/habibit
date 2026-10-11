export type BarDatum = { label: string; value: number | null; aria: string };

export function PatternBars({ data, max, ariaLabel, testId }: {
  data: BarDatum[]; max: number; ariaLabel: string; testId: string;
}) {
  return (
    <ul aria-label={ariaLabel} data-testid={testId}
        className="flex h-24 items-end gap-1">
      {data.map((d, i) => {
        const pct = d.value === null || max <= 0 ? 0 : (d.value / max) * 100;
        return (
          <li key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            {/* Screen readers get the full datum; the bar itself is decoration. */}
            <span className="sr-only">{d.aria}</span>
            <div className="flex min-h-0 flex-1 items-end" aria-hidden>
              <div data-bar className="w-full rounded-t-[3px] bg-[var(--color-accent)]"
                   style={{ height: `${pct}%` }} />
            </div>
            <span data-bar-label aria-hidden
                  className="h-4 shrink-0 text-center text-[10px] text-[var(--color-subtle)]">
              {d.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
