import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Entry, Habit } from '@/lib/types';
import { Heatmap } from './Heatmap';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const habit = (id: string): Habit => ({
  id, name: id, icon: 'flower2', color: '#c026d3', category: 'Morning', intention: 'Study',
  type: 'boolean', target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
});
const entry = (habitId: string, date: string, value = 1): Entry =>
  ({ id: `${habitId}_${date}`, habitId, date, value, timestamp: 0 });

describe('Heatmap', () => {
  it('renders the full year grid padded to whole weeks', () => {
    const { container } = render(
      <Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />
    );
    const cells = container.querySelectorAll('[data-testid^="hm-cell"]');
    expect(cells.length).toBe(53 * 7);
    expect(cells.length % 7).toBe(0);
  });

  it('shows month labels across the top', () => {
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    for (const month of ['Jan', 'Apr', 'Jul', 'Oct']) expect(screen.getByText(month)).toBeInTheDocument();
  });

  it('shows weekday labels and the intensity legend', () => {
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText(/less/i)).toBeInTheDocument();
    expect(screen.getByText(/more/i)).toBeInTheDocument();
    expect(screen.getByTestId('hm-legend').querySelectorAll('[data-level]')).toHaveLength(5);
  });

  it('shows date, count and percentage in the tooltip on hover', () => {
    render(
      <Heatmap year={2026} habits={[habit('a'), habit('b')]}
               entries={[entry('a', '2026-08-14'), entry('b', '2026-08-14')]}
               today="2026-12-31" />
    );
    fireEvent.mouseEnter(screen.getByTestId('hm-cell-2026-08-14'));
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('Aug 14, 2026');
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('2 of 2 completed');
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('100%');
  });

  it('navigates to the day on a second click, pinning the tooltip first on touch', () => {
    push.mockClear();
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    const cell = screen.getByTestId('hm-cell-2026-06-10');
    fireEvent.click(cell);                       // first tap: pin tooltip
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('Jun 10, 2026');
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(cell);                       // second tap: navigate
    expect(push).toHaveBeenCalledWith('/today/2026-06-10');
  });

  it('navigates immediately when the cell was already hovered', () => {
    push.mockClear();
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    const cell = screen.getByTestId('hm-cell-2026-06-10');
    fireEvent.mouseEnter(cell);
    fireEvent.click(cell);
    expect(push).toHaveBeenCalledWith('/today/2026-06-10');
  });

  it('dismisses the tooltip on Escape', () => {
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    fireEvent.click(screen.getByTestId('hm-cell-2026-06-10'));
    expect(screen.getByTestId('hm-tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('hm-tooltip')).not.toBeInTheDocument();
  });

  it('renders fewer columns in compact mode', () => {
    const { container } = render(
      <Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" compact />
    );
    const full = render(
      <Heatmap year={2025} habits={[habit('a')]} entries={[]} today="2026-12-31" />
    );
    expect(container.querySelectorAll('[data-testid^="hm-cell"]').length)
      .toBeLessThanOrEqual(full.container.querySelectorAll('[data-testid^="hm-cell"]').length);
  });

  it('does not count future-dated entries in tooltip numbers', () => {
    // Review Focus #5 / Task 5 review issue 1: a future-dated entry (imported
    // JSON) must not populate any cell's `completed of scheduled` payload.
    render(
      <Heatmap year={2026} habits={[habit('a')]}
               entries={[entry('a', '2026-05-20'), entry('a', '2026-12-25')]}
               today="2026-06-01" />
    );
    fireEvent.mouseOver(screen.getByTestId('hm-cell-2026-06-01'));
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('0 of 1 completed');
    fireEvent.mouseOver(screen.getByTestId('hm-cell-2026-05-20'));
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('1 of 1 completed');
    fireEvent.mouseOver(screen.getByTestId('hm-cell-2026-12-25'));
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('0 of 1 completed');
  });

  it('deep-links only past cells; today and future cells just pin', () => {
    push.mockClear();
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-06-10" />);
    const todayCell = screen.getByTestId('hm-cell-2026-06-10');
    fireEvent.click(todayCell);
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('Jun 10, 2026');
    fireEvent.click(todayCell);
    expect(push).not.toHaveBeenCalled();
    const futureCell = screen.getByTestId('hm-cell-2026-12-25');
    fireEvent.click(futureCell);
    fireEvent.click(futureCell);
    expect(push).not.toHaveBeenCalled();
  });

  it('dismisses the pinned tooltip when tapping outside', () => {
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    fireEvent.click(screen.getByTestId('hm-cell-2026-06-10'));
    expect(screen.getByTestId('hm-tooltip')).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByTestId('hm-tooltip')).not.toBeInTheDocument();
  });

  it('treats out-of-year padding cells as inert spacers (spec §7.4)', () => {
    push.mockClear();
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    // Weekday padding on both ends of the 2026 grid: Mon Dec 29 2025 and Fri–Sun Jan 2027.
    for (const key of ['2025-12-29', '2027-01-01']) {
      const cell = screen.getByTestId(`hm-cell-${key}`);
      fireEvent.mouseEnter(cell);
      expect(screen.queryByTestId('hm-tooltip')).toBeNull();
      fireEvent.click(cell);
      expect(screen.queryByTestId('hm-tooltip')).toBeNull();
      fireEvent.click(cell);
      expect(push).not.toHaveBeenCalled();
    }
  });

  it('gates hover behind pointer type: touch does not hover, tap pins', () => {
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    const cell = screen.getByTestId('hm-cell-2026-06-10');
    // jsdom 25 has no PointerEvent, so inject an Event carrying pointerType.
    const touch = new Event('pointerover', { bubbles: true, cancelable: true });
    Object.defineProperty(touch, 'pointerType', { value: 'touch', enumerable: true });
    fireEvent(cell, touch);
    fireEvent.mouseEnter(cell);
    expect(screen.queryByTestId('hm-tooltip')).toBeNull();
    fireEvent.click(cell);
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('Jun 10, 2026');
  });

  it("counts an entry dated exactly today in today's cell", () => {
    render(
      <Heatmap year={2026} habits={[habit('a')]}
               entries={[entry('a', '2026-12-31')]} today="2026-12-31" />
    );
    fireEvent.mouseEnter(screen.getByTestId('hm-cell-2026-12-31'));
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('1 of 1 completed');
    expect(screen.getByTestId('hm-tooltip')).toHaveTextContent('100%');
  });
});
