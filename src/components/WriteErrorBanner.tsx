'use client';

import { TriangleAlert, X } from 'lucide-react';
import { dismissWriteError, useWriteError } from '@/lib/writeError';

export function WriteErrorBanner() {
  const message = useWriteError();
  if (!message) return null;
  return (
    <p role="alert" data-testid="write-error"
       className="m-3 flex items-start justify-between gap-3 glass-card px-4 py-3 text-sm">
      <span className="flex items-start gap-2">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-ink)]" />
        <span>{message}</span>
      </span>
      <button type="button" aria-label="Dismiss" onClick={dismissWriteError}
              className="shrink-0 rounded-full p-1 opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </p>
  );
}
