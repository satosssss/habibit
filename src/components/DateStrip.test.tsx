import { fireEvent, render, screen } from '@testing-library/react';
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
});
