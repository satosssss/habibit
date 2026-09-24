import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { intentionColor } from '@/lib/colors';
import type { Habit } from '@/lib/types';
import { HabitForm } from './HabitForm';

const habit: Habit = {
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'timer', target: 900, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};

describe('HabitForm', () => {
  it('exposes every field from the spec, in order', () => {
    const { container } = render(<HabitForm habit={habit} open onSave={vi.fn()} onClose={vi.fn()} />);
    const fields = [...container.querySelectorAll('[data-field]')]
      .map((el) => el.getAttribute('data-field'));
    expect(fields).toEqual(['name', 'category', 'intention', 'icon', 'color', 'type', 'target', 'frequency']);
  });

  it('offers existing categories and intentions as suggestions', () => {
    render(<HabitForm habit={habit} open onSave={vi.fn()} onClose={vi.fn()}
                      categories={['Morning', 'Health']} intentions={['Study', 'Be Grateful']} />);
    // The brief wrote `screen.getByListId(...)`, which is not a Testing Library
    // query; the id lookup keeps the assertion (the datalist with that id owns
    // the suggestion option) intact. `hidden: true` is required because jsdom
    // applies the HTML rendering rule `datalist { display: none }`, which by
    // default hides its options from the accessible-role query.
    const categories = document.getElementById('habit-category-list')!;
    expect(categories).toContainElement(
      screen.getByRole('option', { name: 'Health', hidden: true })
    );
    const intentions = document.getElementById('habit-intention-list')!;
    expect(intentions).toContainElement(
      screen.getByRole('option', { name: 'Study', hidden: true })
    );
  });

  it('shows the derived intention color as a swatch', () => {
    render(<HabitForm habit={habit} open onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('intention-swatch')).toHaveStyle({ background: intentionColor('Do Hard Things') });
  });

  it('shows a target input only for quantity and timer habits', () => {
    const { rerender } = render(<HabitForm habit={{ ...habit, type: 'boolean' }} open
                                            onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/^Target/)).not.toBeInTheDocument();
    rerender(<HabitForm habit={{ ...habit, type: 'quantity', unit: 'cups', target: 8 }} open
                        onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^Target/)).toBeInTheDocument();
  });

  it('saves an edited habit with the changed name and category', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={habit} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Habit name'), { target: { value: 'Deep Work' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Evening' } });
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Deep Work', category: 'Evening' }));
  });

  it('toggles weekday frequency chips', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, frequency: [] }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^mon$/i }));
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].frequency).toEqual([1]);
  });

  it('resolves to every day when all chips are on', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, frequency: [1] }} open onSave={onSave} onClose={vi.fn()} />);
    for (const day of ['sun', 'tue', 'wed', 'thu', 'fri', 'sat'])
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${day}$`, 'i') }));
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].frequency).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
