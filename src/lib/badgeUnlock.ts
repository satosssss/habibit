'use client';

import { useSyncExternalStore } from 'react';
import type { EarnedBadge } from './types';

const AUTO_DISMISS_MS = 4500;

/**
 * Badges spec R6: one unlock toast at a time. `evaluateBadges` returns only
 * rows it inserted, so an already-earned badge can never replay on boot; this
 * store just serialises several new badges into a queue.
 */
const queue: EarnedBadge[] = [];
let current: EarnedBadge | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function advance(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  current = queue.shift() ?? null;
  if (current) timer = setTimeout(advance, AUTO_DISMISS_MS);
  emit();
}

export function celebrateBadges(badges: EarnedBadge[]): void {
  const known = new Set(queue.map((b) => b.id));
  if (current) known.add(current.id);
  const fresh = badges.filter((b) => !known.has(b.id));
  if (fresh.length === 0) return;
  queue.push(...fresh);
  if (!current) advance();
}

/** Dismiss (tap or close button) skips the visible badge and shows the next. */
export function dismissBadgeUnlock(): void {
  advance();
}

export function useBadgeUnlock(): EarnedBadge | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
