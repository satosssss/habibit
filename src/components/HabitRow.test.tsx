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
    render(<HabitRow habit={boolHabit} value={0} onToggle={onToggle} {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /mark done|mark not done/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
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

  it('renders a flame badge only when there is a streak', () => {
    const { rerender } = render(<HabitRow habit={boolHabit} value={0} onToggle={vi.fn()} {...base} streak={0} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    rerender(<HabitRow habit={boolHabit} value={0} onToggle={vi.fn()} {...base} streak={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
