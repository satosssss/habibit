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

  // Spec §9: Frequency = "Every day / Weekdays / Weekends / weekday toggles".
  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pressed = (name: string) =>
    screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true';

  it('Every day preset selects all seven weekday chips', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, frequency: [1] }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Every day' }));
    expect(DAYS_SHORT.map(pressed)).toEqual([true, true, true, true, true, true, true]);
    expect(pressed('Every day')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].frequency).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('Weekdays preset selects Monday through Friday only', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, frequency: [0, 6] }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weekdays' }));
    expect(DAYS_SHORT.map(pressed)).toEqual([false, true, true, true, true, true, false]);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].frequency).toEqual([1, 2, 3, 4, 5]);
  });

  it('Weekends preset selects Saturday and Sunday only', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, frequency: [1, 2, 3, 4, 5] }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weekends' }));
    expect(DAYS_SHORT.map(pressed)).toEqual([true, false, false, false, false, false, true]);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].frequency).toEqual([0, 6]);
  });

  it('keeps a preset result through save and reopen', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <HabitForm habit={{ ...habit, frequency: [0, 6] }} open onSave={onSave} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Weekdays' }));
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].frequency).toEqual([1, 2, 3, 4, 5]);

    rerender(<HabitForm habit={onSave.mock.calls[0][0]} open onSave={onSave} onClose={vi.fn()} />);
    expect(DAYS_SHORT.map(pressed)).toEqual([false, true, true, true, true, true, false]);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[1][0].frequency).toEqual([1, 2, 3, 4, 5]);
  });

  it('lets chips diverge from a preset after applying it', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, frequency: [] }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Every day' }));
    expect(pressed('Every day')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    expect(pressed('Every day')).toBe(false);
    expect(DAYS_SHORT.map(pressed)).toEqual([true, false, true, true, true, true, true]);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].frequency).toEqual([0, 2, 3, 4, 5, 6]);
  });

  it('edits the timer target in minutes and stores seconds', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <HabitForm habit={{ ...habit, type: 'timer', target: 900 }} open onSave={onSave} onClose={vi.fn()} />
    );
    const target = () => screen.getByLabelText(/^Target/);
    expect(target()).toHaveValue(15);

    // Regression pin for deviation ④: each partial keystroke must survive the
    // minutes→seconds round-trip (typing "4" then "5" is 45, never 4 → clobbered).
    fireEvent.change(target(), { target: { value: '4' } });
    expect(target()).toHaveValue(4);
    fireEvent.change(target(), { target: { value: '45' } });
    expect(target()).toHaveValue(45);

    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].target).toBe(2700);

    rerender(<HabitForm habit={onSave.mock.calls[0][0]} open onSave={onSave} onClose={vi.fn()} />);
    expect(target()).toHaveValue(45);

    fireEvent.change(target(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[1][0].target).toBe(600);

    rerender(<HabitForm habit={{ ...habit, type: 'timer', target: 30 }} open onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[2][0].target).toBe(60);
  });

  // Spec §7 (R5): intention chips under the intention field.
  it('shows in-use intentions then presets as chips, deduped case-insensitively (R5)', () => {
    const { container } = render(
      <HabitForm habit={{ ...habit, intention: 'study' }} open onSave={vi.fn()} onClose={vi.fn()}
                 intentions={['Study', 'study', 'Be Grateful']} />
    );
    const chips = container.querySelectorAll('[data-field="intention"] button');
    expect([...chips].map((c) => c.getAttribute('aria-label'))).toEqual(
      ['Study', 'Be Grateful', 'Health', 'Calm', 'Growth', 'Joy'] // deduped, presets last
    );
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');     // draft 'study' ≡ chip 'Study'
    expect(chips[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('taps a chip into the intention with a non-color selected cue (R5)', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, intention: '' }} open onSave={onSave} onClose={vi.fn()}
                     intentions={['Study']} />);
    const chip = screen.getByRole('button', { name: 'Health' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip).not.toHaveTextContent('✓');
    fireEvent.click(chip);
    expect(screen.getByLabelText('Intention')).toHaveValue('Health');
    const pressed = screen.getByRole('button', { name: 'Health' });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(pressed).toHaveTextContent('✓'); // glyph + state, never color alone
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].intention).toBe('Health');
  });

  it('points the custom path at the input: placeholder + free typing still win (R5)', () => {
    const onSave = vi.fn();
    render(<HabitForm habit={{ ...habit, intention: '' }} open onSave={onSave} onClose={vi.fn()}
                     intentions={['Study']} />);
    expect(screen.getByLabelText('Intention')).toHaveAttribute('placeholder', 'Type your own…');
    expect(screen.getByLabelText('Category')).toHaveAttribute('placeholder', 'Choose or type category'); // untouched

    fireEvent.change(screen.getByLabelText('Intention'), { target: { value: 'Deep focus' } });
    for (const name of ['Study', 'Health'])
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    expect(onSave.mock.calls[0][0].intention).toBe('Deep focus');
  });
});
