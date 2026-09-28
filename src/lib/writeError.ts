'use client';

import { useSyncExternalStore } from 'react';

export const WRITE_FAILURE = "Couldn't save that change — your browser storage may be full.";
const AUTO_DISMISS_MS = 8000;

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Route any failed IndexedDB write to the shared banner (spec R3.3). */
export function reportWriteError(err?: unknown): void {
  if (err !== undefined) console.error('[habibit] write failed', err);
  message = WRITE_FAILURE;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { message = null; timer = null; emit(); }, AUTO_DISMISS_MS);
  emit();
}

export function dismissWriteError(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  message = null;
  emit();
}

export function useWriteError(): string | null {
  return useSyncExternalStore(subscribe, () => message, () => null);
}
