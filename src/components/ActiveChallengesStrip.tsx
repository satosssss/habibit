'use client';

import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { challengeProgress, challengeTitle } from '@/lib/challenges';
import { todayKey } from '@/lib/dates';
import { activeChallenges, listHabits, loadRange } from '@/lib/repo';
import { allTimeStart } from '@/lib/stats';
import { useLiveQuery } from '@/lib/useLiveQuery';

/** Home check-in strip (challenges spec §UX): coach-card-style rows for each
 *  active challenge with live progress; hidden entirely when none are active. */
export function ActiveChallengesStrip() {
  const habits = useLiveQuery(() => listHabits(), []);
  const active = useLiveQuery(() => activeChallenges(), []);
  const today = todayKey();
  const entries = useLiveQuery(() => loadRange(allTimeStart(habits ?? []), today), [habits, today]);

  if (!active?.length || habits === undefined || entries === undefined) return null;

  return (
    <section aria-label="Active challenges" className="mb-4 flex flex-col gap-2 px-1">
      {active.map((c) => {
        const p = challengeProgress(c, habits, entries, today);
        return (
          <Link key={c.id} href="/challenges"
                className="glass-card flex items-center gap-2 rounded-2xl px-4 py-3 text-sm">
            <Trophy size={16} className="shrink-0 text-[var(--color-accent)]" aria-hidden />
            <span className="font-semibold">{challengeTitle(c.type)}</span>
            <span className="min-w-0 truncate text-xs text-[var(--color-subtle)]">— {c.scopeLabel}</span>
            <span className="ml-auto shrink-0 text-xs font-bold">{p.label}</span>
          </Link>
        );
      })}
    </section>
  );
}
