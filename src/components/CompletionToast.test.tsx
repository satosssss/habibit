import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { celebrateIfCompleted, dismissCompletionToast } from '@/lib/completionToast';
import type { Habit } from '@/lib/types';
import { CompletionToast } from './CompletionToast';

vi.mock('@/lib/seed', () => ({ seedIfEmpty: vi.fn(() => Promise.resolve()) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const qty: Habit = {
  id: 'q1', name: 'Drink Water', icon: 'target', color: '#6366f1', category: 'Health',
  intention: 'Feel Better', type: 'quantity', target: 8, unit: 'cups',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
};

afterEach(() => { dismissCompletionToast(); vi.restoreAllMocks(); });

describe('CompletionToast (A2 R2)', () => {
  it('renders nothing until a habit completes', () => {
    render(<CompletionToast />);
    expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
  });

  it('announces the exact copy in a polite status region', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('data-testid', 'completion-toast');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent('Nice work — Drink Water is done!');
  });

  it('dismisses on tap', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    fireEvent.click(screen.getByRole('button', { name: /nice work/i }));
    expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
  });

  it('never blocks taps and sits above the sheet layer (A2)', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    const region = screen.getByTestId('completion-toast');
    expect(region.className).toContain('pointer-events-none');  // taps behind pass through
    expect(region.className).toContain('z-[60]');               // Sheet is z-50 (Sheet.tsx:92)
    expect(screen.getByRole('button', { name: /nice work/i }).className)
      .toContain('pointer-events-auto');
  });

  it('uses a motion-safe entrance animation (A2)', () => {
    render(<CompletionToast />);
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    expect(screen.getByRole('button', { name: /nice work/i }).className)
      .toContain('motion-safe:animate-[toast-in_200ms_ease-out]');
  });

  it('renders nothing during server prerender', () => {
    expect(renderToString(<CompletionToast />)).toBe('');
  });

  it('mounts in NavShell above the content', async () => {
    const { NavShell } = await import('./NavShell');
    render(<NavShell><main>content</main></NavShell>);
    expect(screen.queryByTestId('completion-toast')).not.toBeInTheDocument();
    act(() => { celebrateIfCompleted(qty, 0, 8); });
    expect(await screen.findByTestId('completion-toast')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
