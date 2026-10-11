import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PatternBars } from './PatternBars';

const data = [
  { label: 'M', value: 1, aria: 'Monday: 100% (1 of 1)' },
  { label: '', value: null, aria: 'Tuesday: nothing scheduled' },
  { label: '6a', value: 0.5, aria: '6 am: 4 completions' },
];

describe('PatternBars', () => {
  it('renders one list item per datum with its accessible text', () => {
    render(<PatternBars data={data} max={1} ariaLabel="By weekday" testId="pb" />);
    expect(screen.getByRole('list', { name: 'By weekday' })).toBeInTheDocument();
    expect(screen.getByText('Monday: 100% (1 of 1)')).toBeInTheDocument();
    expect(screen.getByText('Tuesday: nothing scheduled')).toBeInTheDocument();
  });

  it('scales bar heights against max and treats null as empty', () => {
    const { container } = render(<PatternBars data={data} max={1} ariaLabel="x" testId="pb" />);
    const bars = container.querySelectorAll<HTMLElement>('[data-bar]');
    expect(bars).toHaveLength(3);
    expect(bars[0].style.height).toBe('100%');
    expect(bars[1].style.height).toBe('0%');
    expect(bars[2].style.height).toBe('50%');
  });

  it('shows a visible tick label only where one is provided', () => {
    const { container } = render(<PatternBars data={data} max={1} ariaLabel="x" testId="pb" />);
    expect(screen.getByText('M')).toBeInTheDocument();
    const labels = container.querySelectorAll('[data-bar-label]');
    expect(labels).toHaveLength(3);
    expect(labels[1].textContent).toBe('');
  });

  it('exposes the testid on the region', () => {
    render(<PatternBars data={data} max={1} ariaLabel="x" testId="pattern-weekday" />);
    expect(screen.getByTestId('pattern-weekday')).toBeInTheDocument();
  });
});
