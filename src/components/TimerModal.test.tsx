import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { putEntry } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { TimerModal } from './TimerModal';

vi.mock('@/lib/repo', () => ({ putEntry: vi.fn(async () => undefined) }));

const habit: Habit = {
  id: 't1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'timer', target: 900, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
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

  it('renders a tick per minute on the ring, depleting with progress', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    expect(document.querySelector('[data-tick-count]')?.getAttribute('data-tick-count')).toBe('15');
    expect(document.querySelectorAll('[data-tick]')).toHaveLength(15);
    expect(document.querySelectorAll('[data-tick][data-depleted="true"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(document.querySelectorAll('[data-tick][data-depleted="true"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /reset timer/i }));
    expect(document.querySelectorAll('[data-tick][data-depleted="true"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /\+5 minutes/i }));
    expect(document.querySelector('[data-tick-count]')?.getAttribute('data-tick-count')).toBe('20');
  });

  it('steps ±1 on press and repeats ±5 while held until release', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const inc = screen.getByRole('button', { name: /increase duration/i });
    fireEvent.pointerDown(inc);
    expect(screen.getByText('16:00')).toBeInTheDocument();           // press steps ±1
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('21:00')).toBeInTheDocument();           // held past delay → ±5
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('26:00')).toBeInTheDocument();           // repeat cadence → ±5
    fireEvent.pointerUp(inc);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('26:00')).toBeInTheDocument();           // release stops the repeat
    fireEvent.click(inc);                                            // the press's trailing click is swallowed
    expect(screen.getByText('26:00')).toBeInTheDocument();

    const dec = screen.getByRole('button', { name: /decrease duration/i });
    fireEvent.pointerDown(dec);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('20:00')).toBeInTheDocument();           // hold-repeat also works downward
    fireEvent.pointerUp(dec);
  });

  it('clears the hold-repeat timeout on unmount', () => {
    const { unmount } = render(
      <TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                  onClose={vi.fn()} onComplete={vi.fn()} />
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: /increase duration/i }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs the Start → Pause → Stop lifecycle, persisting only on Stop', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                  onClose={onClose} onComplete={vi.fn()} />
    );
    // Start → running countdown
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('14:57')).toBeInTheDocument();
    // Pause → halted, elapsed kept in memory only (no write, modal stays open)
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('14:57')).toBeInTheDocument();
    expect(vi.mocked(putEntry)).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Stop → commits the session's elapsed and closes (reopening resumes, §6 L163)
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(putEntry)).toHaveBeenCalledWith('t1', '2026-09-23', 3);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1);            // no double write
  });

  it('persists elapsed when unmounted without close (mid-run route change)', () => {
    const { unmount } = render(
      <TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                  onClose={vi.fn()} onComplete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(4000); });
    unmount();                                                       // route change: no close() call
    expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(putEntry)).toHaveBeenCalledWith('t1', '2026-09-23', 4);
  });

  it('does not rewrite the entry when unmounting after completion', async () => {
    const { unmount } = render(
      <TimerModal habit={habit} initialSeconds={899} streak={0} date="2026-09-23"
                  onClose={vi.fn()} onComplete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(2000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    unmount();
    expect(vi.mocked(putEntry).mock.calls).toEqual([['t1', '2026-09-23', 900]]);
  });

  it('presents as a centered dialog only from 1024px (spec §6 breakpoint)', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const wrap = document.querySelector('[data-sheet-backdrop]')?.parentElement;
    expect(wrap?.className).toContain('lg:items-center');
    expect(wrap?.className).not.toContain('md:items-center');
  });
});
