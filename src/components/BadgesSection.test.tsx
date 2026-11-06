import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BADGES } from '@/lib/badges';
import { db } from '@/lib/db';
import { clearAll, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { BadgesSection } from './BadgesSection';

const TODAY = '2026-10-21';
const WAIT = { timeout: 5000 } as const;

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const threeDayRun = async (): Promise<{ h: Habit; entries: Awaited<ReturnType<typeof putEntry>>[] }> => {
  const h = habit();
  await putHabit(h);
  const entries = [];
  for (const d of ['2026-10-19', '2026-10-20', '2026-10-21']) entries.push(await putEntry(h.id, d, 1));
  return { h, entries };
};

const renderSection = (h: Habit, entries: Awaited<ReturnType<typeof putEntry>>[] = []) => render(
  <BadgesSection habits={[h]} entries={entries} today={TODAY} />,
);

beforeEach(async () => { await clearAll(); });

describe('BadgesSection (R5)', () => {
  it('renders the full catalog, earned count first, when nothing is earned', async () => {
    const h = habit();
    renderSection(h);
    expect(await screen.findByText(`0 of ${BADGES.length} earned`, {}, WAIT)).toBeInTheDocument();
    for (const def of BADGES) {
      expect(screen.getByTestId(`badge-${def.id}`)).toHaveTextContent(def.title);
    }
  });

  it('shows progress for locked numeric badges and a date for earned ones', async () => {
    const { h, entries } = await threeDayRun();
    await db.badges.put({ id: 'streak-3', earnedAt: Date.parse('2026-10-21T12:00:00') });
    renderSection(h, entries);

    expect(await screen.findByText('1 of 16 earned', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('badge-streak-3')).toHaveTextContent('Earned Oct 21');
    // streak 3 of 7 is visible on the next streak badge.
    expect(screen.getByTestId('badge-streak-7')).toHaveTextContent('3 / 7-day streak');
    // challenge badges are binary — locked copy stands alone.
    expect(screen.getByTestId('badge-challenge-weekend'))
      .toHaveTextContent('Win a Weekend Warrior challenge');
  });

  it('orders earned badges first, newest first, then locked in catalog order', async () => {
    const h = habit();
    await db.badges.put({ id: 'perfect-1', earnedAt: 100 });
    await db.badges.put({ id: 'streak-3', earnedAt: 200 });
    renderSection(h);
    await screen.findByText('2 of 16 earned', {}, WAIT);

    const ids = screen.getAllByTestId(/^badge-/).map((el) => el.getAttribute('data-testid'));
    expect(ids.slice(0, 2)).toEqual(['badge-streak-3', 'badge-perfect-1']); // 200, then 100
    const locked = BADGES.filter((b) => !['streak-3', 'perfect-1'].includes(b.id));
    expect(ids.slice(2)).toEqual(locked.map((b) => `badge-${b.id}`));
  });

  it('marks earned cards with the accent ring and keeps the medallion decorative', async () => {
    const h = habit();
    await db.badges.put({ id: 'completions-1', earnedAt: 1 });
    renderSection(h);
    await screen.findByText('1 of 16 earned', {}, WAIT);
    expect(screen.getByTestId('badge-completions-1').className).toContain('ring-[var(--color-accent)]');
    expect(screen.getByTestId('badge-completions-50').className).not.toContain('ring-[var(--color-accent)]');
    expect(screen.getByTestId('badge-completions-1').querySelector('[aria-hidden]')).not.toBeNull();
  });

  it('ignores unknown stored ids instead of rendering a ghost badge', async () => {
    const h = habit();
    await db.badges.put({ id: 'from-the-future', earnedAt: 1 });
    renderSection(h);
    expect(await screen.findByText('0 of 16 earned', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText('from-the-future')).not.toBeInTheDocument();
  });
});
