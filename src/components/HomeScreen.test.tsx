import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, loadDay, newId, putEntry, putHabit } from '@/lib/repo';
import { dismissCompletionToast } from '@/lib/completionToast';
import type { Habit } from '@/lib/types';
import { addDays, todayKey } from '@/lib/dates';
import { getThemePref } from '@/lib/theme';
import { HomeScreen } from './HomeScreen';

// Full-suite CPU contention pushes fake-indexeddb write→read roundtrips past
// the default 1s wait budget (observed: value still 8 at 1000ms under load).
// Same elements, same matchers, same assertions — only the window grows.
// Per-call precedent: NoteScreen/InsightsScreen WAIT={timeout:5000}; here the
// wait sites are numerous, so the file-wide default is raised instead.
configure({ asyncUtilTimeout: 5000 });

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/today',
}));
vi.mock('next/link', () => ({
  // data-next-link marks router-rendered anchors so tests can tell a real
  // next/link apart from a hand-written <a> (both render <a> in jsdom).
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
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

// A2: the toast store is module-level and outlives each render — reset it so
// a celebration from one test can never satisfy (or break) the next one.
afterEach(() => { dismissCompletionToast(); });

describe('HomeScreen', () => {
  it('defaults the date to the current day when no date prop is passed', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T09:00:00')); // Wednesday
    try {
      render(<HomeScreen />);
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
    render(<HomeScreen date={todayKey()} />);
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
    render(<HomeScreen date="2026-09-23" />);
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    expect(screen.queryByText('Health')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no habits at all', async () => {
    render(<HomeScreen date={todayKey()} />);
    expect(await screen.findByText(/create your first habit/i)).toBeInTheDocument();
  });

  it('writes a 1 when a boolean habit is toggled', async () => {
    const h = habit({ name: 'Take a Cold Shower' });
    await putHabit(h);
    render(<HomeScreen date={todayKey()} />);
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
    render(<HomeScreen date={todayKey()} />);
    expect(await screen.findByRole('button', { name: /mark read not done/i })).toBeInTheDocument();
  });

  it('routes a tapped past day to /today/<key>', () => {
    render(<HomeScreen date={todayKey()} />);
    const pastKey = addDays(todayKey(), -1);
    screen.getByRole('button', { name: pastKey }).click();
    expect(push).toHaveBeenCalledWith(`/today/${pastKey}`);
  });

  // Task 14 review issue 6b: §10 preamble — "CSS `columns` for category
  // masonry"; grid leaves gaps between unequal-height category panels.
  it('lays category panels out in CSS columns: 1 / 2 / 3 across (spec §10)', async () => {
    await putHabit(habit({ id: 'a-morning', name: 'Meditate', category: 'Morning' }));
    await putHabit(habit({ id: 'z-health', name: 'Drink Water', category: 'Health' }));
    render(<HomeScreen date={todayKey()} />);
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
    render(<HomeScreen date={todayKey()} />);
    const container = document.querySelector<HTMLElement>('.max-w-3xl');
    expect(container).not.toBeNull();
    expect(container!.className.split(/\s+/)).toContain('xl:max-w-6xl');
  });
});

// Branch review #2 — spec §5.1 header: hamburger (mobile) | centered title |
// flame + streak | `+` → /add-habit (slice E R2; creation left the Home screen).
describe('Home header (spec §5.1)', () => {
  it('routes the header + to /add-habit (slice E R2)', () => {
    render(<HomeScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add habit' }));
    expect(push).toHaveBeenCalledWith('/add-habit');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a menu drawer from the hamburger, shown on mobile only via md:hidden', async () => {
    render(<HomeScreen date={todayKey()} />);
    const hamburger = screen.getByRole('button', { name: /open menu/i });
    // Visibility is a Tailwind breakpoint, never a JS width check (constraint 2d)
    expect(hamburger.className.split(/\s+/)).toContain('md:hidden');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(hamburger);
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  });

  it('routes to Settings from the drawer and closes it', async () => {
    render(<HomeScreen date={todayKey()} />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(push).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('flips the persisted theme from the drawer toggle', async () => {
    localStorage.setItem('habibit:theme', 'light');
    render(<HomeScreen date={todayKey()} />);
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
describe('HomeScreen prerender (SSR)', () => {
  it('emits clock-independent HTML with no date text', () => {
    const html = renderToString(<HomeScreen date="2026-05-24" />);
    expect(html).not.toContain('2026-');
    expect(html).not.toMatch(/May 24|May/);
    expect(html).toContain('Loading'); // the clock-independent body still renders
  });
});

// Spec §3 (R1): one shared, uncapped streak window for Today and Stats.
describe('shared all-time streak (R1)', () => {
  const longFixture = async () => {
    const h = habit({ name: 'Meditate' });
    h.createdAt = Date.parse(`${addDays(todayKey(), -89)}T09:00:00`);
    await putHabit(h);
    for (let i = 0; i < 90; i++) await putEntry(h.id, addDays(todayKey(), -i), 1);
    return h;
  };

  it('shows an uncapped 90-day streak in the header and on the habit badge', async () => {
    await longFixture();
    render(<HomeScreen />);
    // The header span renders immediately with 0; wait for the live queries to
    // fill (findByTestId alone would resolve on the first, empty paint).
    // Old code capped both at 41 (a 40-day window + today).
    await waitFor(() => expect(screen.getByTestId('header-streak')).toHaveTextContent('90'));
    expect(screen.getByTestId('flame-badge')).toHaveTextContent('90');
  });

  it('matches the Stats Current Streak tile on the same data', async () => {
    await longFixture();
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('header-streak')).toHaveTextContent('90'));
    const header = screen.getByTestId('header-streak');

    const { InsightsScreen } = await import('./InsightsScreen');
    render(<InsightsScreen />);
    const tile = (await screen.findByText('Current Streak')).closest('div')!;
    const tileValue = await within(tile).findByText('90');
    expect(header.textContent?.trim()).toBe(tileValue.textContent?.trim());
  });
});

// Spec R1: the quantity write path — step to the target, then the control stops.
it('steps up to the target and then disables the stepper (R1)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 7);
  render(<HomeScreen date={todayKey()} />);
  const add = await screen.findByRole('button', { name: /add one cups/i });
  fireEvent.click(add);
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByRole('button', { name: /add one cups/i })).toBeDisabled();
});

// Spec §9: the timer row's write path — opening the modal at the full duration.
it('opens the timer modal from a timer habit row', async () => {
  const h = habit({ name: 'Meditate', type: 'timer', target: 900 });
  await putHabit(h);
  render(<HomeScreen date={todayKey()} />);
  fireEvent.click(await screen.findByRole('button', { name: /open timer for meditate/i }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('15:00')).toBeInTheDocument();
});

// Spec R6: a hostile export imports AND renders — no error boundary, no throw.
it('renders a hostile import without crashing (R6)', async () => {
  const { importState } = await import('@/lib/repo');
  await importState({
    habits: [{
      id: 'x1', name: '', icon: 'nope', color: 'red', category: '', intention: '',
      type: 'quantity', target: 11, unit: 'cups', frequency: [0, 1, 2, 3, 4, 5, 6, 9], order: 0, createdAt: 0,
    }],
    entries: [{ id: 'x1_2026-09-22', habitId: 'x1', date: todayKey(), value: 99, timestamp: 0 }],
  });
  render(<HomeScreen date={todayKey()} />);
  expect(await screen.findByText('Untitled habit')).toBeInTheDocument();      // repaired name
  expect(await screen.findByText('Every day, 11/11 cups')).toBeInTheDocument(); // target 11 survives, value 99 → clamped 11
});

// Spec R3.1: first paint gates on BOTH queries — no flash of 0/8.
it('shows Loading… until habits and entries both resolve (R3)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 0);
  render(<HomeScreen date={todayKey()} />);
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  expect(screen.queryByText(/0\/8/)).not.toBeInTheDocument();
  expect(await screen.findByText('Every day, 0/8 cups')).toBeInTheDocument();
});

// Spec R3.3: a failed write surfaces on the shared banner (mounted by NavShell).
it('surfaces a failed toggle write on the shared banner (R3)', async () => {
  const h = habit({ name: 'Take a Cold Shower' });
  await putHabit(h);
  const repo = await import('@/lib/repo');
  vi.spyOn(repo, 'putEntry').mockImplementationOnce(
    () => Promise.reject(new Error('quota exceeded')),
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { NavShell } = await import('./NavShell');
  render(<NavShell><HomeScreen date={todayKey()} /></NavShell>);
  const button = await screen.findByRole('button', { name: /mark take a cold shower done/i });
  button.click();
  expect(await screen.findByTestId('write-error'))
    .toHaveTextContent(/couldn't save that change/i);
  expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument(); // A2: failed writes never celebrate
  vi.restoreAllMocks();
});

// Spec R2: the future-day branch is dead (routes redirect) — remove it, and
// a directly-passed future date renders normally with no ghost message.
it('renders a directly-passed future date without the dead branch (R2)', async () => {
  await putHabit(habit({ name: 'Daily Stretch' }));
  render(<HomeScreen date="2026-12-31" />);
  expect(await screen.findByText('Daily Stretch')).toBeInTheDocument();
  expect(screen.queryByText(/hasn’t happened yet/i)).not.toBeInTheDocument();
});

it('routes the empty-state CTA through the client router (R2)', async () => {
  render(<HomeScreen date={todayKey()} />);
  const cta = await screen.findByRole('link', { name: /add a habit/i });
  expect(cta).toHaveAttribute('href', '/add-habit');
  expect(cta).toHaveAttribute('data-next-link');   // next/link, not a bare <a>
});

// Slice A2 R1/R2: the check button completes quantity rows and celebrates.
it('completes a quantity habit from its check button and celebrates (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><HomeScreen date={todayKey()} /></NavShell>);
  const check = await screen.findByRole('button', { name: 'Mark Drink Water done' });
  check.click();
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByTestId('completion-toast'))
    .toHaveTextContent('Nice work — Drink Water is done!');
  fireEvent.click(screen.getByRole('button', { name: 'Mark Drink Water not done' }));
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(0);
  });
});

it('celebrates when a stepper crosses the target, then stops at the cap (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 7);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><HomeScreen date={todayKey()} /></NavShell>);
  (await screen.findByRole('button', { name: /add one cups/i })).click();
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByTestId('completion-toast')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add one cups/i })).toBeDisabled(); // cap: no further write
});

it('celebrates when the exact-value sheet saves a full target (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><HomeScreen date={todayKey()} /></NavShell>);
  fireEvent.click(await screen.findByRole('button', { name: 'Set exact value for Drink Water' }));
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(8);
  });
  expect(await screen.findByTestId('completion-toast'))
    .toHaveTextContent('Nice work — Drink Water is done!');
});

it('never celebrates an undo (A2)', async () => {
  const h = habit({ name: 'Drink Water', type: 'quantity', target: 8, unit: 'cups' });
  await putHabit(h);
  await putEntry(h.id, todayKey(), 8);
  const { NavShell } = await import('./NavShell');
  render(<NavShell><HomeScreen date={todayKey()} /></NavShell>);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Drink Water not done' }));
  await waitFor(async () => {
    expect((await loadDay(todayKey())).find((e) => e.habitId === h.id)?.value).toBe(0);
  });
  expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
});

it('never celebrates an imported completion (A2)', async () => {
  const { importState } = await import('@/lib/repo');
  await importState({
    habits: [{
      id: 'x1', name: 'Drink Water', icon: 'target', color: '#6366f1', category: 'Health',
      intention: 'Feel Better', type: 'quantity', target: 8, unit: 'cups',
      frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
    }],
    entries: [{ id: `x1_${todayKey()}`, habitId: 'x1', date: todayKey(), value: 8, timestamp: 0 }],
  });
  const { NavShell } = await import('./NavShell');
  render(<NavShell><HomeScreen date={todayKey()} /></NavShell>);
  expect(await screen.findByText('Every day, 8/8 cups')).toBeInTheDocument();
  expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
});
