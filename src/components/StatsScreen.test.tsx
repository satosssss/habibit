import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    for (const caption of ['Active Days', 'Perfect Days', 'This week', 'Completions',
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
    await screen.findByText('By intention');
    // gap-6 (not md:grid-cols-2) selects this grid: once tiles also break at md
    // they would otherwise match first in document order.
    const grid = container.querySelector<HTMLElement>('div[class*="gap-6"]');
    expect(grid).not.toBeNull();
    expect(grid!.querySelector('[aria-label="Activity heatmap"]')).toBeInTheDocument();
    expect(within(grid!).getByText('By intention')).toBeInTheDocument();
    // Base track: without it the implicit mobile `auto` track grows to
    // max-content (~918px) and /stats scrolls horizontally at 390px. Token
    // match, because 'grid-cols-1' is a substring of 'xl:grid-cols-1'.
    expect(grid!.className.split(/\s+/)).toContain('grid-cols-1');
    expect(grid!.className).toContain('xl:grid-cols-1');
    expect(grid!.className).toContain('gap-6');
  });

  // Task 14 review issue 6a: §10's Stats row — mobile "Stacked", tablet "Tiles
  // 2×2", desktop "Tiles 4-across".
  it('stacks tiles one-across on mobile, 2×2 on tablet, 4-across on desktop (spec §10)', async () => {
    const { StatsScreen } = await import('./StatsScreen');
    const { container } = render(<StatsScreen />);
    await screen.findByText('Active Days');
    const grids = container.querySelectorAll<HTMLElement>('div[class*="xl:grid-cols-4"]');
    expect(grids).toHaveLength(2); // year tiles + all-time tiles
    for (const grid of grids) {
      const classes = grid.className.split(/\s+/);
      expect(classes).toContain('grid-cols-1');     // mobile: stacked
      expect(classes).toContain('md:grid-cols-2');  // tablet: 2×2
      expect(classes).toContain('xl:grid-cols-4');  // desktop: 4-across
      expect(grid.children).toHaveLength(4);
    }
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

  it('shows Loading… on first paint — never 0 tiles or a false "No habits yet." (R3)', async () => {
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Active Days')).not.toBeInTheDocument();
    expect(screen.queryByText('No habits yet.')).not.toBeInTheDocument();
    expect(await screen.findByText('Active Days')).toBeInTheDocument(); // empty DB resolves → true zeros
  });
});

