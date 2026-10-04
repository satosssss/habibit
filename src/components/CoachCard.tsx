'use client';

import { useState } from 'react';
import { todayKey } from '@/lib/dates';
import { dismissSuggestion, liveDismissals, visibleInsights } from '@/lib/coach';
import type { CoachInsight } from '@/lib/coach';
import { putHabit } from '@/lib/repo';
import { reportWriteError } from '@/lib/writeError';
import type { Habit } from '@/lib/types';
import { CoachRow } from './CoachSection';

/** Home check-in surface (coach spec §3/R4.2): one priority suggestion,
 *  today-only, one-tap apply, dismiss persisted to localStorage.
 *  The parent screens own the generateCoachInsights useMemo — this component
 *  only renders what it is handed. */
export function CoachCard({ insights, habits, date }: {
  insights: CoachInsight[];
  habits: Habit[];
  date: string;
}) {
  const [dismissed, setDismissed] = useState(() => liveDismissals());
  const [applying, setApplying] = useState(false);
  const top = visibleInsights(insights, dismissed)[0];

  if (date !== todayKey() || !top) return null;          // past/future browsing → no coach

  const apply = async () => {
    if (!top.patch || !top.habitId) return;
    const habit = habits.find((h) => h.id === top.habitId);
    if (!habit) return;
    setApplying(true);
    try {
      await putHabit({ ...habit, ...top.patch });        // engine re-runs via live query
    } catch (err) {
      reportWriteError(err);                             // NavShell banner (spec R4.2)
    } finally {
      setApplying(false);
    }
  };

  const dismiss = () => {
    dismissSuggestion(top.id);
    setDismissed(liveDismissals());
  };

  return (
    <section aria-label="Coach" className="glass-card mb-3 px-4 py-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Coach</p>
      <CoachRow insight={top} applying={applying} onApply={() => void apply()} onDismiss={dismiss} />
    </section>
  );
}
