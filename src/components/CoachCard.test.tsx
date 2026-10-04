import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, listHabits, putHabit } from '@/lib/repo';
import { addDays, todayKey } from '@/lib/dates';
import type { CoachInsight } from '@/lib/coach';
import type { Habit } from '@/lib/types';
import { CoachCard } from './CoachCard';

// NavShell reads usePathname() on render — same router stubs as
// AddHabitScreen.test.tsx, pinned to Home (CoachCard's real surface).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

const insight = (over: Partial<CoachInsight> = {}): CoachInsight => ({
  id: 'struggle:h1',
  kind: 'struggle',
  category: 'frequency',
  habitId: 'h1',
  title: 'Lighten the schedule',
  body: 'Meditate is slipping — 3 of 14 scheduled days. Trim Saturday and Friday?',
  patch: { frequency: [0, 1, 2, 3, 4] },
  ...over,
});

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); localStorage.clear(); });

describe('CoachCard', () => {
  it('renders nothing when there are no insights', () => {
    render(<CoachCard insights={[]} habits={[]} date={todayKey()} />);
    expect(screen.queryByRole('region', { name: 'Coach' })).not.toBeInTheDocument();
  });

  it('shows only the first visible insight', () => {
    render(<CoachCard insights={[
      insight(),
      insight({ id: 'struggle:h1:stack', category: 'stack', title: 'Stack it', patch: undefined }),
    ]} habits={[]} date={todayKey()} />);
    expect(screen.getByText('Lighten the schedule')).toBeInTheDocument();
    expect(screen.queryByText('Stack it')).not.toBeInTheDocument();
  });

  it('skips insights dismissed earlier (spec §4)', () => {
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({ 'struggle:h1': Date.now() }));
    render(<CoachCard insights={[
      insight(),
      insight({ id: 'levelup:h1:difficulty', category: 'difficulty', kind: 'success', title: 'Level up' }),
    ]} habits={[]} date={todayKey()} />);
    expect(screen.queryByText('Lighten the schedule')).not.toBeInTheDocument();
    expect(screen.getByText('Level up')).toBeInTheDocument();
  });

  it('applies the patch through putHabit (one-tap, spec Q2)', async () => {
    const h = habit();
    await putHabit(h);
    render(<CoachCard insights={[insight()]} habits={[h]} date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(async () => {
      expect((await listHabits())[0].frequency).toEqual([0, 1, 2, 3, 4]);
    });
  });

  it('disables Apply while the write is in flight', async () => {
    const h = habit();
    await putHabit(h);
    const repo = await import('@/lib/repo');
    vi.spyOn(repo, 'putHabit').mockImplementation(() => new Promise<Habit>(() => { /* pending */ }));
    render(<CoachCard insights={[insight()]} habits={[h]} date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    vi.restoreAllMocks();
  });

  it('routes a failed apply to the shared write-error banner (spec R4.2)', async () => {
    const h = habit();
    await putHabit(h);
    const repo = await import('@/lib/repo');
    const spy = vi.spyOn(repo, 'putHabit').mockRejectedValue(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { NavShell } = await import('./NavShell');
    render(<NavShell><CoachCard insights={[insight()]} habits={[h]} date={todayKey()} /></NavShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByTestId('write-error')).toHaveTextContent(/couldn't save that change/i);
    spy.mockRestore();
    vi.restoreAllMocks();
  });

  it('dismiss hides the insight and persists the id for 7 days (spec §4)', () => {
    render(<CoachCard insights={[insight()]} habits={[]} date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss suggestion' }));
    expect(screen.queryByRole('region', { name: 'Coach' })).not.toBeInTheDocument();
    expect(Object.keys(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!)))
      .toEqual(['struggle:h1']);
  });

  it('never renders for a non-today date (spec R4.2)', () => {
    render(<CoachCard insights={[insight()]} habits={[]} date={addDays(todayKey(), -1)} />);
    expect(screen.queryByRole('region', { name: 'Coach' })).not.toBeInTheDocument();
  });

  it('text-only suggestions render no Apply button (spec Q2)', () => {
    render(<CoachCard insights={[insight({ category: 'stack', patch: undefined })]}
                      habits={[]} date={todayKey()} />);
    expect(screen.getByRole('region', { name: 'Coach' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });
});
