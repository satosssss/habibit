import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from '@/lib/types';
import { TrendsSection } from './TrendsSection';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const entry = (habitId: string, date: string, value: number): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

const TIMED = Date.parse('2026-09-21T00:00:00'); // habit born Monday 2026-09-21

describe('TrendsSection', () => {
  it('renders the Trends heading and the three card titles', () => {
    render(<TrendsSection habits={[habit()]} entries={[]} year={2026} today="2026-09-23" />);
    expect(screen.getByRole('heading', { name: 'Trends', level: 2 })).toBeInTheDocument();
    for (const t of ['Streak growth', 'Consistency', 'When you show up']) {
      expect(screen.getByRole('heading', { name: t, level: 3 })).toBeInTheDocument();
    }
  });

  it('shows the neutral empty state when there are no habits', () => {
    render(<TrendsSection habits={[]} entries={[]} year={2026} today="2026-09-23" />);
    expect(screen.getByText('No habits yet.')).toBeInTheDocument();
    expect(screen.queryByText('Streak growth')).not.toBeInTheDocument();
  });

  it('annotates the longest run, counting a streak that entered the year from December', () => {
    const entries = [
      entry('h1', '2025-12-30', 1), entry('h1', '2025-12-31', 1), entry('h1', '2026-01-01', 1),
    ];
    render(<TrendsSection habits={[habit()]} entries={entries} year={2026} today="2026-01-01" />);
    expect(screen.getByText('Longest this year: 3')).toBeInTheDocument(); // full value at Jan 1
  });

  it('renders the consistency chart with y ticks and a slot-weighted average', () => {
    const entries = [entry('h1', '2026-09-21', 1), entry('h1', '2026-09-22', 1)];
    render(
      <TrendsSection habits={[habit({ createdAt: TIMED })]} entries={entries}
                     year={2026} today="2026-09-23" />,
    );
    expect(screen.getByTestId('trend-consistency')).toBeInTheDocument();
    for (const t of ['100%', '50%', '0%']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('Average: 67%')).toBeInTheDocument(); // 2 of 3 slots (Sep 21–23)
    expect(screen.getByText('Longest this year: 2')).toBeInTheDocument();
  });

  it('falls back per card when the year has no slots or completions', () => {
    render(<TrendsSection habits={[habit({ frequency: [] })]} entries={[]} year={2026} today="2026-09-23" />);
    expect(screen.getByText('No streaks in 2026.')).toBeInTheDocument();
    expect(screen.getAllByText('Nothing scheduled in 2026.')).toHaveLength(2); // consistency card + weekday group
    expect(screen.getByText('No completions in 2026.')).toBeInTheDocument();   // hour group
  });

  it('renders weekday bars with per-day accessible text', () => {
    const entries = [entry('h1', '2026-09-21', 1)]; // Monday done
    render(
      <TrendsSection habits={[habit({ createdAt: TIMED })]} entries={entries}
                     year={2026} today="2026-09-21" />,
    );
    const list = screen.getByRole('list', { name: 'Completion rate by weekday' });
    expect(within(list).getByText('Monday: 100% (1 of 1)')).toBeInTheDocument();
    expect(within(list).getByText('Tuesday: nothing scheduled')).toBeInTheDocument();
  });

  it('renders hourly bars with tick labels and completion counts', () => {
    const timed = (date: string, hour: number): Entry => ({
      id: `h1_${date}`, habitId: 'h1', date, value: 1,
      timestamp: Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00`),
    });
    const entries = [timed('2026-09-21', 8), timed('2026-09-22', 8)];
    render(
      <TrendsSection habits={[habit({ createdAt: TIMED })]} entries={entries}
                     year={2026} today="2026-09-23" />,
    );
    const list = screen.getByRole('list', { name: 'Completions by hour of day' });
    expect(within(list).getByText('8 am: 2 completions')).toBeInTheDocument();
    expect(within(list).getByText('6a')).toBeInTheDocument();  // tick at 06:00
    expect(within(list).getByText('12p')).toBeInTheDocument(); // tick at 12:00
  });
});
