import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listChallenges, newId, putChallenge, putEntry, putHabit } from '@/lib/repo';
import { ChallengesScreen } from './ChallengesScreen';
import type { Habit } from '@/lib/types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: Date.now(), ...over,
});

beforeEach(async () => { await clearAll(); });

describe('ChallengesScreen', () => {
  it('shows the three join cards on an empty account', async () => {
    render(<ChallengesScreen />);
    expect(await screen.findByText('7-Day Streak')).toBeInTheDocument();
    expect(screen.getByText('Weekend Warrior')).toBeInTheDocument();
    expect(screen.getByText('Category Sprint')).toBeInTheDocument();
  });

  it('blocks joining when the scope would be empty (join guard)', async () => {
    render(<ChallengesScreen />); // no habits at all
    const joinButtons = screen.getAllByRole('button', { name: /^Join/ });
    for (const b of joinButtons) expect(b).toBeDisabled();
    expect(await screen.findByText(/add a habit/i)).toBeInTheDocument();
  });

  it('joins streak7 via the habit picker and persists an active challenge', async () => {
    const h = habit();
    await putHabit(h);
    render(<ChallengesScreen />);
    // fireEvent (Ruling 1) does not wait for the control to be enabled — the
    // habit list loads async, so wait for enabled before clicking.
    const joinBtn = await screen.findByRole('button', { name: 'Join 7-Day Streak' });
    await waitFor(() => expect(joinBtn).toBeEnabled());
    fireEvent.click(joinBtn);
    fireEvent.click(await screen.findByRole('button', { name: h.name }));
    await waitFor(async () => {
      const all = await listChallenges();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ type: 'streak7', habitId: h.id, status: 'active' });
    });
  });

  it('lists an active challenge with live progress and groups results', async () => {
    const h = habit();
    await putHabit(h);
    // Active streak7 with a 3-day run (today + 2 back).
    const key = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    for (let i = 0; i < 3; i++) await putEntry(h.id, key(i), 1);
    await putChallenge({ id: newId(), type: 'streak7', habitId: h.id, scopeLabel: h.name, status: 'active', startedAt: Date.now() - 86_400_000 });
    await putChallenge({ id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'won', startedAt: 1, resultAt: 2 });
    render(<ChallengesScreen />);
    expect(await screen.findByText(/Day 3\/7/)).toBeInTheDocument();
    // Results shelf: won row carries the word "Won" (never color-only).
    expect(await screen.findByText('Won')).toBeInTheDocument();
  });

  it('shows the cap message when 3 actives are held', async () => {
    // Valid scopes (habit + category present): with scopeless actives the boot
    // orphan pass (Task 4 semantics) would close them before the cap message
    // ever renders, and the assertion races that write.
    const h = habit();
    await putHabit(h);
    await putChallenge({ id: newId(), type: 'streak7', habitId: h.id, scopeLabel: h.name, status: 'active', startedAt: Date.now() });
    await putChallenge({ id: newId(), type: 'weekend', scopeLabel: 'All habits', status: 'active', startedAt: Date.now() });
    await putChallenge({ id: newId(), type: 'category7', category: h.category, scopeLabel: h.category, status: 'active', startedAt: Date.now() });
    render(<ChallengesScreen />);
    expect(await screen.findByText(/up to 3 active challenges/i)).toBeInTheDocument();
  });
});
