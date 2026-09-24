'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function YearNav({
  year, minYear, maxYear, onChange,
}: { year: number; minYear: number; maxYear: number; onChange: (year: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button type="button" aria-label="Previous year" disabled={year <= minYear}
              onClick={() => onChange(year - 1)}
              className="grid h-8 w-8 place-items-center rounded-full disabled:opacity-30">
        <ChevronLeft size={18} />
      </button>
      <span suppressHydrationWarning className="text-lg font-extrabold tabular-nums">{year}</span>
      <button type="button" aria-label="Next year" disabled={year >= maxYear}
              onClick={() => onChange(year + 1)}
              className="grid h-8 w-8 place-items-center rounded-full disabled:opacity-30">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
