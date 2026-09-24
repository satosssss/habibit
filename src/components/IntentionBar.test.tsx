import { render, screen } from '@testing-library/react';
import { GraduationCap } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { IntentionBar } from './IntentionBar';

describe('IntentionBar', () => {
  it('shows the intention name, fraction and percentage width', () => {
    const { container } = render(
      <IntentionBar intention="Do Hard Things" color="#f97316" icon="crown" completed={69} scheduled={91} />
    );
    expect(screen.getByText('Do Hard Things')).toBeInTheDocument();
    expect(screen.getByText('69/91')).toBeInTheDocument();
    const fill = container.querySelector('[data-testid="intention-fill"]')!;
    expect(fill).toHaveStyle({ width: `${(69 / 91) * 100}%` });
    expect(fill).toHaveStyle({ background: '#f97316' });
  });

  it('never divides by zero', () => {
    render(<IntentionBar intention="Study" color="#38bdf8" icon="graduation" completed={0} scheduled={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('renders the icon mapped from a string name', () => {
    // Mutation teeth: routing a string through the component branch renders
    // `<crown>` (no svg), never `svg.lucide-crown`.
    const { container } = render(
      <IntentionBar intention="Do Hard Things" color="#f97316" icon="crown" completed={69} scheduled={91} />
    );
    expect(container.querySelector('svg.lucide-crown')).toBeInTheDocument();
  });

  it('renders the Lucide component passed in as-is', () => {
    // Mutation teeth: routing the component through nameIcon() falls back to
    // PenLine, so `svg.lucide-graduation-cap` would disappear.
    const { container } = render(
      <IntentionBar intention="Study" color="#38bdf8" icon={GraduationCap} completed={1} scheduled={2} />
    );
    expect(container.querySelector('svg.lucide-graduation-cap')).toBeInTheDocument();
  });

  it('renders a zero-width fill when nothing is scheduled', () => {
    // Pins the `scheduled > 0` guard: without it width is NaN%, jsdom drops
    // the invalid declaration, and both width assertions fail.
    const { container } = render(
      <IntentionBar intention="Study" color="#38bdf8" icon="graduation" completed={0} scheduled={0} />
    );
    const fill = container.querySelector<HTMLElement>('[data-testid="intention-fill"]')!;
    expect(fill.style.width).toBe('0%');
    expect(fill).toHaveStyle({ width: '0%' });
  });
});
