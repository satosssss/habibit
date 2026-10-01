import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '@/lib/types';
import { ValueSheet } from './ValueSheet';

const habit: Habit = {
  id: 'q1', name: 'Drink Water', icon: 'droplet', color: '#6366f1', category: 'Health',
  intention: 'Be Grateful', type: 'quantity', target: 8, unit: 'cups',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};

const open = (over: Partial<Habit> = {}, value = 0) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<ValueSheet habit={{ ...habit, ...over }} value={value} open onSave={onSave} onClose={onClose} />);
  return { onSave, onClose };
};
const input = () => screen.getByLabelText(/amount/i);
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('ValueSheet (spec R4)', () => {
  it('saves a valid in-range value and closes', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '6' } });
    save();
    expect(onSave).toHaveBeenCalledWith(6);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('caps the input at the target and shows the maximum helper', () => {
    open();
    expect(input()).toHaveAttribute('max', '8');
    expect(screen.getByText('Maximum 8 cups.')).toBeInTheDocument();
  });

  it("rejects an empty value in place — the old Number('') === 0 wipe is gone (R4)", () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '' } });
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();          // stays open, progress intact
    expect(screen.getByRole('alert'))
      .toHaveTextContent('Enter a number from 0 to 8 cups.');
  });

  it('rejects a typed value above the target with the same error (no silent clamp)', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '11' } });
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert'))
      .toHaveTextContent('Enter a number from 0 to 8 cups.');
  });

  it('rejects a non-finite value (number inputs carry exponent notation)', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '1e999' } });   // Number() → Infinity
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('saves on Enter exactly once, never double-saving', () => {
    const { onSave, onClose } = open({}, 3);
    fireEvent.change(input(), { target: { value: '5' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears the error as soon as the user types again', () => {
    open({}, 3);
    fireEvent.change(input(), { target: { value: '' } });
    save();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: '4' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('omits the unit when the habit has none', () => {
    render(<ValueSheet habit={{ ...habit, unit: '' }} value={0} open
                      onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Maximum 8.')).toBeInTheDocument();
  });

  // Slice D final-review finding: the base commit had text-base (16px) here;
  // the glass-input swap dropped it, and anything under 16px makes iOS Safari
  // auto-zoom the viewport on focus (the sheet is a stated 375px target).
  it('keeps the amount input at 16px so iOS never auto-zooms on focus', () => {
    open();
    expect(input()).toHaveClass('text-base');
  });
});
