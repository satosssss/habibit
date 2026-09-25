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
});
