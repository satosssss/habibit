'use client';

import { Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { exportState, importState, resetToEmpty } from '@/lib/repo';

export function DataPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportJson = async () => {
    try {
      const data = await exportState();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habibit-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: 'ok', text: 'Exported.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Export failed.' });
    }
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); }
      catch { throw new Error('That file is not valid JSON.'); }
      await importState(parsed);          // validates fully before writing
      setMessage({ kind: 'ok', text: 'Imported.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const reset = async () => {
    try {
      await resetToEmpty();
      setConfirmReset(false);
      setMessage({ kind: 'ok', text: 'All data erased.' });
    } catch (err) {
      setConfirmReset(false);   // never strand the dialog over a failed write
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Reset failed.' });
    }
  };

  return (
    <section className="mt-6 glass-card p-4 mb-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Data</h2>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportJson()}
                className="flex items-center gap-2 btn-glass px-4 py-2.5 text-sm font-semibold">
          <Download size={15} /> Export JSON
        </button>

        <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 btn-glass px-4 py-2.5 text-sm font-semibold">
          <Upload size={15} /> Import JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="sr-only"
               aria-label="Import JSON file"
               onChange={(e) => void importJson(e.target.files?.[0])} />

        <button type="button" onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 btn-glass border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-500">
          <RotateCcw size={15} /> Reset data
        </button>
      </div>

      {confirmReset && (
        <div className="mt-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="mb-2 font-semibold">Erase all habits and history? This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmReset(false)}
                    className="btn-glass px-3 py-1.5 text-sm">Cancel</button>
            <button type="button" onClick={() => void reset()}
                    className="rounded-xl bg-red-600 px-3 py-1.5 font-semibold text-white">Yes, erase</button>
          </div>
        </div>
      )}

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
           className={`mt-3 text-sm ${message.kind === 'error' ? 'text-red-500' : 'text-[var(--color-subtle)]'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
