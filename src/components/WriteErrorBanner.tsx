'use client';

import { X } from 'lucide-react';
import { dismissWriteError, useWriteError } from '@/lib/writeError';

export function WriteErrorBanner() {
  const message = useWriteError();
  if (!message) return null;
  return (
    <p role="alert" data-testid="write-error"
       className="m-3 flex items-start justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <span>{message}</span>
      <button type="button" aria-label="Dismiss" onClick={dismissWriteError}
              className="shrink-0 rounded-full p-1 opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </p>
  );
}
