'use client';

import { Check, Flame, Star, Trophy, X } from 'lucide-react';
import { badgeById, type BadgeIcon } from '@/lib/badges';
import { dismissBadgeUnlock, useBadgeUnlock } from '@/lib/badgeUnlock';

const ICONS: Record<BadgeIcon, typeof Flame> = {
  flame: Flame, star: Star, check: Check, trophy: Trophy,
};

/**
 * Badges spec R6: a non-blocking unlock notice, top-center so it can never
 * collide with the challenge overlay or the bottom completion toast. The
 * region ignores pointer events; only the card is tappable. Focus never
 * moves — the polite status region announces the badge instead.
 */
export function BadgeToast() {
  const earned = useBadgeUnlock();
  if (!earned) return null;
  const def = badgeById(earned.id);
  if (!def) return null;              // unknown id (newer export): stay silent
  const Icon = ICONS[def.icon];
  return (
    <div data-testid="badge-toast"
         className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="pointer-events-auto relative flex max-w-full items-center gap-3 overflow-hidden rounded-2xl glass-card border border-[var(--glass-border)] py-2.5 pl-2.5 pr-1.5 shadow-lg motion-safe:animate-[toast-in_200ms_ease-out]">
        <span aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--glass-bg)] text-[var(--color-accent)] ring-2 ring-[var(--color-accent)] motion-safe:animate-[badge-pop_450ms_ease-out]">
          <Icon size={22} strokeWidth={2.5} />
        </span>
        <p role="status" aria-live="polite" aria-atomic="true" className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Badge unlocked
          </span>
          <span className="block truncate text-sm font-semibold text-[var(--color-fg)]">
            {def.title}
          </span>
        </p>
        <button type="button" onClick={dismissBadgeUnlock}
                aria-label="Dismiss badge notification"
                className="grid size-11 shrink-0 place-items-center rounded-xl text-[var(--color-muted)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--color-muted-hover)]">
          <X size={18} aria-hidden />
        </button>
        <span aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-[badge-shimmer_900ms_ease-out]" />
      </div>
    </div>
  );
}
