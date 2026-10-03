import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { fromKey, todayKey, toKey } from '@/lib/dates';
import { CalendarScreen } from './CalendarScreen';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/calendar',
}));

// Full-suite CPU contention pushes the live-query past the default 1s wait
// budget (same class as NoteScreen/InsightsScreen; A2 + Option A precedent).
// Same elements, same matchers, same assertions — only the wait grows.
const WAIT = { timeout: 5000 } as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
// Label date part must match CalendarScreen: `October 3`, unpadded (spec R5 examples)
const labelDate = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); });

describe('CalendarScreen (slice E R5)', () => {
  it('keeps month names out of prerendered HTML (clock-independent build)', () => {
    const html = renderToString(<CalendarScreen />);
    for (const m of MONTHS) expect(html).not.toContain(m);
  });

  it('renders Monday-first weekday headers in order', async () => {
    const { container } = render(<CalendarScreen />);
    await screen.findByText('Mon');
    const text = container.textContent ?? '';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach((d, i) => {
      expect(text.indexOf(d)).toBeGreaterThan(-1);
      if (i > 0) expect(text.indexOf(d)).toBeGreaterThan(text.indexOf(days[i - 1]));
    });
  });

  it('labels today with aria-current and its route', async () => {
    render(<CalendarScreen />);
    const cell = await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: `), {}, WAIT);
    expect(cell).toHaveAttribute('aria-current', 'date');
    expect(cell).toHaveAttribute('href', `/today/${todayKey()}`);
  });

  it('is frequency-aware: a due day reports 0 of N until completed', async () => {
    await putHabit(habit());                       // daily, not done today
    render(<CalendarScreen />);
    await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: 0 of 1 done, 0%$`), {}, WAIT);
  });

  it('reports a completed day with 100% and a filled dot', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, todayKey(), 1);
    render(<CalendarScreen />);
    const cell = await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: 1 of 1 done, 100%$`), {}, WAIT);
    expect(cell.innerHTML).toContain('bg-[var(--color-accent)]');     // filled dot
    expect(cell.innerHTML).not.toContain('border-[var(--color-subtle)]');
  });

  it('labels a never-due day “nothing scheduled” (empty frequency = never due)', async () => {
    await putHabit(habit({ frequency: [] }));
    render(<CalendarScreen />);
    await screen.findByLabelText(new RegExp(`^${labelDate(todayKey())}: nothing scheduled$`), {}, WAIT);
  });

  it('keeps future days neutral and non-interactive (spec R5)', async () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    // Anchor to the single first day of next month — `/: upcoming$/` would match
    // every future cell and findByLabelText throws "found multiple" in a retry loop.
    const d = fromKey(todayKey());
    const next1 = toKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    const cell = await screen.findByLabelText(new RegExp(`^${labelDate(next1)}: upcoming$`), {}, WAIT);
    expect(cell.tagName).toBe('SPAN');
    expect(cell).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: /upcoming$/ })).not.toBeInTheDocument();
  });

  it('routes a tapped past day to /today/<key>', async () => {
    const d = fromKey(todayKey());
    const prev15 = toKey(new Date(d.getFullYear(), d.getMonth() - 1, 15));   // always past
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    const cell = await screen.findByLabelText(new RegExp(`^${labelDate(prev15)}: `), {}, WAIT);
    expect(cell).toHaveAttribute('href', `/today/${prev15}`);
    expect(cell).toHaveAttribute('data-next-link');
  });

  it('switches months and returns via Today', async () => {
    render(<CalendarScreen />);
    const d = fromKey(todayKey());
    const thisMonth = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    expect(await screen.findByText(thisMonth)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    expect(screen.getByText(`${MONTHS[next.getMonth()]} ${next.getFullYear()}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByText(thisMonth)).toBeInTheDocument();
  });
});
