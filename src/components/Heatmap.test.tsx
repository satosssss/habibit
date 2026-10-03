import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { weekColumn } from '@/lib/dates';
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

  it('frosts the heatmap panel (slice D R8)', () => {
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />);
    const section = document.querySelector('section[aria-label="Activity heatmap"]')!;
    const panel = section.querySelector('.glass-card');
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain('p-4');
    expect(panel?.className).not.toContain('bg-[var(--color-panel)]');
  });

  // Slice D final-review finding #1: .glass-card's overflow:hidden clipped
  // the above-the-card tooltip to an ~8px sliver. The fix moves the frost to
  // an inner panel; the tooltip must stay inside the section (outside-click
  // unpin relies on section.contains) but outside the clipping box.
  it('renders the tooltip outside the clipped frost so it is not cut off', () => {
    render(<Heatmap year={2026} habits={[habit('a')]} entries={[entry('a', '2026-06-10')]} today="2026-06-15" />);
    fireEvent.mouseEnter(screen.getByTestId('hm-cell-2026-06-10'));
    const tip = screen.getByTestId('hm-tooltip');
    const section = document.querySelector('section[aria-label="Activity heatmap"]')!;
    expect(section.contains(tip)).toBe(true);
    expect(tip.closest('.glass-card')).toBeNull();
    expect(section.querySelector('.glass-card')).not.toBeNull();
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

  it('renders the whole passed year in compact mode (no window slicing)', () => {
    // Carry-forward: compact no longer slices to the last 26 weeks of the year
    // (that window started Jul 6 for 2026 and could omit the viewed date).
    const { container } = render(
      <Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" compact />
    );
    const cells = container.querySelectorAll('[data-testid^="hm-cell"]');
    expect(cells.length).toBe(53 * 7);
    expect(container.querySelector('[data-testid="hm-cell-2026-05-24"]')).not.toBeNull();
  });

  it('uses smaller cells in compact mode (spec §8)', () => {
    const full = render(
      <Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" />
    );
    const compact = render(
      <Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-12-31" compact />
    );
    const width = (root: HTMLElement) =>
      (root.querySelector('[data-testid="hm-cell-2026-06-10"]') as HTMLElement).style.width;
    expect(width(full.container)).toBe('13px');
    expect(width(compact.container)).toBe('10px');
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

  // /stats and the note view prerender, so a build-day `today` must not leak
  // into the server HTML (level-colored cells, today-clamped payloads). Cells
  // prerender neutral and take on today's styling only after mount.
  it('prerenders no today-derived cell output, then applies it after mount', () => {
    const props = {
      year: 2026, habits: [habit('a')],
      entries: [entry('a', '2026-06-10')], today: '2026-12-31',
    };
    const html = renderToString(<Heatmap {...props} />);
    // Scope to the cell grid: the legend legitimately swatches every level.
    const cellsHtml = html.slice(
      html.indexOf('grid-rows-7'), html.indexOf('data-testid="hm-legend"'),
    );
    expect(cellsHtml).toContain('hm-empty');   // the cells did render
    expect(cellsHtml).not.toMatch(/--hm-\d/);  // no today-derived level color
    expect(html).not.toContain(': 1 of 1 completed'); // today-clamped payload

    render(<Heatmap {...props} />);
    expect(screen.getByTestId('hm-cell-2026-06-10'))
      .toHaveAttribute('aria-label', '2026-06-10: 1 of 1 completed');
  });

  // Branch review #6: /stats is statically prerendered, so every date-derived
  // node needs the Task-8 suppressHydrationWarning pattern. jsdom cannot
  // observe the directive (it is a React render-time flag, not a DOM
  // attribute), so this pins it at source level.
  it('guards every date-derived heatmap node with suppressHydrationWarning', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, 'Heatmap.tsx'), 'utf8');
    // Both branches of cells.map: the in-year button (aria-label carries the
    // date) and the out-of-year padding div.
    const cells = src.slice(src.indexOf('cells.map((cell) =>'), src.indexOf('data-testid="hm-legend"'));
    expect(cells.match(/suppressHydrationWarning/g)).toHaveLength(2);
    // Month labels are year-derived text (week columns of the viewed year).
    const months = src.slice(src.indexOf('{months.map('), src.indexOf('{/* 7 weekday rows'));
    expect(months).toContain('suppressHydrationWarning');
    // The year label itself (InsightsScreen renders YearNav).
    expect(readFileSync(join(here, 'YearNav.tsx'), 'utf8')).toContain('suppressHydrationWarning');
  });

  it('shows an off-schedule completion with no percent line (spec §6)', () => {
    const weekdays: Habit = { ...habit('w'), frequency: [1, 2, 3, 4, 5] };
    render(<Heatmap year={2026} habits={[weekdays]} entries={[entry('w', '2026-06-13')]} today="2026-06-15" />);
    fireEvent.mouseEnter(screen.getByTestId('hm-cell-2026-06-13'));
    const tip = screen.getByTestId('hm-tooltip');
    expect(tip).toHaveTextContent('Jun 13, 2026');
    expect(tip).toHaveTextContent('1 completed (off schedule)');
    expect(tip).not.toHaveTextContent('%');
    // Flagged decision 1: the cell's screen-reader name mirrors the tooltip
    // instead of reading "0 of 0".
    expect(screen.getByTestId('hm-cell-2026-06-13'))
      .toHaveAttribute('aria-label', '2026-06-13: 1 completed (off schedule)');
  });

  // Spec §5 (R3): bring today's column into view — current year only,
  // post-mount only, instant under prefers-reduced-motion.
  describe('auto-scroll', () => {
    const scrollTo = vi.fn();
    let savedScrollTo: PropertyDescriptor | undefined;
    let savedMatchMedia: typeof window.matchMedia;
    let clientWidthSpy: ReturnType<typeof vi.spyOn> | undefined;

    beforeEach(() => {
      scrollTo.mockClear();
      savedScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo');
      savedMatchMedia = window.matchMedia;
      Object.defineProperty(Element.prototype, 'scrollTo',
        { value: scrollTo, configurable: true, writable: true });
      // jsdom has no layout: stub the container width (Element owns clientWidth).
      clientWidthSpy = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100);
    });

    afterEach(() => {
      clientWidthSpy?.mockRestore();
      window.matchMedia = savedMatchMedia;
      if (savedScrollTo) Object.defineProperty(Element.prototype, 'scrollTo', savedScrollTo);
      else delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
    });

    const expectedLeft = (today: string, year: number) =>
      Math.max(0, weekColumn(today, year) * (13 + 3) + 13 - 100); // CELL 13 + GAP 3, clientWidth 100

    it("scrolls today's column to the edge on mount (current year)", () => {
      render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ left: expectedLeft('2026-09-30', 2026), behavior: 'smooth' });
    });

    it("scrolls to focusDate's column when the view is pinned to a specific day", () => {
      // The note view shows a past day of the current year: its heatmap must
      // show THAT day, not today.
      render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-09-30" focusDate="2026-08-10" />);
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ left: expectedLeft('2026-08-10', 2026), behavior: 'smooth' });
    });

    it('sets scrollLeft directly under prefers-reduced-motion and never calls scrollTo', () => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes('reduce'), media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      })) as typeof window.matchMedia;
      render(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(screen.getByTestId('hm-scroll').scrollLeft).toBe(expectedLeft('2026-09-30', 2026));
    });

    it('never scrolls a past-year view (it opens at January)', () => {
      render(<Heatmap year={2025} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does not scroll during server render', () => {
      renderToString(<Heatmap year={2026} habits={[habit('a')]} entries={[]} today="2026-09-30" />);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls on mount, ignores data arrivals, and re-applies when returning to the current year', () => {
      const props = { year: 2026, habits: [habit('a')], entries: [] as Entry[], today: '2026-09-30' };
      const { rerender } = render(<Heatmap {...props} />);
      expect(scrollTo).toHaveBeenCalledTimes(1);

      rerender(<Heatmap {...props} entries={[entry('a', '2026-09-29')]} />);
      expect(scrollTo).toHaveBeenCalledTimes(1);   // data arrival must not re-scroll

      const el = screen.getByTestId('hm-scroll');
      el.scrollLeft = 0;                            // pretend the viewport sits at January
      rerender(<Heatmap {...props} year={2025} />);
      expect(scrollTo).toHaveBeenCalledTimes(1);    // past year: gated
      rerender(<Heatmap {...props} year={2026} />);
      expect(scrollTo).toHaveBeenCalledTimes(2);    // back to the current year: re-applies (spec §5)
    });
  });
});
