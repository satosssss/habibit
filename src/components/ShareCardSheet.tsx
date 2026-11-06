'use client';

import { Download, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listBadges } from '@/lib/repo';
import { shareCardModel } from '@/lib/shareCard';
import { renderShareCard, shareCardBlob } from '@/lib/shareCardCanvas';
import type { Entry, Habit } from '@/lib/types';
import { useLiveQuery } from '@/lib/useLiveQuery';
import { Sheet } from './Sheet';

const PRIMARY = 'btn-primary px-4 py-2.5 text-sm font-semibold';
const SECONDARY = 'btn-glass px-4 py-2.5 text-sm font-semibold';

interface Preview {
  url: string;
  blob: Blob;
  filename: string;
}

/**
 * Share card spec R3: preview, download, and native share in the house Sheet.
 * The image is built locally from aggregate stats only; nothing leaves the
 * device unless the user picks Share.
 */
export function ShareCardSheet({
  open, onClose, habits, entries, year, today,
}: {
  open: boolean;
  onClose: () => void;
  habits: Habit[];
  entries: Entry[];
  year: number;
  today: string;
}) {
  const badges = useLiveQuery(() => listBadges(), []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<string | null>(null);

  const model = useMemo(
    () => (badges ? shareCardModel({ habits, entries, badges, year, today }) : null),
    [badges, habits, entries, year, today],
  );

  useEffect(() => {
    if (!open || !model) return;
    let cancelled = false;
    setPreview(null);
    setStatus(null);
    setBusy(true);
    void (async () => {
      try {
        const canvas = await renderShareCard(model);
        const blob = await shareCardBlob(canvas);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreview({ url, blob, filename: `habibit-${year}.png` });
      } catch {
        if (!cancelled) setStatus({ kind: 'error', text: "Couldn't create the card. Try again." });
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [open, model, year]);

  const file = preview ? new File([preview.blob], preview.filename, { type: 'image/png' }) : null;
  // Guarded because some browsers expose canShare but reject unsupported data.
  let shareable = false;
  if (file && typeof navigator !== 'undefined' && navigator.canShare) {
    try { shareable = navigator.canShare({ files: [file] }); } catch { shareable = false; }
  }

  const download = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = preview.filename;
    a.click();
    setStatus({ kind: 'ok', text: 'Card downloaded.' });
  };

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: `Habibit ${year}` });
      setStatus({ kind: 'ok', text: 'Card shared.' });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;   // user cancelled
      setStatus({ kind: 'error', text: "Couldn't share the card." });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Share your year">
      <div className="space-y-4">
        {!preview && (
          <p className="skeleton p-4 text-center text-sm text-[var(--color-subtle)]">
            {busy ? 'Building your card…' : 'No preview yet.'}
          </p>
        )}

        {preview && model && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob preview; next/image cannot optimize object URLs */}
            <img src={preview.url} alt={`Your ${year} Habibit year in review`}
                 className="mx-auto w-full max-w-sm rounded-2xl border border-[var(--glass-border)]" />
            <p className="text-sm text-[var(--color-subtle)]">
              {model.activeDays} active days · {model.perfectDays} perfect days ·{' '}
              {model.completions} completions · {model.ratePct}% completion rate
            </p>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          {shareable && (
            <button type="button" onClick={() => void share()} disabled={!preview}
                    className={PRIMARY}>
              <Share2 size={16} aria-hidden /> Share
            </button>
          )}
          <button type="button" onClick={download} disabled={!preview}
                  className={shareable ? SECONDARY : PRIMARY}>
            <Download size={16} aria-hidden /> Download PNG
          </button>
        </div>

        {status && (
          <p role={status.kind === 'error' ? 'alert' : 'status'}
             className={`text-sm ${status.kind === 'error' ? 'text-red-500' : 'text-[var(--color-subtle)]'}`}>
            {status.text}
          </p>
        )}
      </div>
    </Sheet>
  );
}
