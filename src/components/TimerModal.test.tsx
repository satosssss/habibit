import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Habit } from '@/lib/types';
import { TimerModal } from './TimerModal';

const habit: Habit = {
  id: 't1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'timer', target: 900, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('TimerModal', () => {
  it('shows the remaining duration as mm:ss', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={4} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('adds five minutes from the quick-add pill', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /\+5 minutes/i }));
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('adjusts duration with ±1 minute steppers', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /increase duration/i }));
    expect(screen.getByText('16:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('counts down only while running', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('15:00')).toBeInTheDocument(); // not started yet
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('14:57')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('14:57')).toBeInTheDocument(); // paused
  });

  it('clears the interval on unmount', () => {
    const { unmount } = render(
      <TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                  onClose={vi.fn()} onComplete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('completes exactly once when the countdown reaches zero', async () => {
    const onComplete = vi.fn();
    render(<TimerModal habit={habit} initialSeconds={899} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('resets back to the full duration', () => {
    render(<TimerModal habit={habit} initialSeconds={600} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /reset timer/i }));
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });
});
