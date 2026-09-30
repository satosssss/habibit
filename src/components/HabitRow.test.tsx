import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '@/lib/types';
import { HabitRow } from './HabitRow';

const boolHabit: Habit = {
  id: 'b1', name: 'Take a Cold Shower', icon: 'showerHead', color: '#3b82f6',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};
const qtyHabit: Habit = { ...boolHabit, id: 'q1', name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' };
const timerHabit: Habit = { ...boolHabit, id: 't1', name: 'Meditate', type: 'timer', target: 900 };

const base = { streak: 4, onStep: vi.fn(), onOpenTimer: vi.fn(), onOpenValue: vi.fn() };

describe('HabitRow', () => {
  it('shows name, frequency subtext and renders fully filled when done', () => {
    render(<HabitRow habit={boolHabit} value={1} onToggle={vi.fn()} {...base} />);
    expect(screen.getByText('Take a Cold Shower')).toBeInTheDocument();
    expect(screen.getByText('Every day')).toBeInTheDocument();
    expect(screen.getByTestId('habit-fill')).toHaveStyle({ width: '100%' });
  });

  it('toggles a boolean habit from its check control', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<HabitRow habit={boolHabit} value={0} onToggle={onToggle} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /mark take a cold shower done/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<HabitRow habit={boolHabit} value={1} onToggle={onToggle} {...base} />);
    expect(screen.getByRole('button', { name: /mark take a cold shower not done/i })).toBeInTheDocument();
  });

  it('shows x/y subtext for quantity habits and steps ±1', () => {
    const onStep = vi.fn();
    render(<HabitRow habit={qtyHabit} value={4} onToggle={vi.fn()} {...base} onStep={onStep} />);
    expect(screen.getByText('Every day, 4/8 cups')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add one/i }));
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: /remove one/i }));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it('clamps the visual ratio but never below the 55% readability floor', () => {
    render(<HabitRow habit={qtyHabit} value={0} onToggle={vi.fn()} {...base} />);
    expect(screen.getByTestId('habit-fill')).toHaveStyle({ width: '55%' });
    render(<HabitRow habit={qtyHabit} value={8} onToggle={vi.fn()} {...base} />);
    expect(screen.getAllByTestId('habit-fill')[1]).toHaveStyle({ width: '100%' });
  });

  it('opens the timer from the ring of a timer habit', () => {
    const onOpenTimer = vi.fn();
    render(<HabitRow habit={timerHabit} value={300} onToggle={vi.fn()} {...base} onOpenTimer={onOpenTimer} />);
    expect(screen.getByText('Every day, 5 minutes/15 minutes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open timer/i }));
    expect(onOpenTimer).toHaveBeenCalledTimes(1);
  });

  it('keeps row spacing tight at xl so long names fit beside the chrome (1280, 3-col)', () => {
    render(<HabitRow habit={qtyHabit} value={4} onToggle={vi.fn()} {...base} />);
    const flow = document.querySelector<HTMLElement>('li > div[class*="items-center"]');
    expect(flow).not.toBeNull();
    const classes = flow!.className.split(/\s+/);
    expect(classes).toContain('gap-3');    // base spacing unchanged
    expect(classes).toContain('xl:gap-2'); // xl frees 12px so "Learn Spanish" (91px) fits in 86+12
  });

  it('renders a flame badge only when there is a streak', () => {
    const { rerender } = render(<HabitRow habit={boolHabit} value={0} onToggle={vi.fn()} {...base} streak={0} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    rerender(<HabitRow habit={boolHabit} value={0} onToggle={vi.fn()} {...base} streak={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  // Spec §4 (R2): quantity and timer rows must show a completed state.
  it('uses the normative done and not-done names on the quantity ring (R2)', () => {
    const spanish = { ...qtyHabit, name: 'Learn Spanish', target: 45, unit: 'minutes' };
    const { rerender } = render(<HabitRow habit={spanish} value={44} onToggle={vi.fn()} {...base} />);
    const notDone = screen.getByRole('button', { name: 'Set exact value for Learn Spanish' });
    expect(notDone).toHaveTextContent('97'); // floors (spec R1.2.2): 44/45 = 97.78%

    rerender(<HabitRow habit={spanish} value={45} onToggle={vi.fn()} {...base} />);
    const done = screen.getByRole('button', {
      name: 'Set exact value for Learn Spanish, 45 of 45 minutes, completed',
    });
    expect(done).not.toHaveTextContent(/\d/); // check replaces the percent
    expect(done.querySelector('svg.lucide-check')).toBeInTheDocument();
  });

  // Cap invariant (spec §1/R1 §2.4): the row never renders an over-target
  // value, even if a caller passes one — display clamps like everything else.
  it('never displays a value above the target (R1)', () => {
    const spanish = { ...qtyHabit, name: 'Learn Spanish', target: 45, unit: 'minutes' };
    const { rerender } = render(<HabitRow habit={spanish} value={44} onToggle={vi.fn()} {...base} />);
    rerender(<HabitRow habit={spanish} value={50} onToggle={vi.fn()} {...base} />);
    expect(screen.getByRole('button', {
      name: 'Set exact value for Learn Spanish, 45 of 45 minutes, completed',
    })).toBeInTheDocument();
    expect(screen.getByText('Every day, 45/45 minutes')).toBeInTheDocument();
  });

  it('disables the steppers at the cap and at zero (R1)', () => {
    const spanish = { ...qtyHabit, name: 'Learn Spanish', target: 45, unit: 'minutes' };
    const onStep = vi.fn();
    const { rerender } = render(
      <HabitRow habit={spanish} value={45} onToggle={vi.fn()} {...base} onStep={onStep} />
    );
    const add = screen.getByRole('button', { name: /add one minutes/i });
    expect(add).toBeDisabled();                       // at the cap
    expect(screen.getByRole('button', { name: /remove one minutes/i })).toBeEnabled();
    fireEvent.click(add);                             // disabled → handler never runs
    expect(onStep).not.toHaveBeenCalled();
    rerender(<HabitRow habit={spanish} value={0} onToggle={vi.fn()} {...base} onStep={onStep} />);
    expect(screen.getByRole('button', { name: /remove one minutes/i })).toBeDisabled(); // at zero
    expect(screen.getByRole('button', { name: /add one minutes/i })).toBeEnabled();
  });

  it('swaps the timer plus for a check and announces completion (R2)', () => {
    const { rerender } = render(<HabitRow habit={timerHabit} value={300} onToggle={vi.fn()} {...base} />);
    const notDone = screen.getByRole('button', { name: 'Open timer for Meditate' });
    expect(notDone.querySelector('svg.lucide-plus')).toBeInTheDocument(); // not-done name + plus unchanged

    rerender(<HabitRow habit={timerHabit} value={900} onToggle={vi.fn()} {...base} />);
    const done = screen.getByRole('button', {
      name: 'Open timer for Meditate, 15 of 15 minutes, completed',
    });
    expect(done.querySelector('svg.lucide-check')).toBeInTheDocument();
    expect(done.querySelector('svg.lucide-plus')).toBeNull();
  });

  // Spec R2: the badge overlays the row — it must never intercept taps
  // aimed at the ring/check control beneath it.
  it('lets taps pass through the flame badge to the control beneath', () => {
    render(<HabitRow habit={qtyHabit} value={4} onToggle={vi.fn()} {...base} streak={7} />);
    expect(screen.getByTestId('flame-badge').className).toContain('pointer-events-none');
  });

  // Slice A2 R1: quantity/timer rows complete from the same check control —
  // the ring stays the editor, the check stays the toggle.
  it('completes a quantity habit from a dedicated check button (A2)', () => {
    const onToggle = vi.fn();
    render(<HabitRow habit={qtyHabit} value={4} onToggle={onToggle} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Drink Water done' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Drink Water done' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('flips the quantity check to not-done at the target (A2)', () => {
    render(<HabitRow habit={qtyHabit} value={8} onToggle={vi.fn()} {...base} />);
    expect(screen.getByRole('button', { name: 'Mark Drink Water not done' })).toBeInTheDocument();
  });

  it('completes a timer habit from a dedicated check button (A2)', () => {
    const onToggle = vi.fn();
    render(<HabitRow habit={timerHabit} value={300} onToggle={onToggle} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Meditate done' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Open timer for Meditate' }),
    ).toBeInTheDocument(); // ring untouched beside it
  });

  it('keeps the quantity ring bound to the value sheet (A2)', () => {
    const onOpenValue = vi.fn();
    render(<HabitRow habit={qtyHabit} value={4} onToggle={vi.fn()} {...base} onOpenValue={onOpenValue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set exact value for Drink Water' }));
    expect(onOpenValue).toHaveBeenCalledTimes(1);
  });
});
