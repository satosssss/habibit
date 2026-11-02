import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrateBadges, dismissBadgeUnlock, useBadgeUnlock } from './badgeUnlock';
import type { EarnedBadge } from './types';

const badge = (id: string, earnedAt = 1): EarnedBadge => ({ id, earnedAt });
// dismissBadgeUnlock skips one badge, so looping drains the queue.
const reset = () => { for (let i = 0; i < 10; i++) dismissBadgeUnlock(); };

beforeEach(reset);
afterEach(() => { reset(); vi.useRealTimers(); });   // a failing assertion can't leak timers

describe('badgeUnlock store (R6)', () => {
  it('publishes the first new badge immediately', () => {
    const { result } = renderHook(() => useBadgeUnlock());
    act(() => { celebrateBadges([badge('completions-1')]); });
    expect(result.current?.id).toBe('completions-1');
  });

  it('queues later badges and shows them one at a time, 4.5s each', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBadgeUnlock());
    act(() => { celebrateBadges([badge('completions-1'), badge('perfect-1')]); });
    expect(result.current?.id).toBe('completions-1');
    act(() => { vi.advanceTimersByTime(4499); });
    expect(result.current?.id).toBe('completions-1');   // not yet
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current?.id).toBe('perfect-1');       // next in queue
    act(() => { vi.advanceTimersByTime(4500); });
    expect(result.current).toBeNull();                  // queue drained
  });

  it('dismiss skips the visible badge and advances immediately', () => {
    const { result } = renderHook(() => useBadgeUnlock());
    act(() => { celebrateBadges([badge('streak-3'), badge('streak-7')]); });
    act(() => { dismissBadgeUnlock(); });
    expect(result.current?.id).toBe('streak-7');
    act(() => { dismissBadgeUnlock(); });
    expect(result.current).toBeNull();
  });

  it('ignores a badge id that is already visible or queued (no replay)', () => {
    const { result } = renderHook(() => useBadgeUnlock());
    act(() => { celebrateBadges([badge('streak-3'), badge('perfect-1')]); });
    act(() => { celebrateBadges([badge('streak-3'), badge('perfect-1')]); });
    expect(result.current?.id).toBe('streak-3');
    act(() => { dismissBadgeUnlock(); });
    expect(result.current?.id).toBe('perfect-1');
    act(() => { dismissBadgeUnlock(); });
    expect(result.current).toBeNull();                  // no duplicates behind it
  });

  it('does nothing for an empty result (already-earned boot pass)', () => {
    const { result } = renderHook(() => useBadgeUnlock());
    act(() => { celebrateBadges([]); });
    expect(result.current).toBeNull();
  });
});
