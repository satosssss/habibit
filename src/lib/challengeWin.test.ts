import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrateChallengeWin, celebrateWins, dismissChallengeWin, useChallengeWin } from './challengeWin';
import type { Challenge } from './types';

const win = (id = 'c1', status: Challenge['status'] = 'won'): Challenge => ({
  id, type: 'weekend', scopeLabel: 'All habits', status, startedAt: 1, resultAt: 2,
});

beforeEach(() => { dismissChallengeWin(); });
afterEach(() => { dismissChallengeWin(); vi.useRealTimers(); });   // a failing assertion can't leak fake timers

describe('challengeWin store', () => {
  it('publishes a win to subscribers', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateChallengeWin(win()); });
    expect(result.current?.id).toBe('c1');
  });

  it('dismiss clears the win', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateChallengeWin(win()); });
    act(() => { dismissChallengeWin(); });
    expect(result.current).toBeNull();
  });

  it('auto-dismisses after 4s', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateChallengeWin(win()); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBeNull();
    vi.useRealTimers();
  });

  it('a fresh win replaces the visible one and restarts the timer (replace, never stack)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateChallengeWin(win('w1')); });
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { celebrateChallengeWin(win('w2')); });   // replaces w1, timer restarts at 0
    act(() => { vi.advanceTimersByTime(1500); });       // 4.5s since w1, 1.5s since w2
    expect(result.current?.id).toBe('w2');
    act(() => { vi.advanceTimersByTime(2500); });       // 4s since w2
    expect(result.current).toBeNull();
    vi.useRealTimers();
  });

  it('celebrateWins ignores non-won transitions', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateWins([win('f1', 'failed'), win('a1', 'abandoned')]); });
    expect(result.current).toBeNull();
  });

  it('celebrateWins celebrates a returned won transition', () => {
    const { result } = renderHook(() => useChallengeWin());
    act(() => { celebrateWins([win('w1')]); });
    expect(result.current?.id).toBe('w1');
  });
});
