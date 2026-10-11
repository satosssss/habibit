import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendChart } from './TrendChart';

describe('TrendChart', () => {
  it('splits the line at null gaps', () => {
    const { container } = render(
      <TrendChart points={[0.2, 0.3, null, 0.8, 0.9]} max={1} ariaLabel="t" testId="tc" />,
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
  });

  it('draws a zero value at the baseline instead of as a gap', () => {
    const { container } = render(<TrendChart points={[1, 0]} max={1} ariaLabel="t" testId="tc" />);
    expect(container.querySelectorAll('polyline')).toHaveLength(1);
  });

  it('scales values against max (0 at baseline, max at top)', () => {
    const { container } = render(<TrendChart points={[0, 1]} max={1} ariaLabel="t" testId="tc" />);
    expect(container.querySelector('polyline')!.getAttribute('points')).toBe('0,38 100,2');
  });

  it('draws a lone point as a round dot', () => {
    const { container } = render(
      <TrendChart points={[null, 0.5, null]} max={1} ariaLabel="t" testId="tc" />,
    );
    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    expect(container.querySelector('line[stroke-linecap="round"]')).not.toBeNull();
  });

  it('exposes the summary as an image label and renders HTML y ticks', () => {
    render(
      <TrendChart points={[0.5]} max={1} ariaLabel="Streak growth in 2026"
                  testId="trend-streak" yTicks={['100%', '50%', '0%']} />,
    );
    const svg = screen.getByTestId('trend-streak');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Streak growth in 2026');
    for (const t of ['100%', '50%', '0%']) expect(screen.getByText(t)).toBeInTheDocument();
  });
});
