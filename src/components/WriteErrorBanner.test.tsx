import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WriteErrorBanner } from './WriteErrorBanner';
import { reportWriteError, dismissWriteError } from '@/lib/writeError';

vi.mock('@/lib/seed', () => ({ seedIfEmpty: vi.fn(() => Promise.reject(new Error('seed failed'))) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

afterEach(() => {
  dismissWriteError();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WriteErrorBanner (spec R3.3)', () => {
  it('is absent until a write fails', () => {
    render(<WriteErrorBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces the exact failure copy and dismisses', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<WriteErrorBanner />);
    act(() => { reportWriteError(new Error('quota exceeded')); });
    expect(screen.getByRole('alert'))
      .toHaveTextContent("Couldn't save that change — your browser storage may be full.");
    expect(spy).toHaveBeenCalledWith('[habibit] write failed', expect.any(Error));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('auto-dismisses after 8 seconds; a fresh failure restarts the window', () => {
    vi.useFakeTimers();
    render(<WriteErrorBanner />);
    act(() => { reportWriteError(); });
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => { reportWriteError(); });               // restarts
    act(() => { vi.advanceTimersByTime(7000); });
    expect(screen.getByRole('alert')).toBeInTheDocument();   // 14s total, 7s since second
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders inside NavShell when the boot seed write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { NavShell } = await import('./NavShell');
    render(<NavShell><main>content</main></NavShell>);
    expect(await screen.findByTestId('write-error'))
      .toHaveTextContent(/couldn't save that change/i);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('frosts the banner and signals the warning with an icon, not a red fill (slice D R5)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<WriteErrorBanner />);
    act(() => { reportWriteError(new Error('quota exceeded')); });
    const banner = screen.getByTestId('write-error');
    expect(banner.className).toContain('glass-card');
    expect(banner.className).not.toContain('bg-red-50');
    expect(banner.querySelector('svg.lucide-triangle-alert')).toBeInTheDocument();
  });
});
