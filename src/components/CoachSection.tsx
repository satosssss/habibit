'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { dismissSuggestion, liveDismissals, visibleInsights } from '@/lib/coach';
import type { CoachInsight } from '@/lib/coach';
import { putHabit } from '@/lib/repo';
import { reportWriteError } from '@/lib/writeError';
import type { Habit } from '@/lib/types';

const GROUPS: Array<{ heading: string; match: (i: CoachInsight) => boolean }> = [
  { heading: 'Needs attention', match: (i) => i.kind === 'struggle' },
  { heading: 'Level up', match: (i) => i.category === 'difficulty' || i.category === 'target' },
  { heading: 'Celebrate', match: (i) =>
      i.category === 'reward-streak' || i.category === 'reward-day' || i.category === 'encouragement' },
];

/** One suggestion row — shared by CoachSection and CoachCard (coach spec §3).
 *  py-2.5 on the row keeps the whole row ≥40px; the Apply and dismiss controls
 *  are h-10 (40px) per the house tap-target rule (tapTargets.test.ts pins both). */
export function CoachRow({ insight, applying, onApply, onDismiss }: {
  insight: CoachInsight;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{insight.title}</p>
        <p className="text-sm text-[var(--color-subtle)]">{insight.body}</p>
        {insight.patch && (
          <button type="button" onClick={onApply} disabled={applying}
                  className="btn-primary mt-2 h-10 px-4 text-sm">
            Apply
          </button>
        )}
      </div>
      <button type="button" aria-label="Dismiss suggestion" onClick={onDismiss}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-muted)]">
        <X size={16} />
      </button>
    </div>
  );
}

export function CoachSection({ insights, habits }: { insights: CoachInsight[]; habits: Habit[] }) {
  const [dismissed, setDismissed] = useState(() => liveDismissals());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // Cap across the whole list before grouping (spec R3: 6 rows max).
  const visible = visibleInsights(insights, dismissed).slice(0, 6);

  const apply = async (insight: CoachInsight) => {
    if (!insight.patch || !insight.habitId) return;      // text-only rows have no Apply
    const habit = habits.find((h) => h.id === insight.habitId);
    if (!habit) return;
    setApplyingId(insight.id);
    try {
      await putHabit({ ...habit, ...insight.patch });
    } catch (err) {
      reportWriteError(err);                             // shared banner (spec R4.3)
    } finally {
      setApplyingId(null);
    }
  };

  const dismiss = (id: string) => {
    dismissSuggestion(id);                               // persists + prunes (7-day TTL)
    setDismissed(liveDismissals());                      // immediate hide
  };

  if (visible.length === 0) return null;

  return (
    <div>
      {GROUPS.map(({ heading, match }) => {
        const rows = visible.filter(match);
        if (rows.length === 0) return null;              // empty groups render nothing
        return (
          <div key={heading}>
            <h2 className="mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
              {heading}
            </h2>
            <div className="glass-card px-4 py-1">
              {rows.map((insight, i) => (
                // `-i` disambiguates ids that legitimately repeat (all three
                // struggle categories share struggle:{habitId} — dismissing
                // one dismisses the whole struggle, spec I4).
                <CoachRow key={`${insight.id}-${i}`} insight={insight}
                          applying={applyingId === insight.id}
                          onApply={() => void apply(insight)}
                          onDismiss={() => dismiss(insight.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
