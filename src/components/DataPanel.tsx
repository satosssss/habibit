'use client';

import { Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { clearAll, exportState, importState } from '@/lib/repo';
import { seedIfEmpty } from '@/lib/seed';

export function DataPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportJson = async () => {
    const data = await exportState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habibit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: 'ok', text: 'Exported.' });
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
    await clearAll();
    await seedIfEmpty();
    setConfirmReset(false);
    setMessage({ kind: 'ok', text: 'Reset and re-seeded.' });
  };

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Data</h2>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportJson()}
                className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold">
          <Download size={15} /> Export JSON
        </button>

        <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold">
          <Upload size={15} /> Import JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="sr-only"
               aria-label="Import JSON file"
               onChange={(e) => void importJson(e.target.files?.[0])} />

        <button type="button" onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 rounded-2xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-500">
          <RotateCcw size={15} /> Reset data
        </button>
      </div>

      {confirmReset && (
        <div className="mt-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="mb-2 font-semibold">Erase everything and restore the example habits?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmReset(false)}
                    className="rounded-xl border border-[var(--color-line)] px-3 py-1.5">Cancel</button>
            <button type="button" onClick={() => void reset()}
                    className="rounded-xl bg-red-600 px-3 py-1.5 font-semibold text-white">Yes, reset</button>
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
