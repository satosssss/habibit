import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listHabits, putHabit } from '@/lib/repo';
import type { CoachInsight } from '@/lib/coach';
import type { Habit } from '@/lib/types';
import { CoachSection } from './CoachSection';

const mk = (id: string, category: CoachInsight['category'], kind: CoachInsight['kind'],
            over: Partial<CoachInsight> = {}): CoachInsight => ({
  id, kind, category, habitId: 'h1', title: `${category} title`, body: `body for ${id}`, ...over,
});

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); localStorage.clear(); });

describe('CoachSection', () => {
  it('renders nothing when there is nothing to show', () => {
    render(<CoachSection habits={[]} insights={[]} />);
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument();
  });

  it('splits insights into the three exact group headings (spec R3)', () => {
    render(<CoachSection habits={[]} insights={[
      mk('struggle:h1', 'frequency', 'struggle'),
      mk('levelup:h1:difficulty', 'difficulty', 'success'),
      mk('encourage:2026-09-28', 'encouragement', 'success'),
    ]} />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Needs attention', 'Level up', 'Celebrate']);
    expect(headings[0].parentElement).toHaveTextContent('body for struggle:h1');
    expect(headings[1].parentElement).toHaveTextContent('body for levelup:h1:difficulty');
    expect(headings[2].parentElement).toHaveTextContent('body for encourage:2026-09-28');
  });

  it('caps the list at six insights (spec R3)', () => {
    const insights = Array.from({ length: 8 }, (_, i) =>
      mk(`struggle:h${i}`, 'frequency', 'struggle', { habitId: `h${i}` }));
    render(<CoachSection habits={[]} insights={insights} />);
    expect(screen.getAllByRole('button', { name: 'Dismiss suggestion' })).toHaveLength(6);
  });

  it("applies a row's patch through putHabit", async () => {
    const h = habit();
    await putHabit(h);
    render(<CoachSection habits={[h]} insights={[
      mk('struggle:h1', 'frequency', 'struggle', { patch: { frequency: [1] } }),
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(async () => {
      expect((await listHabits())[0].frequency).toEqual([1]);
    });
  });

  it('dismiss removes just that row and records its id', () => {
    render(<CoachSection habits={[]} insights={[
      mk('struggle:h1', 'frequency', 'struggle'),
      mk('levelup:h1:target', 'target', 'success'),
    ]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss suggestion' })[0]);
    expect(screen.queryByText('body for struggle:h1')).not.toBeInTheDocument();
    expect(screen.getByText('body for levelup:h1:target')).toBeInTheDocument();
    expect(Object.keys(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!)))
      .toEqual(['struggle:h1']);
  });

  it('hides the whole section when every insight is dismissed', () => {
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({ 'struggle:h1': Date.now() }));
    const { container } = render(<CoachSection habits={[]} insights={[
      mk('struggle:h1', 'frequency', 'struggle'),
    ]} />);
    expect(container.textContent).toBe('');
  });
});
