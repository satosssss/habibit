import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { addDays, todayKey } from '@/lib/dates';
import { TodayScreen } from './TodayScreen';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/today',
}));

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { push.mockClear(); await clearAll(); });

describe('TodayScreen', () => {
  it('defaults the date to the current day when no date prop is passed', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T09:00:00')); // Wednesday
    try {
      render(<TodayScreen />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Today');
      const selected = screen.getByRole('button', { name: '2026-09-30' });
      expect(selected).toHaveAttribute('aria-current', 'date');
      expect(screen.getByRole('button', { name: '2026-09-29' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '2026-09-24' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('groups habits by category, ordered by category name', async () => {
    // Explicit ids: unsorted retrieval (primary-key/insertion order) is then
    // Morning, Health — guaranteed to differ from the sorted expectation.
    await putHabit(habit({ id: 'a-morning', name: 'Meditate', category: 'Morning' }));
    await putHabit(habit({ id: 'z-health', name: 'Drink Water', category: 'Health' }));
    render(<TodayScreen date={todayKey()} />);
    expect(await screen.findByText('Meditate')).toBeInTheDocument();
    expect(screen.getByText('Drink Water')).toBeInTheDocument();
    // Spec §5.3: sections ordered by category name (localeCompare → Health < Morning)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Health', 'Morning']);
  });

  it('hides a category with nothing scheduled on the rendered day', async () => {
    await putHabit(habit({ name: 'Weekend only', category: 'Health', frequency: [0, 6] }));
    await putHabit(habit({ name: 'Daily Stretch', category: 'Morning' }));
    // Fixed Wednesday so exactly one category is hidden on every possible run day
    render(<TodayScreen date="2026-09-23" />);
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    expect(screen.queryByText('Health')).not.toBeInTheDocument();
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

  it('routes a tapped past day to /today/<key>', () => {
    render(<TodayScreen date={todayKey()} />);
    const pastKey = addDays(todayKey(), -1);
    screen.getByRole('button', { name: pastKey }).click();
    expect(push).toHaveBeenCalledWith(`/today/${pastKey}`);
  });
});
