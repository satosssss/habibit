import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressRing } from './ProgressRing';

describe('ProgressRing', () => {
  it('renders children in the centre', () => {
    render(<ProgressRing size={64} stroke={6} progress={0.5} color="#6366f1"><span>4/8</span></ProgressRing>);
    expect(screen.getByText('4/8')).toBeInTheDocument();
  });

  it('derives the dash offset from progress', () => {
    const { container } = render(
      <ProgressRing size={100} stroke={10} progress={0.25} color="#6366f1" />
    );
    const circle = container.querySelector('circle[data-progress]')!;
    expect(circle).toHaveAttribute('stroke-dashoffset', String(Math.PI * 80 * 0.75));
  });

  it('clamps progress into 0..1', () => {
    const { container } = render(<ProgressRing size={100} stroke={10} progress={5} color="#6366f1" />);
    const circle = container.querySelector('circle[data-progress]')!;
    expect(circle).toHaveAttribute('stroke-dashoffset', '0');
  });
});
