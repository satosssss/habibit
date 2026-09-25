import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
  themeStyle.textContent = css;
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

  // Branch review #3: surfaces must come from the theme tokens, not hardcoded
  // white — dark theme used to open white panels with dark-palette inner borders.
  describe('theme tokens (branch review #3)', () => {
    it('renders the dark token surface when data-theme is dark', () => {
      document.documentElement.dataset.theme = 'dark';
      render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
      const panel = screen.getByRole('dialog');
      expect(panel.style.background).toBe('rgb(11, 11, 15)');        // --color-bg (dark)
      expect(panel.style.color).toBe('rgb(245, 245, 247)');          // --color-fg (dark)
      expect(panel.style.border).toBe('1px solid rgb(38, 38, 46)');  // --color-line (dark)
    });

    it('keeps the light surface exactly as before', () => {
      document.documentElement.dataset.theme = 'light';
      render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
      const panel = screen.getByRole('dialog');
      expect(panel.style.background).toBe('rgb(255, 255, 255)');     // --color-bg (light)
      expect(panel.style.color).toBe('rgb(15, 23, 42)');             // --color-fg (light)
      expect(panel.style.border).toBe('1px solid rgb(226, 232, 240)'); // --color-line (light)
    });

    it('keeps the timer sheet on its fixed dark surface in light theme (spec §6)', () => {
      document.documentElement.dataset.theme = 'light';
      render(<Sheet open dark onClose={vi.fn()} title="Timer"><span>body</span></Sheet>);
      const panel = screen.getByRole('dialog');
      expect(panel.style.background).toBe('rgb(17, 17, 22)');
      expect(panel.style.color).toBe('rgb(245, 245, 247)');
    });
  });
});
