import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '@/lib/types';
import { CategorySection } from './CategorySection';

const habit = (id: string, name: string): Habit => ({
  id, name, icon: 'flower2', color: '#c026d3', category: 'Morning', intention: 'Study',
  type: 'boolean', target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
});

const handlers = {
  values: { a: 1 },
  streaks: { a: 4 },
  onToggle: vi.fn(), onStep: vi.fn(), onOpenTimer: vi.fn(), onOpenValue: vi.fn(),
};

describe('CategorySection', () => {
  it('renders the category name and its habits', () => {
    render(<CategorySection category="Morning" habits={[habit('a', 'Meditate')]}
                            collapsed={false} onToggleCollapse={vi.fn()} {...handlers} />);
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Meditate')).toBeInTheDocument();
  });

  it('hides habit rows while collapsed but keeps the header', () => {
    render(<CategorySection category="Morning" habits={[habit('a', 'Meditate')]}
                            collapsed onToggleCollapse={vi.fn()} {...handlers} />);
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.queryByText('Meditate')).not.toBeInTheDocument();
  });

  it('toggles collapse from the chevron', () => {
    const onToggleCollapse = vi.fn();
    render(<CategorySection category="Morning" habits={[habit('a', 'Meditate')]}
                            collapsed={false} onToggleCollapse={onToggleCollapse} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /collapse morning/i }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('sorts habits by their order field', () => {
    render(<CategorySection category="Morning"
                            habits={[habit('b', 'Second'), { ...habit('a', 'First'), order: -1 }]}
                            collapsed={false} onToggleCollapse={vi.fn()} {...handlers} />);
    const names = screen.getAllByText(/First|Second/).map((n) => n.textContent);
    expect(names).toEqual(['First', 'Second']);
  });
});
