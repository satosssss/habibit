'use client';

import { useEffect, useState } from 'react';
import type { Habit } from '@/lib/types';
import { Sheet } from './Sheet';

export function ValueSheet({
  habit, value, open, onSave, onClose,
}: { habit: Habit; value: number; open: boolean; onSave: (v: number) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { if (open) setDraft(String(value)); }, [open, value]);

  const save = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed >= 0) onSave(Math.floor(parsed));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={habit.name}>
      <label className="mb-3 block text-sm text-[var(--color-subtle)]">
        {habit.unit ? `Amount (${habit.unit})` : 'Amount'}
        <input
          type="number" inputMode="numeric" min={0} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          className="mt-1 w-full rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 text-base outline-none focus:border-[var(--color-accent)]"
        />
      </label>
      <button type="button" onClick={save}
              className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-semibold text-white">
        Save
      </button>
    </Sheet>
  );
}
