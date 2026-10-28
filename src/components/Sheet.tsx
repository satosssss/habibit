'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

// Spec §6 pins the timer to a dark sheet in every theme; the darkness now
// comes from the heavier scrim (slice D R7), not a panel fill — the frosted
// surface stays neutral and only the light text is fixed.
const TIMER_SURFACE = { fg: '#f5f5f7' };

// Custom properties live only in globals.css, so resolve the themed text off
// the theme root at render (the boot script sets data-theme before first
// paint, and the sheet itself only ever opens from client state). The light
// literal is the :root fallback.
const themedFg = (): string =>
  typeof document === 'undefined'
    ? 'rgba(20, 16, 12, 0.90)'
    : getComputedStyle(document.documentElement).getPropertyValue('--color-fg').trim()
      || 'rgba(20, 16, 12, 0.90)';

// Centered-dialog classes per breakpoint: other consumers keep the original
// md (768px) default; the timer modal asks for lg (1024px, spec §6).
const CENTER = {
  md: { wrap: 'md:items-center', panel: 'md:max-w-lg md:rounded-[28px]' },
  lg: { wrap: 'lg:items-center', panel: 'lg:max-w-lg lg:rounded-[28px]' },
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
  const color = dark ? TIMER_SURFACE.fg : themedFg();
  const center = CENTER[centerFrom];

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${center.wrap}`}>
      {/* Full class literals in-source: Tailwind's scanner only generates
          rules for strings it finds in component files — fragments like
          `bg-black/${…}` would silently ship an undimmed sheet if the test
          copies of these classes ever changed. */}
      <div data-sheet-backdrop className={`absolute inset-0 ${dark ? 'bg-black/75' : 'bg-black/50'} backdrop-blur-sm`}
            onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}
           className={`relative z-10 glass-heavy max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] rounded-b-none p-5 ${center.panel}`}
           style={{ color }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
