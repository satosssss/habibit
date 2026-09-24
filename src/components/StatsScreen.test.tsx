import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { todayKey, addDays } from '@/lib/dates';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); });

describe('StatsScreen', () => {
  it('shows the four year tiles and the four all-time tiles', async () => {
    await putHabit(habit());
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    for (const caption of ['Active Days', 'Perfect Days', 'Completion Rate', 'Completions',
                           'Current Streak', 'Longest Streak', 'Total Active Days', 'Total Perfect Days']) {
      expect(await screen.findByText(caption)).toBeInTheDocument();
    }
  });

  it('renders one bar per intention with its fraction', async () => {
    const a = habit({ intention: 'Study', name: 'Learn Spanish' });
    const b = habit({ intention: 'Be Grateful', name: 'Read' });
    await putHabit(a);
    await putHabit(b);
    await putEntry(a.id, addDays(todayKey(), -1), 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('Study')).toBeInTheDocument();
    expect(await screen.findByText('Be Grateful')).toBeInTheDocument();
    expect(await screen.findByText('1/2')).toBeInTheDocument(); // Study: today + yesterday scheduled, 1 done
  });

  it('renders the current year in the nav', async () => {
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText(String(new Date().getFullYear()))).toBeInTheDocument();
  });

  it('lays the intention bars beside the heatmap on tablet, full width on desktop (spec §10)', async () => {
    const { StatsScreen } = await import('./StatsScreen');
    const { container } = render(<StatsScreen />);
    const grid = container.querySelector<HTMLElement>('div[class*="md:grid-cols-2"]');
    expect(grid).not.toBeNull();
    expect(grid!.querySelector('[aria-label="Activity heatmap"]')).toBeInTheDocument();
    expect(within(grid!).getByText('By intention')).toBeInTheDocument();
    expect(grid!.className).toContain('xl:grid-cols-1');
    expect(grid!.className).toContain('gap-6');
  });

  it('sorts intention rows by habit order (spec §7.3)', async () => {
    // Explicit ids pin retrieval order (primary key): Study first without the
    // order sort (5 vs 1), so only sorting can put Be Grateful on top.
    await putHabit(habit({ id: 'a-study', intention: 'Study', name: 'Learn Spanish', order: 5 }));
    await putHabit(habit({ id: 'b-grateful', intention: 'Be Grateful', name: 'Read', order: 1 }));
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    const study = await screen.findByText('Study');
    const grateful = await screen.findByText('Be Grateful');
    expect(
      grateful.compareDocumentPosition(study) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
