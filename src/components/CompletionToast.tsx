'use client';

import { Check } from 'lucide-react';
import { dismissCompletionToast, useCompletionToast } from '@/lib/completionToast';

/**
 * Slice A2 R2: a non-blocking congratulation. The region ignores pointer
 * events so it can never trap a tap meant for the list behind it; only the
 * card itself is tappable (dismiss). Focus is never moved here — the polite
 * status region announces the message instead.
 */
export function CompletionToast() {
  const message = useCompletionToast();
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" data-testid="completion-toast"
         className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-6">
      <button type="button"
              onClick={dismissCompletionToast}
              aria-label={message}
              className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl glass-card border border-[var(--glass-border)] px-4 py-3 text-sm font-semibold text-[var(--color-fg)] shadow-lg motion-safe:animate-[toast-in_200ms_ease-out]">
        <Check size={18} className="shrink-0 text-[var(--color-accent)]" strokeWidth={3} />
        <span className="truncate">{message}</span>
      </button>
    </div>
  );
}
