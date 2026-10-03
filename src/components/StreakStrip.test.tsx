import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '@/lib/dates';
import type { Entry, Habit } from '@/lib/types';
import { StreakStrip } from './StreakStrip';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});
const entry = (date: string, value = 1): Entry => ({
  id: `h1_${date}`, habitId: 'h1', date, value, timestamp: 0,
});
const strip = () => screen.getByRole('region', { name: 'Streak summaries' });

describe('StreakStrip (slice E R2)', () => {
  it('summarizes best streak, count on a streak, and today', () => {
    const t = todayKey();
    render(<StreakStrip habits={[habit()]} entries={[entry(t)]} today={t} />);
    const s = strip();
    expect(within(s).getByText('Meditate')).toBeInTheDocument();
    expect(within(s).getByText('1 day')).toBeInTheDocument();
    expect(within(s).getByText('1 of 1 habits on a streak')).toBeInTheDocument();
    expect(within(s).getByText('1 of 1 done')).toBeInTheDocument();
    expect(within(s).getByTestId('flame-badge')).toBeInTheDocument();
  });

  it('uses the warm zero-state copy when no streak exists (spec R2 exact copy)', () => {
    const t = todayKey();
    render(<StreakStrip habits={[habit()]} entries={[]} today={t} />);
    const s = strip();
    expect(within(s).getByText('0 days')).toBeInTheDocument();
    expect(within(s).getByText('Start today — streaks build as you go')).toBeInTheDocument();
    expect(within(s).getByText('0 of 1 habits on a streak')).toBeInTheDocument();
    expect(within(s).getByText('0 of 1 done')).toBeInTheDocument();
    expect(within(s).queryByTestId('flame-badge')).not.toBeInTheDocument();   // FlameBadge hides 0
  });

  it('says nothing scheduled when no habit is due', () => {
    const t = todayKey();
    render(<StreakStrip habits={[habit({ frequency: [] })]} entries={[]} today={t} />);
    expect(strip()).toHaveTextContent('Nothing scheduled today');
  });

  it('picks the best of several streaks', () => {
    const t = todayKey();
    const y = addDays(t, -1);
    const other: Habit = { ...habit(), id: 'h2', name: 'Stretch' };
    render(
      <StreakStrip
        habits={[habit(), other]}
        entries={[
          entry(t),                                                 // h1 Meditate: 1 day
          { ...entry(t), habitId: 'h2', id: `h2_${t}` },            // h2 Stretch: today…
          { ...entry(y), habitId: 'h2', id: `h2_${y}` },            // …+ yesterday = 2 days
        ]}
        today={t}
      />,
    );
    expect(within(strip()).getByText('Stretch')).toBeInTheDocument();
    expect(within(strip()).getByText('2 days')).toBeInTheDocument();
    expect(within(strip()).getByText('2 of 2 habits on a streak')).toBeInTheDocument();
  });
});
