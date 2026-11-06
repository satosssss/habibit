'use client';

import { useSyncExternalStore } from 'react';
import type { Challenge } from './types';

const AUTO_DISMISS_MS = 4000;

let current: Challenge | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/**
 * Challenges spec §UX: celebrate only the TRANSITION to won — callers pass
 * challenges returned by evaluateChallenges(), which never re-returns a
 * terminal challenge, so an already-won challenge can never replay on boot.
 * A fresh win replaces any visible one and restarts the single timer
 * (same mechanics as celebrateIfCompleted).
 */
export function celebrateChallengeWin(c: Challenge): void {
  current = c;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { current = null; timer = null; emit(); }, AUTO_DISMISS_MS);
  emit();
}

/** Filter helper for evaluateChallenges() results: only `won` pops the overlay. */
export function celebrateWins(transitions: Challenge[]): void {
  for (const c of transitions) if (c.status === 'won') celebrateChallengeWin(c);
}

export function dismissChallengeWin(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  current = null;
  emit();
}

export function useChallengeWin(): Challenge | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
