import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { celebrateBadges, dismissBadgeUnlock } from '@/lib/badgeUnlock';
import { BadgeToast } from './BadgeToast';

const reset = () => { for (let i = 0; i < 10; i++) dismissBadgeUnlock(); };
afterEach(() => { act(() => { reset(); }); });

describe('BadgeToast (R6)', () => {
  it('renders nothing until a badge is earned', () => {
    render(<BadgeToast />);
    expect(screen.queryByTestId('badge-toast')).not.toBeInTheDocument();
  });

  it('announces the badge in a polite, atomic status region', () => {
    render(<BadgeToast />);
    act(() => { celebrateBadges([{ id: 'streak-7', earnedAt: 1 }]); });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveTextContent('Badge unlocked');
    expect(status).toHaveTextContent('One Week Strong');
  });

  it('sits top-center above the sheet layer and never blocks taps', () => {
    render(<BadgeToast />);
    act(() => { celebrateBadges([{ id: 'perfect-1', earnedAt: 1 }]); });
    const region = screen.getByTestId('badge-toast');
    expect(region.className).toContain('pointer-events-none');
    expect(region.className).toContain('top-4');       // top, not bottom-24 (CompletionToast)
    expect(region.className).toContain('z-[60]');
    const card = screen.getByRole('button', { name: /dismiss badge notification/i }).parentElement!;
    expect(card.className).toContain('pointer-events-auto');
  });

  it('dismiss advances the queue without moving focus', () => {
    render(<BadgeToast />);
    act(() => { celebrateBadges([{ id: 'streak-3', earnedAt: 1 }, { id: 'streak-7', earnedAt: 2 }]); });
    expect(screen.getByRole('status')).toHaveTextContent('Warming Up');
    fireEvent.click(screen.getByRole('button', { name: /dismiss badge notification/i }));
    expect(screen.getByRole('status')).toHaveTextContent('One Week Strong');
    expect(document.activeElement).toBe(document.body);   // never stolen from the user
  });

  it('uses a 44px dismiss target and motion-safe pop + shimmer', () => {
    render(<BadgeToast />);
    act(() => { celebrateBadges([{ id: 'challenge-weekend', earnedAt: 1 }]); });
    expect(screen.getByRole('button', { name: /dismiss badge notification/i }).className)
      .toContain('size-11');
    const pop = screen.getByText('Weekend Warrior').closest('div')!;
    expect(pop.querySelector('.motion-safe\\:animate-\\[badge-pop_450ms_ease-out\\]')).not.toBeNull();
    expect(pop.querySelector('.motion-safe\\:animate-\\[badge-shimmer_900ms_ease-out\\]')).not.toBeNull();
  });

  it('stays silent for an unknown catalog id (forward compatibility)', () => {
    render(<BadgeToast />);
    act(() => { celebrateBadges([{ id: 'from-the-future', earnedAt: 1 }]); });
    expect(screen.queryByTestId('badge-toast')).not.toBeInTheDocument();
  });

  it('renders nothing during server prerender', () => {
    expect(renderToString(<BadgeToast />)).toBe('');
  });
});
