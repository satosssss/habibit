import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrateChallengeWin, celebrateWins, dismissChallengeWin, useChallengeWin } from './challengeWin';
import type { Challenge } from './types';

const win = (id = 'c1', status: Challenge['status'] = 'won'): Challenge => ({
  id, type: 'weekend', scopeLabel: 'All habits', status, startedAt: 1, resultAt: 2,
});

beforeEach(() => { dismissChallengeWin(); });

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
