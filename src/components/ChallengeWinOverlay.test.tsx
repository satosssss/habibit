import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { celebrateChallengeWin, dismissChallengeWin } from '@/lib/challengeWin';
import { ChallengeWinOverlay } from './ChallengeWinOverlay';
import type { Challenge } from '@/lib/types';

const win: Challenge = {
  id: 'c1', type: 'streak7', habitId: 'h1', scopeLabel: 'Read',
  status: 'won', startedAt: 1, resultAt: 2,
};

beforeEach(() => { dismissChallengeWin(); vi.useRealTimers(); });

describe('ChallengeWinOverlay', () => {
  it('renders nothing without a win', () => {
    render(<ChallengeWinOverlay />);
    expect(screen.queryByTestId('challenge-win')).not.toBeInTheDocument();
  });

  it('announces the win politely with title, scope, and status text', () => {
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    const region = screen.getByTestId('challenge-win');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Challenge complete!')).toBeInTheDocument();
    expect(screen.getByText('7-Day Streak — Read')).toBeInTheDocument();
  });

  it('dismisses via the Done button', () => {
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('challenge-win')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the timer', () => {
    vi.useFakeTimers();
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByTestId('challenge-win')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('uses the motion-safe animation class (reduced-motion stays static)', () => {
    render(<ChallengeWinOverlay />);
    act(() => { celebrateChallengeWin(win); });
    const card = screen.getByTestId('challenge-win-card');
    expect(card.className).toContain('motion-safe:animate-[toast-in_200ms_ease-out]');
  });
});
