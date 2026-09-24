import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { todayKey } from '@/lib/dates';
import { TodayScreen } from './TodayScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/today',
}));

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); });

describe('TodayScreen', () => {
  it('groups habits by category, ordered by category name', async () => {
    await putHabit(habit({ name: 'Meditate', category: 'Morning' }));
    await putHabit(habit({ name: 'Drink Water', category: 'Health' }));
    render(<TodayScreen date={todayKey()} />);
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    expect(await screen.findByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Meditate')).toBeInTheDocument();
    expect(screen.getByText('Drink Water')).toBeInTheDocument();
  });

  it('hides a category with nothing scheduled today', async () => {
    await putHabit(habit({ name: 'Weekend only', category: 'Health', frequency: [0, 6] }));
    const today = todayKey();
    if (![0, 6].includes(new Date(`${today}T12:00:00`).getDay())) {
      render(<TodayScreen date={today} />);
      await waitFor(() => expect(screen.queryByText('Health')).not.toBeInTheDocument());
    }
  });

  it('shows the empty state when there are no habits at all', async () => {
    render(<TodayScreen date={todayKey()} />);
    expect(await screen.findByText(/create your first habit/i)).toBeInTheDocument();
  });

  it('writes a 1 when a boolean habit is toggled', async () => {
    const h = habit({ name: 'Take a Cold Shower' });
    await putHabit(h);
    render(<TodayScreen date={todayKey()} />);
    const button = await screen.findByRole('button', { name: /mark take a cold shower done/i });
    button.click();
    await waitFor(async () => {
      const { loadDay } = await import('@/lib/repo');
      expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(1);
    });
  });

  it('shows the checked state for an already-completed habit', async () => {
    const h = habit({ name: 'Read' });
    await putHabit(h);
    await putEntry(h.id, todayKey(), 1);
    render(<TodayScreen date={todayKey()} />);
    expect(await screen.findByRole('button', { name: /mark read not done/i })).toBeInTheDocument();
  });
});
