import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '@/lib/types';
import { HabitList } from './HabitList';

const h = (id: string, name: string, category: string, order: number): Habit => ({
  id, name, icon: 'flower2', color: '#c026d3', category, intention: 'Study',
  type: 'boolean', target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order, createdAt: 0,
});

describe('HabitList', () => {
  it('groups habits by category', () => {
    render(<HabitList habits={[h('a', 'Meditate', 'Morning', 0), h('b', 'Read', 'Evening', 0)]}
                      onEdit={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Evening')).toBeInTheDocument();
  });

  it('asks before deleting', () => {
    const onDelete = vi.fn();
    render(<HabitList habits={[h('a', 'Meditate', 'Morning', 0)]}
                      onEdit={vi.fn()} onDelete={onDelete} onReorder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete meditate/i }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('opens the editor from the edit control', () => {
    const onEdit = vi.fn();
    render(<HabitList habits={[h('a', 'Meditate', 'Morning', 0)]}
                      onEdit={onEdit} onDelete={vi.fn()} onReorder={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit meditate/i }));
    expect(onEdit).toHaveBeenCalledWith('a');
  });

  it('reorders within a category when dropped', async () => {
    const onReorder = vi.fn();
    render(
      <HabitList
        habits={[h('a', 'Meditate', 'Morning', 0), h('b', 'Shower', 'Morning', 1)]}
        onEdit={vi.fn()} onDelete={vi.fn()} onReorder={onReorder} />
    );
    const first = screen.getByTestId('habit-row-a');
    const second = screen.getByTestId('habit-row-b');
    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    fireEvent.drop(second);
    await waitFor(() => expect(onReorder).toHaveBeenCalled());
    const [reordered] = onReorder.mock.calls[0];
    expect(reordered.map((x: Habit) => x.id)).toEqual(['b', 'a']);
  });
});
