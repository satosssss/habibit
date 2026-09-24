import { render, screen } from '@testing-library/react';
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
});
