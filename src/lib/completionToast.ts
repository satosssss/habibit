'use client';

import { useSyncExternalStore } from 'react';
import { isCompleted } from './stats';
import type { Habit } from './types';

const AUTO_DISMISS_MS = 2000;

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/**
 * Slice A2 R2: celebrate only a genuine completion transition — never an
 * undo, a no-op rewrite, or an already-done value. A fresh celebration
 * replaces the visible message and restarts the single dismiss timer
 * (same mechanics as reportWriteError: replace, never stack).
 */
export function celebrateIfCompleted(habit: Habit, before: number, after: number): void {
  if (isCompleted(habit, before) || !isCompleted(habit, after)) return;
  message = `Nice work — ${habit.name} is done!`;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { message = null; timer = null; emit(); }, AUTO_DISMISS_MS);
  emit();
}

export function dismissCompletionToast(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  message = null;
  emit();
}

export function useCompletionToast(): string | null {
  return useSyncExternalStore(subscribe, () => message, () => null);
}
