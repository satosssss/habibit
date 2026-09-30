import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { putEntry } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { TimerModal } from './TimerModal';
import { celebrateIfCompleted } from '@/lib/completionToast';

vi.mock('@/lib/repo', () => ({ putEntry: vi.fn(async () => undefined) }));
vi.mock('@/lib/completionToast', () => ({ celebrateIfCompleted: vi.fn() }));

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

  it('caps the duration at the habit target — quick-add included (R1)', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const pill = screen.getByRole('button', { name: /\+5 minutes/i });
    expect(pill).toBeDisabled();                     // starts at the cap
    fireEvent.click(pill);
    expect(screen.getByText('15:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));
    expect(screen.getByText('14:00')).toBeInTheDocument();
    fireEvent.click(pill);                            // works below the cap…
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(pill).toBeDisabled();                     // …then stops at the target
  });

  it('steps ±1 minute, disabled at both bounds (R1)', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const inc = screen.getByRole('button', { name: /increase duration/i });
    const dec = screen.getByRole('button', { name: /decrease duration/i });
    expect(inc).toBeDisabled();                      // cap on arrival
    fireEvent.click(dec);
    expect(screen.getByText('14:00')).toBeInTheDocument();
    fireEvent.click(inc);
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(inc).toBeDisabled();
    for (let i = 0; i < 20; i++) fireEvent.click(dec);   // 14:00 → floor at 60 s
    expect(screen.getByText('01:00')).toBeInTheDocument();
    expect(dec).toBeDisabled();
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
    // jsdom schedules a 0 ms selection-bookkeeping timeout whenever focus()
    // runs (Sheet's R5.2 focus-in on open); let it drain so only the app's
    // own timers are counted — the interval itself must be cleared above.
    act(() => { vi.advanceTimersByTime(10); });
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

    // Spec R1: ticks can never exceed the target's minutes (old pin: 20 > 15).
    const pill = screen.getByRole('button', { name: /\+5 minutes/i });
    expect(pill).toBeDisabled();                                  // at the cap
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));
    expect(document.querySelector('[data-tick-count]')?.getAttribute('data-tick-count')).toBe('14');
    fireEvent.click(pill);
    expect(document.querySelector('[data-tick-count]')?.getAttribute('data-tick-count')).toBe('15');
  });

  it('steps ±1 on press and repeats ±5 while held until release, capped mid-hold', () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const dec = screen.getByRole('button', { name: /decrease duration/i });
    fireEvent.pointerDown(dec);
    expect(screen.getByText('14:00')).toBeInTheDocument();          // press steps ±1
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('09:00')).toBeInTheDocument();          // held past delay → ±5
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('04:00')).toBeInTheDocument();          // repeat cadence → ±5
    fireEvent.pointerUp(dec);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('04:00')).toBeInTheDocument();          // release stops the repeat
    fireEvent.click(dec);                                           // trailing click swallowed
    expect(screen.getByText('04:00')).toBeInTheDocument();

    const inc = screen.getByRole('button', { name: /increase duration/i });
    fireEvent.pointerDown(inc);
    expect(screen.getByText('05:00')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('10:00')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('15:00')).toBeInTheDocument();          // reaches the cap…
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('15:00')).toBeInTheDocument();          // …and holds it while held
    fireEvent.pointerUp(inc);
  });

  it('clears the hold-repeat timeout on unmount', () => {
    const { unmount } = render(
      <TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                  onClose={vi.fn()} onComplete={vi.fn()} />
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: /decrease duration/i }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    // Drain jsdom's focus/selection bookkeeping timeout (see the interval
    // test) — the hold-repeat chain itself must be cleared by unmount.
    act(() => { vi.advanceTimersByTime(10); });
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

  it('logs the session duration on completion, never above the target (R1 §2.2)', async () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));  // a 14:00 session
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(14 * 60_000 + 1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    // Honest accounting (spec R1.2.2): a 14-minute session on a 15-minute
    // habit logs 840 — it does NOT claim the full target.
    expect(vi.mocked(putEntry)).toHaveBeenCalledWith('t1', '2026-09-23', 840);
  });

  it('clamps the gradient sweep to a full circle even for an over-target entry', () => {
    render(<TimerModal habit={habit} initialSeconds={1000} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    const ring = document.querySelector<HTMLElement>('[style*="conic-gradient"]')!;
    expect(ring.style.background).toContain('conic-gradient');
    expect(ring.style.background).toContain('360deg');   // never 400deg
    expect(ring.style.background).not.toContain('400deg');
  });

  it('celebrates exactly once when a full-duration session completes (A2)', async () => {
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(15 * 60_000 + 1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledWith(habit, 0, 900);
  });

  it('passes a below-target session honestly to the store guard (A2)', async () => {
    // The call always follows a successful write; the store's transition
    // guard (cycle A: partial progress stays silent) is what keeps an
    // 840/900 session from celebrating — here we pin the exact arguments.
    render(<TimerModal habit={habit} initialSeconds={0} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /decrease duration/i }));  // an 840s session
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(14 * 60_000 + 1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(putEntry)).toHaveBeenCalledWith('t1', '2026-09-23', 840);
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledWith(habit, 0, 840);
  });

  it('passes an already-completed before value on reopen (A2)', async () => {
    // before=900 → the store's guard stays silent; here we pin the arguments.
    render(<TimerModal habit={habit} initialSeconds={900} streak={0} date="2026-09-23"
                       onClose={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    act(() => { vi.advanceTimersByTime(1000); });
    await waitFor(() => expect(vi.mocked(putEntry)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(celebrateIfCompleted)).toHaveBeenCalledWith(habit, 900, 900);
  });
});
