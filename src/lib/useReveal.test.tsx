import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReveal } from './useReveal';

function Probe({ className }: { className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} data-testid="probe" className={`reveal ${className ?? ''}`} />;
}

afterEach(() => vi.unstubAllGlobals());

describe('useReveal (slice D R9)', () => {
  it('reveals immediately when IntersectionObserver is unavailable (jsdom / older engines)', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').className).toContain('visible');
  });

  it('observes, reveals on intersect, and unobserves (spec threshold 0.12)', () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    type Entry = { isIntersecting: boolean; target: Element };
    let fire: ((entries: Entry[]) => void) | undefined;
    const MockIO = vi.fn((cb: (entries: Entry[]) => void) => {
      fire = cb;
      return { observe, unobserve, disconnect };
    });
    vi.stubGlobal('IntersectionObserver', MockIO);
    render(<Probe />);
    expect(MockIO).toHaveBeenCalledWith(expect.any(Function), { threshold: 0.12 });
    expect(observe).toHaveBeenCalledTimes(1);
    const probe = screen.getByTestId('probe');
    expect(probe.className).not.toContain('visible');
    fire!([{ isIntersecting: true, target: probe }]);
    expect(probe.className).toContain('visible');
    expect(unobserve).toHaveBeenCalledWith(probe);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('disconnects on unmount', () => {
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect })));
    const { unmount } = render(<Probe />);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
