import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, listHabits, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { addDays, todayKey } from '@/lib/dates';
import { getThemePref } from '@/lib/theme';
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

beforeEach(async () => {
  push.mockClear();
  await clearAll();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

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

  // Task 14 review issue 6b: §10 preamble — "CSS `columns` for category
  // masonry"; grid leaves gaps between unequal-height category panels.
  it('lays category panels out in CSS columns: 1 / 2 / 3 across (spec §10)', async () => {
    await putHabit(habit({ id: 'a-morning', name: 'Meditate', category: 'Morning' }));
    await putHabit(habit({ id: 'z-health', name: 'Drink Water', category: 'Health' }));
    render(<TodayScreen date={todayKey()} />);
    await screen.findByText('Morning');
    const grid = document.querySelector<HTMLElement>('div[class*="md:columns-2"]');
    expect(grid).not.toBeNull();
    const classes = grid!.className.split(/\s+/);
    expect(classes).toContain('md:columns-2');   // tablet: 2 columns of panels
    expect(classes).toContain('xl:columns-3');   // desktop: 3 columns, masonry
    expect(classes.some((c) => c.startsWith('grid-cols'))).toBe(false); // grid ≠ masonry
    const sections = grid!.querySelectorAll('section');
    expect(sections).toHaveLength(2);
    for (const section of sections)               // never split a panel across columns
      expect(section.className.split(/\s+/)).toContain('break-inside-avoid');
  });

  // At xl the masonry runs 3 columns (~234px each inside max-w-3xl); a
  // quantity row's fixed chrome (px-3, icon, stepper, ring ≈ 218px) would
  // otherwise leave the truncated habit name ~16px.
  it('widens the screen container at xl so habit names keep room (spec §10)', () => {
    render(<TodayScreen date={todayKey()} />);
    const container = document.querySelector<HTMLElement>('.max-w-3xl');
    expect(container).not.toBeNull();
    expect(container!.className.split(/\s+/)).toContain('xl:max-w-6xl');
  });
});

// Branch review #2 — spec §5.1 header: hamburger (mobile) | centered title |
// flame + streak | `+` → new-habit form; §9: `+ New habit` also from Today.
describe('Today header (spec §5.1)', () => {
  it('opens the new-habit form from the header + instead of routing to /settings', async () => {
    render(<TodayScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add habit' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('New habit')).toBeInTheDocument(); // form title, not the route
    expect(screen.getByLabelText('Habit name')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('creates a habit from the header form that renders under its category', async () => {
    render(<TodayScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add habit' }));
    fireEvent.change(await screen.findByLabelText('Habit name'), { target: { value: 'Journal' } });
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    // liveQuery re-emits after putHabit: the row shows up with no manual refetch
    const morning = (await screen.findByRole('heading', { level: 2, name: 'Morning' })).closest('section')!;
    expect(within(morning).getByText('Journal')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await listHabits()).map((h) => h.name)).toContain('Journal');
  });

  it('leaves no habit behind when the header form is closed without saving', async () => {
    render(<TodayScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add habit' }));
    fireEvent.change(await screen.findByLabelText('Habit name'), { target: { value: 'Never saved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Never saved')).not.toBeInTheDocument();
    expect(await listHabits()).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('opens a menu drawer from the hamburger, shown on mobile only via md:hidden', async () => {
    render(<TodayScreen date={todayKey()} />);
    const hamburger = screen.getByRole('button', { name: /open menu/i });
    // Visibility is a Tailwind breakpoint, never a JS width check (constraint 2d)
    expect(hamburger.className.split(/\s+/)).toContain('md:hidden');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(hamburger);
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  });

  it('routes to Settings from the drawer and closes it', async () => {
    render(<TodayScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(push).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('flips the persisted theme from the drawer toggle', async () => {
    localStorage.setItem('habibit:theme', 'light');
    render(<TodayScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    // Labels are lowercase text capitalized by CSS, exactly like ThemePanel.
    const dark = await screen.findByRole('button', { name: 'dark' });
    expect(dark).toHaveAttribute('aria-pressed', 'false'); // hydrated pref: light
    fireEvent.click(dark);
    expect(getThemePref()).toBe('dark');
    expect(localStorage.getItem('habibit:theme')).toBe('dark');
    expect(dark).toHaveAttribute('aria-pressed', 'true');
  });
});

// A statically prerendered /today embeds the build date in the HTML (the h1
// and DateStrip), which then freezes there for every later visit. The server
// markup must be clock-independent: date-derived text only after mount.
describe('TodayScreen prerender (SSR)', () => {
  it('emits clock-independent HTML with no date text', () => {
    const html = renderToString(<TodayScreen date="2026-05-24" />);
    expect(html).not.toContain('2026-');
    expect(html).not.toMatch(/May 24|May/);
    expect(html).toContain('Loading'); // the clock-independent body still renders
  });
});
