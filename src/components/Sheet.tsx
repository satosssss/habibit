'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

const SURFACE = {
  light: { bg: '#ffffff', fg: '#0f172a', line: '#e2e8f0' },
  dark: { bg: '#111116', fg: '#f5f5f7', line: '#2a2a33' },
};

// Centered-dialog classes per breakpoint: other consumers keep the original
// md (768px) default; the timer modal asks for lg (1024px, spec §6).
const CENTER = {
  md: { wrap: 'md:items-center', panel: 'md:max-w-lg md:rounded-3xl' },
  lg: { wrap: 'lg:items-center', panel: 'lg:max-w-lg lg:rounded-3xl' },
} as const;

export function Sheet({
  open, onClose, title, dark = false, centerFrom = 'md', children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  dark?: boolean;
  /** Viewport breakpoint from which the sheet renders as a centered dialog. */
  centerFrom?: 'md' | 'lg';
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const surface = dark ? SURFACE.dark : SURFACE.light;
  const center = CENTER[centerFrom];

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${center.wrap}`}>
      <div data-sheet-backdrop className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
           className={`relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 ${center.panel}`}
           style={{ background: surface.bg, color: surface.fg, border: `1px solid ${surface.line}` }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}
                  className="rounded-full p-1.5 opacity-70 hover:opacity-100">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
