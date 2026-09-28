'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

// Spec §6 pins the timer to a dark bottom sheet in every theme; every other
// sheet follows the theme tokens so dark mode never opens a white panel
// (branch review #3). The light literals are the `:root` fallback values.
const TIMER_SURFACE = { bg: '#111116', fg: '#f5f5f7', line: '#2a2a33' };

// Custom properties live only in globals.css, so resolve them off the theme
// root at render (the boot script sets data-theme before first paint, and the
// sheet itself only ever opens from client state).
const themedSurface = () => {
  const value = (token: string, fallback: string): string =>
    typeof document === 'undefined'
      ? fallback
      : getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
  return {
    bg: value('--color-bg', '#ffffff'),
    fg: value('--color-fg', '#0f172a'),
    line: value('--color-line', '#e2e8f0'),
  };
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
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Spec R5.2: focus enters the panel on open, Tab cycles within it, and focus
  // returns to the opener on close. onClose lives in a ref so this effect runs
  // once per open transition — re-running would re-capture the panel itself as
  // the "opener". The overlay is not portaled, so background exclusion is
  // delivered by aria-modal + this trap rather than a native `inert` sibling
  // (which would inert the sheet itself — plan decision 4).
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const active = document.activeElement;
      const within = active instanceof Node && panel.contains(active);
      if (e.shiftKey) {
        if (!within || active === items[0] || active === panel) { e.preventDefault(); items[items.length - 1].focus(); }
      } else if (!within || active === items[items.length - 1] || active === panel) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-transition only; onClose via ref
  }, [open]);

  if (!open) return null;
  const surface = dark ? TIMER_SURFACE : themedSurface();
  const center = CENTER[centerFrom];

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${center.wrap}`}>
      <div data-sheet-backdrop className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}
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
