import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, newId, putChallenge, putEntry, putHabit } from '@/lib/repo';
import { ActiveChallengesStrip } from './ActiveChallengesStrip';
import type { Habit } from '@/lib/types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: Date.now(), ...over,
});

beforeEach(async () => { await clearAll(); });

describe('ActiveChallengesStrip', () => {
  it('renders nothing when no challenge is active', async () => {
    const { container } = render(<ActiveChallengesStrip />);
    await screen.findByText(/./).catch(() => {}); // allow the liveQuery to settle
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each active challenge with live progress as a link to /challenges', async () => {
    const h = habit();
    await putHabit(h);
    const key = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    for (let i = 0; i < 3; i++) await putEntry(h.id, key(i), 1);
    await putChallenge({ id: newId(), type: 'streak7', habitId: h.id, scopeLabel: h.name, status: 'active', startedAt: Date.now() - 86_400_000 });
    render(<ActiveChallengesStrip />);
    expect(await screen.findByRole('link', { name: /7-Day Streak/ })).toHaveAttribute('href', '/challenges');
    expect(screen.getByText(/Day 3\/7/)).toBeInTheDocument();
  });
});
