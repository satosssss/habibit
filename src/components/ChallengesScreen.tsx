'use client';

import { Check, Plus, Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { allTimeStart, isScheduled } from '@/lib/stats';
import { challengeProgress, challengeTitle, weekendWindow } from '@/lib/challenges';
import { celebrateWins } from '@/lib/challengeWin';
import { formatShort, todayKey, toKey } from '@/lib/dates';
import { evaluateChallenges, joinChallenge, listChallenges, listHabits, loadRange, MAX_ACTIVE_CHALLENGES } from '@/lib/repo';
import { reportWriteError } from '@/lib/writeError';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { ChallengeType } from '@/lib/types';
import { Sheet } from './Sheet';

const MODES: ReadonlyArray<{ type: ChallengeType; blurb: string }> = [
  { type: 'streak7', blurb: 'Keep one habit alive for 7 straight days.' },
  { type: 'weekend', blurb: 'Complete everything scheduled this Saturday and Sunday.' },
  { type: 'category7', blurb: '7 perfect days in a row across one category.' },
];

export function ChallengesScreen() {
  const habits = useLiveQuery(() => listHabits(), []);
  const challenges = useLiveQuery(() => listChallenges(), []);
  const [picking, setPicking] = useState<ChallengeType | null>(null);
  const [joining, setJoining] = useState<ChallengeType | null>(null);
  const today = todayKey();

  // Surface load evaluation: closes time-based weekend fails and catches wins
  // earned since the last boot pass; returned `won` transitions celebrate once.
  useEffect(() => {
    evaluateChallenges().then(celebrateWins).catch(reportWriteError);
  }, []);

  // Entries needed to derive progress: the same window Home / Task 7's strip
  // load — from allTimeStart to today — so pre-join streak days count toward
  // progress (spec G2) and the window never starves the pure engine.
  const entries = useLiveQuery(() => loadRange(allTimeStart(habits ?? []), today), [habits, today]);

  const active = useMemo(() => (challenges ?? []).filter((c) => c.status === 'active'), [challenges]);
  const results = useMemo(() => (challenges ?? [])
    .filter((c) => c.status !== 'active')
    .sort((a, b) => (b.resultAt ?? 0) - (a.resultAt ?? 0)), [challenges]);
  const won = results.filter((c) => c.status === 'won');
  const closed = results.filter((c) => c.status !== 'won');

  const activeOfType = (type: ChallengeType) => active.some((c) => c.type === type);
  const scopeReady = (type: ChallengeType): boolean => {
    if (!habits) return false;
    if (type === 'streak7') return habits.length > 0;
    if (type === 'weekend') {
      if (habits.length === 0) return false;
      // No-vacuous-win join guard (spec line 25/30): a weekday-only account
      // would win the moment the window matures, so require something to be
      // scheduled on the TARGET weekend (the first Saturday on/after today).
      const { saturday, sunday } = weekendWindow(Date.now());
      return habits.some((h) => isScheduled(h, saturday) || isScheduled(h, sunday));
    }
    return habits.some((h) => h.category.trim().length > 0);
  };
  // Per-type explanation for a blocked (empty-scope) card: weekend's scope gap
  // is scheduling, not existence — "Add a habit first" would be wrong there.
  const scopeHint = (type: ChallengeType): string => type === 'weekend'
    ? 'No habit is scheduled on the target weekend.'
    : 'Add a category first — a challenge needs a scope.';
  const capFull = active.length >= MAX_ACTIVE_CHALLENGES;

  const categories = useMemo(() => {
    const set = new Set((habits ?? []).map((h) => h.category).filter((c) => c.trim().length > 0));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [habits]);

  const join = async (type: ChallengeType, opts: { habitId?: string; category?: string; scopeLabel: string } | null) => {
    if (!opts) return;
    setJoining(type);
    try {
      await joinChallenge({ type, ...opts });
      setPicking(null);
    } catch (err) { reportWriteError(err); }
    finally { setJoining(null); }
  };

  const pickFor = (type: ChallengeType): { habitId?: string; category?: string; scopeLabel: string } | null => {
    if (type === 'weekend') return { scopeLabel: 'All habits' };
    return null; // pickers resolve via the Sheet below
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold">Challenges</h1>

      {/* 1 — Active */}
      {active.length > 0 && (
        <section aria-label="Active challenges" className="mb-8">
          <h2 className="mb-2 text-sm font-bold text-[var(--color-subtle)]">Active</h2>
          <ul className="flex flex-col gap-3">
            {active.map((c) => {
              const p = challengeProgress(c, habits ?? [], entries ?? [], today);
              const pct = Math.round((p.current / p.total) * 100);
              return (
                <li key={c.id} className="glass-card rounded-2xl p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Trophy size={16} className="text-[var(--color-accent)]" aria-hidden />
                    <span className="text-sm font-bold">{challengeTitle(c.type)}</span>
                    <span className="text-xs text-[var(--color-subtle)]">— {c.scopeLabel}</span>
                  </div>
                  <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">{p.label}</p>
                  <div role="progressbar" aria-valuenow={p.current} aria-valuemin={0} aria-valuemax={p.total}
                       aria-label={`${challengeTitle(c.type)} progress`}
                       className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 2 — Join */}
      <section aria-label="Join a challenge" className="mb-8">
        <h2 className="mb-2 text-sm font-bold text-[var(--color-subtle)]">Start a new challenge</h2>
        {/* Empty-account hint renders once — not per card — so it stays a
            single node for assistive tech and for tests. Only reachable scope
            gaps get a card-level hint (category7 with uncategorised habits). */}
        {habits !== undefined && habits.length === 0 && (
          <p className="mb-3 rounded-2xl glass-card px-4 py-3 text-sm">
            Add a habit first — a challenge needs a scope.
          </p>
        )}
        {capFull && (
          <p className="mb-3 rounded-2xl glass-card px-4 py-3 text-sm">
            You can hold up to 3 active challenges at once — finish or replace one to join another.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {MODES.map(({ type, blurb }) => {
            const ready = scopeReady(type);
            const replacing = activeOfType(type);
            const blocked = capFull && !replacing;
            return (
              <li key={type} className="glass-card rounded-2xl p-4">
                <p className="mb-1 text-sm font-bold">{challengeTitle(type)}</p>
                <p className="mb-3 text-xs text-[var(--color-subtle)]">{blurb}</p>
                {!ready && habits !== undefined && habits.length > 0
                  && <p className="mb-2 text-xs text-[var(--color-subtle)]">{scopeHint(type)}</p>}
                <button type="button" disabled={!ready || blocked || joining === type}
                        onClick={() => {
                          const direct = pickFor(type);
                          if (direct) void join(type, direct);
                          else setPicking(type);
                        }}
                        className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm">
                  <Plus size={16} aria-hidden />
                  {replacing ? 'Replace' : 'Join'} {challengeTitle(type)}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3 — Results shelf */}
      {(won.length > 0 || closed.length > 0) && (
        <section aria-label="Past challenges">
          <h2 className="mb-2 text-sm font-bold text-[var(--color-subtle)]">Results</h2>
          <ul className="flex flex-col gap-2">
            {won.map((c) => (
              <li key={c.id} className="glass-row flex items-center gap-2 rounded-2xl px-4 py-3 text-sm">
                <Check size={16} className="text-[var(--color-accent)]" aria-hidden />
                <span className="font-semibold">{challengeTitle(c.type)}</span>
                <span className="text-xs text-[var(--color-subtle)]">{c.scopeLabel}</span>
                {/* Spec line 80: "✓ + date". Legacy rows may lack resultAt —
                    fall back to the join date. */}
                <span className="text-xs text-[var(--color-subtle)]">{formatShort(toKey(new Date(c.resultAt ?? c.startedAt)))}</span>
                <span className="ml-auto text-xs font-semibold">Won</span>
              </li>
            ))}
            {closed.map((c) => (
              <li key={c.id} className="glass-row flex items-center gap-2 rounded-2xl px-4 py-3 text-sm opacity-70">
                <X size={16} className="text-[var(--color-subtle)]" aria-hidden />
                <span className="font-semibold">{challengeTitle(c.type)}</span>
                <span className="text-xs text-[var(--color-subtle)]">{c.scopeLabel}</span>
                {/* Spec line 96: "✗ + date"; resultAt ?? startedAt for legacy rows. */}
                <span className="text-xs text-[var(--color-subtle)]">{formatShort(toKey(new Date(c.resultAt ?? c.startedAt)))}</span>
                <span className="ml-auto text-xs font-semibold">{c.status === 'failed' ? 'Failed' : 'Replaced'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Scope pickers — the existing Sheet pattern (role=dialog, focus trap) */}
      {picking && (
        <Sheet open onClose={() => setPicking(null)} title={`Choose a scope — ${challengeTitle(picking)}`}>
          {picking === 'streak7' && (
            <ul className="flex flex-col gap-2">
              {(habits ?? []).map((h) => (
                <li key={h.id}>
                  <button type="button"
                          onClick={() => void join('streak7', { habitId: h.id, scopeLabel: h.name })}
                          className="min-h-11 w-full rounded-2xl bg-[var(--color-muted)] px-4 py-3 text-left text-sm font-medium">
                    {h.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picking === 'category7' && (
            <ul className="flex flex-col gap-2">
              {categories.map((cat) => (
                <li key={cat}>
                  <button type="button"
                          onClick={() => void join('category7', { category: cat, scopeLabel: cat })}
                          className="min-h-11 w-full rounded-2xl bg-[var(--color-muted)] px-4 py-3 text-left text-sm font-medium">
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </div>
  );
}
