'use client';

import { useEffect, useState } from 'react';
import type { Habit } from '@/lib/types';
import { Sheet } from './Sheet';

export function ValueSheet({
  habit, value, open, onSave, onClose,
}: { habit: Habit; value: number; open: boolean; onSave: (v: number) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setDraft(String(value)); setError(null); } }, [open, value]);

  // `Number('')` is 0 — the empty string is checked explicitly so an empty
  // field can never read as a legitimate zero (spec R4: no silent wipes).
  const unit = habit.unit ? ` ${habit.unit}` : '';
  const parsed = Number(draft.trim());
  const valid = draft.trim() !== '' && Number.isFinite(parsed)
    && parsed >= 0 && parsed <= habit.target;

  const save = () => {
    if (!valid) {
      setError(`Enter a number from 0 to ${habit.target}${unit}.`);
      return;                                        // stay open — never discard silently
    }
    onSave(Math.floor(parsed));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={habit.name}>
      {/* noValidate: native range validation would block submit (and show a
          browser bubble we can't style or announce); our inline role="alert"
          validation below owns every rejection case (spec R4). */}
      <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="mb-1 block text-sm text-[var(--color-subtle)]">
          {habit.unit ? `Amount (${habit.unit})` : 'Amount'}
          <input
            type="number" inputMode="numeric" min={0} max={habit.target} value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            aria-invalid={error ? true : undefined}
            className="mt-1 glass-input text-base"
          />
        </label>
        <p className="mb-3 text-xs text-[var(--color-subtle)]">{`Maximum ${habit.target}${unit}.`}</p>
        {error && <p role="alert" className="mb-3 text-xs text-red-500">{error}</p>}
        <button type="submit"
                className="btn-primary w-full">
          Save
        </button>
      </form>
    </Sheet>
  );
}
