'use client';

import { Check, Flame, Star, Trophy } from 'lucide-react';
import { BADGES, badgeSnapshot, badgeValue, type BadgeIcon } from '@/lib/badges';
import { formatShort, toKey } from '@/lib/dates';
import { listBadges, listChallenges } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { Entry, Habit } from '@/lib/types';

const ICONS: Record<BadgeIcon, typeof Flame> = {
  flame: Flame, star: Star, check: Check, trophy: Trophy,
};

/**
 * Badges spec R5: the full catalog, earned first (newest first), then locked
 * in catalog order. Everything is text-first — the medallion is decorative and
 * earned/locked is never colour-only.
 */
export function BadgesSection({ habits, entries, today }: {
  habits: Habit[]; entries: Entry[]; today: string;
}) {
  const badges = useLiveQuery(() => listBadges(), []);
  const challenges = useLiveQuery(() => listChallenges(), []);

  const earned = new Map((badges ?? []).map((b) => [b.id, b.earnedAt]));
  const snapshot = badges && challenges
    ? badgeSnapshot({ habits, entries, challenges, today })
    : null;

  // Unknown stored ids never render (forward compatibility, spec R3).
  const earnedDefs = BADGES.filter((b) => earned.has(b.id))
    .sort((a, b) => (earned.get(b.id) ?? 0) - (earned.get(a.id) ?? 0));
  const lockedDefs = BADGES.filter((b) => !earned.has(b.id));
  const ordered = [...earnedDefs, ...lockedDefs];

  return (
    <section aria-labelledby="badges-heading">
      <h2 id="badges-heading"
          className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
        Badges
      </h2>
      {!snapshot ? (
        <p className="skeleton p-4 text-center text-sm text-[var(--color-subtle)]">Loading badges…</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-[var(--color-subtle)]">
            {earnedDefs.length} of {BADGES.length} earned
          </p>
          <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {ordered.map((def) => {
              const earnedAt = earned.get(def.id);
              const Icon = ICONS[def.icon];
              const value = badgeValue(def, snapshot);
              // Challenge badges are binary; "0 / Win a …" reads badly, so the
              // locked copy stands alone there (numeric kinds keep progress).
              const progress = def.kind === 'challenge'
                ? def.description
                : `${value} / ${def.description}`;
              return (
                <li key={def.id}
                    data-testid={`badge-${def.id}`}
                    className={`glass-card flex items-start gap-3 px-3 py-3 ${
                      earnedAt ? 'ring-2 ring-[var(--color-accent)]' : ''
                    }`}>
                  <span aria-hidden
                        className={`grid size-9 shrink-0 place-items-center rounded-full bg-[var(--glass-bg)] ${
                          earnedAt ? 'text-[var(--color-accent)]' : 'text-[var(--color-subtle)]'
                        }`}>
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <p className={`break-words text-sm font-semibold ${
                      earnedAt ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'
                    }`}>
                      {def.title}
                    </p>
                    <p className="break-words text-xs text-[var(--color-subtle)]">
                      {earnedAt
                        ? `Earned ${formatShort(toKey(new Date(earnedAt)))}`
                        : progress}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
