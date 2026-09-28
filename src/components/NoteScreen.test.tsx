import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, newId, putEntry, putHabit } from '@/lib/repo';
import { weekColumn } from '@/lib/dates';
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

  it("shows the viewed date's own cell in the compact heatmap", async () => {
    // The compact window is the viewed date's year: a May date must appear even
    // though the system clock (and thus any current-year rolling window) sits
    // months later.
    await putHabit(habit());
    render(<NoteScreen date="2026-05-24" />);
    await screen.findByText('DO HARD THINGS');
    const cell = screen.getByTestId('hm-cell-2026-05-24');
    expect(cell).toBeInTheDocument();
    expect(cell.tagName).toBe('BUTTON'); // an in-year, in-window cell — not an inert spacer
  });

  it("scrolls the compact heatmap to the viewed date's column, not today's", async () => {
    // Regression guard for the R3 effect: the note view's scroller must show
    // the day it exists to show (spec §5 is silent here; the screen's own
    // contract is "its own cell always in-window").
    await putHabit(habit());
    const scrollTo = vi.fn();
    const saved = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo');
    const widthSpy = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100);
    Object.defineProperty(Element.prototype, 'scrollTo', { value: scrollTo, configurable: true, writable: true });
    try {
      render(<NoteScreen date="2026-08-10" />);
      await screen.findByText('DO HARD THINGS');
      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
      // COMPACT_CELL 10 + GAP 3, clientWidth 100 (jsdom has no layout).
      expect(scrollTo).toHaveBeenCalledWith({
        left: Math.max(0, weekColumn('2026-08-10', 2026) * (10 + 3) + 10 - 100),
        behavior: 'smooth',
      });
    } finally {
      widthSpy.mockRestore();
      if (saved) Object.defineProperty(Element.prototype, 'scrollTo', saved);
      else delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });

  it('shows Loading… on first paint, not an empty checklist (R3)', () => {
    render(<NoteScreen date="2026-05-24" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('says nothing is scheduled when the day has no habits (R3)', async () => {
    render(<NoteScreen date="2026-05-24" />);
    expect(await screen.findByText('Nothing scheduled this day.')).toBeInTheDocument();
  });

  describe('share status (R3.4)', () => {
    const setClipboard = (value: unknown) =>
      Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
    afterEach(() => { setClipboard(undefined); vi.restoreAllMocks(); });

    it('reports a copied link', async () => {
      setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
      render(<NoteScreen date="2026-05-24" />);
      fireEvent.click(await screen.findByRole('button', { name: /share this day/i }));
      expect(await screen.findByText('Link copied')).toBeInTheDocument();
    });

    it('reports failure when the clipboard write rejects', async () => {
      setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
      render(<NoteScreen date="2026-05-24" />);
      fireEvent.click(await screen.findByRole('button', { name: /share this day/i }));
      expect(await screen.findByText("Couldn't copy the link")).toBeInTheDocument();
    });

    it('reports failure when no clipboard exists at all', async () => {
      setClipboard(undefined);
      render(<NoteScreen date="2026-05-24" />);
      fireEvent.click(await screen.findByRole('button', { name: /share this day/i }));
      expect(await screen.findByText("Couldn't copy the link")).toBeInTheDocument();
    });
  });
});