// Spec §8 (R6): the fourth year tile. Only Date is faked (toFake: ['Date']),
// so liveQuery/findBy keep real timers; the pinned Wednesday makes every
// Monday-start window fixture weekday-independent.
describe('weekly trend tile (R6)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('compares identical elapsed windows, not whole weeks (R6.1)', async () => {
    // 4 daily habits → 12 slots per window (≥ N = 10, so rule 3 doesn't fire).
    const habits = [habit({ name: 'A' }), habit({ name: 'B' }), habit({ name: 'C' }), habit({ name: 'D' })];
    for (const h of habits) await putHabit(h);
    // Last week: all 12 elapsed slots done (100%); Thu–Sun deliberately untouched.
    for (const d of ['2026-09-21', '2026-09-22', '2026-09-23'])
      for (const h of habits) await putEntry(h.id, d, 1);
    // This week: Mon+Tue done, Wed missed → 8/12 = 67%. A whole-week reading
    // would score last week 12/28 = 43% and claim "Stronger"; elapsed says ↓.
    for (const d of ['2026-09-28', '2026-09-29'])
      for (const h of habits) await putEntry(h.id, d, 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    // 5s: the default 1s waitFor misses under full-parallel suite contention
    // (A2 env hardening — same data, same assertions, wider window).
    expect(await screen.findByText('8 of 12', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(await screen.findByText(/↓ Quieter than last week, that’s okay/)).toBeInTheDocument();
  });

  it('compares rates, not counts, when a habit starts mid-week (R6.2)', async () => {
    const habits = [habit({ name: 'A' }), habit({ name: 'B' }), habit({ name: 'C' }), habit({ name: 'D' })];
    for (const h of habits) await putHabit(h);
    // A fifth habit joins on Monday: this window gains slots (+3), last one doesn't.
    const fresh = await putHabit(habit({ name: 'Start small', createdAt: Date.parse('2026-09-28T00:00:00') }));
    for (const d of ['2026-09-21', '2026-09-22', '2026-09-23'])
      for (const h of habits) await putEntry(h.id, d, 1);   // last: 12/12 = 100%, counts 12
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30'])
      for (const h of habits) await putEntry(h.id, d, 1);
    await putEntry(fresh.id, '2026-09-28', 1);              // this: 13/15 = 87% — counts rose 12→13, rate fell
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('13 of 15')).toBeInTheDocument();  // denominators differ (12 vs 15)
    expect(await screen.findByText(/↓ Quieter than last week/)).toBeInTheDocument();
  });

  it('renders "A quiet week" when nothing is scheduled this window (R6.3)', async () => {
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('0 of 0')).toBeInTheDocument();
    expect(await screen.findByText('A quiet week · All year: 0%')).toBeInTheDocument(); // sub format pinned
  });

  it('renders "First week" without a baseline (R6.3)', async () => {
    const fresh = await putHabit(habit({ createdAt: Date.parse('2026-09-28T09:00:00') })); // Monday of this week
    await putEntry(fresh.id, '2026-09-29', 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText(/First week · All year/)).toBeInTheDocument();
  });

  it('renders "Just getting started" below ten slots (R6.3/§8 rule 3)', async () => {
    const daily = habit({});
    await putHabit(daily);
    await putEntry(daily.id, '2026-09-30', 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('1 of 3')).toBeInTheDocument(); // Mon+Tue+Wed, one done
    expect(await screen.findByText(/Just getting started · All year/)).toBeInTheDocument();
  });

  it('renders "≈ Same as last week" when both windows are untouched and ≥ 10 slots (R6.3)', async () => {
    for (const name of ['A', 'B', 'C', 'D']) await putHabit(habit({ name })); // 4 daily habits → 12 slots
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('0 of 12')).toBeInTheDocument();
    expect(await screen.findByText(/≈ Same as last week · All year/)).toBeInTheDocument();
  });

  it('renders "↑ Stronger than last week" when the rate jumps (R6.3/§8 rule 5)', async () => {
    const habits = [habit({ name: 'A' }), habit({ name: 'B' }), habit({ name: 'C' }), habit({ name: 'D' })];
    for (const h of habits) await putHabit(h);
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30'])
      for (const h of habits) await putEntry(h.id, d, 1); // this: 12/12; last: 0/12 → ↑
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('12 of 12')).toBeInTheDocument();
    expect(await screen.findByText(/↑ Stronger than last week · All year/)).toBeInTheDocument();
  });

  it('keeps days after today out of the windows (R6.6)', async () => {
    const daily = habit({});
    await putHabit(daily);
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
      await putEntry(daily.id, d, 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('3 of 3')).toBeInTheDocument(); // Mon–Wed only
    expect(screen.queryByText('5 of 5')).not.toBeInTheDocument();
  });

  it('shows a past year as counts with no All year and no comparison (R6.4)', async () => {
    const old = await putHabit(habit({
      frequency: [1],                                            // Mondays only
      createdAt: Date.parse('2025-12-01T09:00:00'),              // Dec 1 2025 is a Monday
    }));
    await putEntry(old.id, '2025-12-01', 1);
    await putEntry(old.id, '2025-12-08', 1);
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Previous year' }));
    expect(await screen.findByText('Completed in 2025')).toBeInTheDocument();
    // findBy, not get: the caption flips with the `year` state while the
    // year-scoped entries liveQuery re-emits a tick later.
    expect(await screen.findByText('2 of 5')).toBeInTheDocument();       // Dec 1, 8, 15, 22, 29 — two done
    expect(screen.queryByText(/All year/)).not.toBeInTheDocument(); // substring: would catch a leaked sub line
    expect(screen.queryByText(/Stronger|Quieter|Same as last|First week|Just getting|quiet week/i))
      .not.toBeInTheDocument();
  });

  it('rises in the tiles but not in the weekly slots or All year (R6.5 + R4 tiles)', async () => {
    const mwf = habit({ frequency: [1, 3], createdAt: Date.parse('2026-09-21T00:00:00') }); // Mon + Wed only
    await putHabit(mwf);
    await putEntry(mwf.id, '2026-09-28', 1);  // Mon — scheduled
    await putEntry(mwf.id, '2026-09-29', 1);  // Tue — OFF schedule (bonus)
    await putEntry(mwf.id, '2026-09-30', 1);  // Wed — scheduled
    const { StatsScreen } = await import('./StatsScreen');
    render(<StatsScreen />);
    expect(await screen.findByText('2 of 2')).toBeInTheDocument();          // weekly tile: slots only
    const activeDays = (await screen.findByText('Active Days')).closest('div')!;
    expect(within(activeDays).getByText('3')).toBeInTheDocument();          // Mon + Tue-bonus + Wed
    const completions = (await screen.findByText('Completions')).closest('div')!;
    expect(within(completions).getByText('3')).toBeInTheDocument();         // all three logged
    // Rate family: Mon+Wed since createdAt = 4 slots, 2 done → 50%. A leaked
    // bonus would read 75%, so this pins the exclusion (spec §6).
    expect(await screen.findByText(/All year: 50%/)).toBeInTheDocument();
  });
});

// Spec §5 / §11 spot-check: a past year opens at January even when the
// current-year view was scrolled to the current week (only observable on
// scrollable widths — mobile, her actual device; desktop fits the whole year).
describe('heatmap year switch (R3 §5)', () => {
  it('opens a past year at January after the current year was scrolled', async () => {
    await putHabit(habit({ id: 'old-habit', name: 'Old Habit', frequency: [1],
                           createdAt: Date.parse('2025-12-01T09:00:00') }));
    const { StatsScreen } = await import('./StatsScreen');
    const { container } = render(<StatsScreen />);
    const prev = () => screen.getByRole('button', { name: 'Previous year' }) as HTMLButtonElement;
    await waitFor(() => expect(prev().disabled).toBe(false)); // minYear picked up the old habit
    const sc = () => container.querySelector('[data-testid="hm-scroll"]') as HTMLElement;
    sc().scrollLeft = 270;                                    // current-year auto-scrolled position
    fireEvent.click(prev());
    expect(await screen.findByText('Completed in 2025')).toBeInTheDocument();
    expect(sc().scrollLeft).toBe(0);                          // January, not the carried-over 270
  });
});
