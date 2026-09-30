import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DateStrip } from './DateStrip';

const TODAY = '2026-09-23';

describe('DateStrip', () => {
  it('renders exactly 7 columns: 5 previous days, today, 1 future preview', () => {
    render(<DateStrip selected={TODAY} today={TODAY} onSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
    expect(buttons[5]).toHaveAccessibleName(expect.stringMatching(/23/));
    expect(buttons[5]).toHaveAttribute('aria-current', 'date');
  });

  it('disables only the future preview', () => {
    render(<DateStrip selected={TODAY} today={TODAY} onSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[6]).toBeDisabled();
    expect(buttons.slice(0, 6)).not.toContainEqual(expect.objectContaining({ disabled: true }));
    for (const b of buttons.slice(0, 6)) expect(b).toBeEnabled();
  });

  it('reports taps on enabled days only', () => {
    const onSelect = vi.fn();
    render(<DateStrip selected={TODAY} today={TODAY} onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]);
    expect(onSelect).toHaveBeenCalledWith('2026-09-22');
    fireEvent.click(buttons[6]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marks the selected day independently of today', () => {
    render(<DateStrip selected="2026-09-21" today={TODAY} onSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[3]).toHaveAttribute('aria-current', 'date');
    expect(buttons[5]).not.toHaveAttribute('aria-current', 'date');
  });

  // A statically prerendered /today embeds the build week into the HTML; date
  // text may therefore only appear after mount. The group itself stays so the
  // strip never shifts when the real cells arrive.
  it('prerenders clock-independent placeholders, then the 7 day buttons after mount', () => {
    const html = renderToString(<DateStrip selected={TODAY} today={TODAY} onSelect={vi.fn()} />);
    expect(html).toContain('aria-label="Choose a day"');
    expect(html).not.toContain('aria-label="2026-');           // no day keys
    expect(html).not.toMatch(/>(Mon|Tue|Wed|Thu|Fri|Sat|Sun)</); // no weekday labels
    expect(html).not.toMatch(/>[1-9]\d?</);                    // no day numerals
    expect(html).toContain('h-11 w-11 rounded-full');          // placeholder day cells
    expect((html.match(/h-11 w-11 rounded-full/g) ?? [])).toHaveLength(7);

    render(<DateStrip selected={TODAY} today={TODAY} onSelect={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('button', { name: '2026-09-23' })).toBeInTheDocument();
  });

  // Height contract: the real weekday label builds a line box (11px text on
  // the inherited 1.5 line-height = 16.5px), while an empty blockified span is
  // a zero-height flex item — pre-fix the placeholder strip measured 72px vs
  // the real 88.5px, so content below shifted down on every load. The
  // placeholder label slot must therefore carry a real line box too.
  it('gives every placeholder label slot a real line box (no layout shift on hydration)', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<DateStrip selected={TODAY} today={TODAY} onSelect={vi.fn()} />);

    const cells = container.querySelectorAll('[aria-hidden="true"]');
    expect(cells).toHaveLength(7); // placeholder count unchanged
    for (const cell of cells) {
      const dayCell = cell.querySelector(':scope > div');
      expect(dayCell).toHaveClass('h-11', 'w-11', 'rounded-full');
      const label = cell.querySelector(':scope > span');
      if (!label) throw new Error('placeholder label slot lost its line box');
      expect(label.className).toContain('text-[11px]');
      // The line-box mechanism: a zero-width space raises the same strut line
      // box as real weekday text at the same font-size/line-height.
      expect(label.textContent).toBe('\u200b');
    }
  });

  it('prints day numerals on accent fills with the on-accent token (slice D R1)', () => {
    render(<DateStrip selected={TODAY} today={TODAY} onSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[5].className).toContain('text-[var(--color-on-accent)]'); // selected today
    expect(buttons[4].className).toContain('text-[var(--color-on-accent)]'); // past day
    expect(buttons[6].className).toContain('text-[var(--color-subtle)]');    // future preview
    expect(buttons[6].className).not.toContain('text-white');
  });
});
