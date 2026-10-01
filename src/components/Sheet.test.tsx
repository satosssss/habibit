import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { stylesheetForJsdom } from '@/lib/testStylesheet';
import { Sheet } from './Sheet';

// Vitest runs with css:false, so inject the real stylesheet and assert against
// it (same pattern as globals.test.ts): the sheet reads the theme tokens from
// the document root, and those tokens only exist in globals.css.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../app/globals.css'), 'utf8');
let themeStyle: HTMLStyleElement;

beforeAll(() => {
  themeStyle = document.createElement('style');
  themeStyle.dataset.from = 'globals';
  themeStyle.textContent = stylesheetForJsdom(css);
  document.head.appendChild(themeStyle);
});
afterAll(() => themeStyle.remove());
afterEach(() => { delete document.documentElement.dataset.theme; });

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={vi.fn()} title="Timer"><span>body</span></Sheet>);
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Timer"><span>body</span></Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not the panel', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Sheet open onClose={onClose} title="Timer"><span>body</span></Sheet>
    );
    fireEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('[data-sheet-backdrop]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('centers as a dialog from md by default', () => {
    const { container } = render(
      <Sheet open onClose={vi.fn()} title="Timer"><span>body</span></Sheet>
    );
    const wrap = container.querySelector('[data-sheet-backdrop]')!.parentElement!;
    expect(wrap.className).toContain('md:items-center');
    expect(screen.getByRole('dialog').className).toContain('md:max-w-lg');
  });

  it('defers the centered dialog to lg when asked (timer breakpoint, spec §6)', () => {
    const { container } = render(
      <Sheet open onClose={vi.fn()} title="Timer" centerFrom="lg"><span>body</span></Sheet>
    );
    const wrap = container.querySelector('[data-sheet-backdrop]')!.parentElement!;
    expect(wrap.className).toContain('lg:items-center');
    expect(wrap.className).not.toContain('md:items-center');
    expect(screen.getByRole('dialog').className).toContain('lg:max-w-lg');
    expect(screen.getByRole('dialog').className).not.toContain('md:max-w-lg');
  });

  // Slice D R7: the surface now comes from the .glass-heavy class (backdrop
  // frosting over the scene); only the themed text stays inline. Replaces the
  // branch-review #3 pins, which asserted inline background/border values.
  describe('glass surfaces (slice D R7; replaces branch-review #3 pins)', () => {
    it('frosts the dark panel with themed text and no inline surface', () => {
      document.documentElement.dataset.theme = 'dark';
      render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
      const panel = screen.getByRole('dialog');
      expect(panel.className).toContain('glass-heavy');
      expect(panel.style.background).toBe('');                          // surface comes from the class
      expect(panel.style.color).toBe('rgba(255, 248, 240, 0.95)');      // --color-fg (dark)
    });

    it('frosts the light panel with themed text and no inline surface', () => {
      document.documentElement.dataset.theme = 'light';
      render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
      const panel = screen.getByRole('dialog');
      expect(panel.className).toContain('glass-heavy');
      expect(panel.style.background).toBe('');
      expect(panel.style.color).toBe('rgba(20, 16, 12, 0.9)');          // --color-fg (light), cssstyle-serialized
    });

    it('keeps the timer sheet dark in light theme via the heavy scrim (spec §6)', () => {
      document.documentElement.dataset.theme = 'light';
      const { container } = render(<Sheet open dark onClose={vi.fn()} title="Timer"><span>body</span></Sheet>);
      const panel = screen.getByRole('dialog');
      expect(panel.className).toContain('glass-heavy');
      expect(panel.style.background).toBe('');
      expect(panel.style.color).toBe('rgb(245, 245, 247)');             // fixed light text on dark glass
      const scrim = container.querySelector('[data-sheet-backdrop]')!;
      expect(scrim.className).toContain('bg-black/75');
      expect(scrim.className).toContain('backdrop-blur-sm');
    });

    it('keeps the non-timer scrim blurring and the layer under the toast (z-order)', () => {
      const { container } = render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
      const scrim = container.querySelector('[data-sheet-backdrop]')!;
      expect(scrim.className).toContain('bg-black/50');
      expect(scrim.className).toContain('backdrop-blur-sm');
      expect(scrim.parentElement!.className).toContain('z-50');          // toast stays z-[60] above it
    });

    it('declares the full scrim classes in Sheet.tsx (Tailwind scanner, slice D review)', () => {
      // The rendered class is assembled by a ternary; if the complete literals
      // lived only in this test file, Tailwind would generate the scrim rules
      // from test text — rewriting tests could silently strip the dim.
      const src = readFileSync(join(here, 'Sheet.tsx'), 'utf8');
      expect(src).toContain("'bg-black/75'");
      expect(src).toContain("'bg-black/50'");
    });
  });

  describe('focus management (spec R5.2)', () => {
    it('moves focus into the panel on open and restores the opener on close', () => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>open</button>
            <Sheet open={open} onClose={() => setOpen(false)} title="Menu">
              <button type="button">inside</button>
            </Sheet>
          </>
        );
      }
      render(<Harness />);
      const opener = screen.getByRole('button', { name: 'open' });
      opener.focus();
      fireEvent.click(opener);
      const panel = screen.getByRole('dialog');
      expect(document.activeElement).toBe(panel);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.activeElement).toBe(opener);    // focus restored
    });

    it('traps Tab inside the panel, wrapping in both directions', () => {
      render(
        <Sheet open onClose={vi.fn()} title="Menu">
          <button type="button">first</button>
          <button type="button">last</button>
        </Sheet>,
      );
      const panel = screen.getByRole('dialog');
      expect(document.activeElement).toBe(panel);                 // initial: the panel
      // The header Close button precedes the children in DOM order, so it is
      // the panel's first focusable — correct dialog tab order, still inside.
      const close = screen.getByRole('button', { name: 'Close' });
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(close);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'last' })); // wraps up
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(close);                  // wraps down
    });

    it('locks body scroll while open and restores it on close', () => {
      const { unmount } = render(
        <Sheet open onClose={vi.fn()} title="Menu"><span>body</span></Sheet>,
      );
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });
});
