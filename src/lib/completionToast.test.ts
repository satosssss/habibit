import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { celebrateIfCompleted, dismissCompletionToast, useCompletionToast } from './completionToast';
import type { Habit } from './types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'x1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});
const qty = () => habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });

afterEach(() => {
  dismissCompletionToast();   // module store persists across tests — always reset
  vi.useRealTimers();
});

describe('completionToast store (A2 R2)', () => {
  it('is empty until a habit completes', () => {
    const { result } = renderHook(() => useCompletionToast());
    expect(result.current).toBeNull();
  });

  it('fires on a completion transition with the exact copy', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    expect(result.current).toBe('Nice work — Drink Water is done!');
  });

  it('fires when a partial quantity crosses the target', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 4, 8); });
    expect(result.current).toBe('Nice work — Drink Water is done!');
  });

  it('fires for a boolean habit', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(habit(), 0, 1); });
    expect(result.current).toBe('Nice work — Meditate is done!');
  });

  it('stays silent on undo, no-op, and partial progress', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 8, 0); });   // undo
    expect(result.current).toBeNull();
    act(() => { celebrateIfCompleted(qty(), 8, 8); });   // already done
    expect(result.current).toBeNull();
    act(() => { celebrateIfCompleted(qty(), 0, 4); });   // progress, not done
    expect(result.current).toBeNull();
  });

  it('handles names with apostrophes', () => {
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(habit({ name: "Don't Snack" }), 0, 1); });
    expect(result.current).toBe("Nice work — Don't Snack is done!");
  });

  it('auto-dismisses after 2 seconds', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    act(() => { vi.advanceTimersByTime(1999); });
    expect(result.current).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBeNull();
  });

  it('replaces in place and restarts the window (never stacks)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    act(() => { vi.advanceTimersByTime(1500); });
    act(() => { celebrateIfCompleted(habit({ name: 'Read' }), 0, 1); });
    expect(result.current).toBe('Nice work — Read is done!');   // replaced, not stacked
    act(() => { vi.advanceTimersByTime(1999); });
    expect(result.current).not.toBeNull();                      // window restarted
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBeNull();
  });

  it('dismiss clears immediately and cancels the timer', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCompletionToast());
    act(() => { celebrateIfCompleted(qty(), 0, 8); });
    act(() => { dismissCompletionToast(); });
    expect(result.current).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBeNull();
  });
});
