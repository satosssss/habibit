import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { quoteFor } from '@/lib/quotes';
import { NoteScreen } from './NoteScreen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Do Hard Things', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

beforeEach(async () => { await clearAll(); });

describe('NoteScreen', () => {
  it('titles itself with the long date and shows a bundled quote', async () => {
    const { container } = render(<NoteScreen date="2026-05-24" />);
    expect(await screen.findByText(/May 24/)).toBeInTheDocument();
    const blockquote = container.querySelector('blockquote')!;
    expect(blockquote.textContent).toMatch(/^.+ — .+$/); // quote + attribution
    expect(blockquote.textContent).toBe(`“${quoteFor('2026-05-24').text}” — ${quoteFor('2026-05-24').author}`);
  });

  it('groups the day by intention, not by category', async () => {
    await putHabit(habit({ name: 'Meditate', category: 'Morning', intention: 'Do Hard Things' }));
    await putHabit(habit({ name: 'Read', category: 'Evening', intention: 'Be Grateful' }));
    render(<NoteScreen date="2026-05-24" />);
    expect(await screen.findByText('DO HARD THINGS')).toBeInTheDocument();
    expect(screen.getByText('BE GRATEFUL')).toBeInTheDocument();
    expect(screen.queryByText('MORNING')).not.toBeInTheDocument();
  });

  it('shows the checked state from stored entries', async () => {
    const h = habit({ name: 'Read', intention: 'Be Grateful' });
    await putHabit(h);
    await putEntry(h.id, '2026-05-24', 1);
    render(<NoteScreen date="2026-05-24" />);
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /read/i })).toBeChecked()
    );
  });

  it('renders a compact heatmap', async () => {
    await putHabit(habit());
    const { container } = render(<NoteScreen date="2026-05-24" />);
    await screen.findByText('DO HARD THINGS');
    expect(container.querySelector('[data-testid^="hm-cell-"]')).not.toBeNull();
  });
});
