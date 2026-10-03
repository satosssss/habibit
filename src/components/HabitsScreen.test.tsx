import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/lib/repo';
import { HabitsScreen } from './HabitsScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/habits',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

beforeEach(async () => { await clearAll(); });

describe('HabitsScreen (slice E R3)', () => {
  it('renders the Habits heading with the management panel', async () => {
    render(<HabitsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Habits' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Habits' })).toBeInTheDocument();
  });

  it('routes New habit through the client router to /add-habit', async () => {
    render(<HabitsScreen />);
    const link = await screen.findByRole('link', { name: /new habit/i });
    expect(link).toHaveAttribute('href', '/add-habit');
    expect(link).toHaveAttribute('data-next-link');        // next/link, not a bare <a>
    expect(link.className).toContain('text-[var(--color-on-accent)]');   // A2 color pin kept
    expect(link.className).not.toContain('text-white');
  });

  it('routes the empty state to /add-habit', async () => {
    render(<HabitsScreen />);
    const cta = await screen.findByRole('link', { name: /no habits yet/i });
    expect(cta).toHaveAttribute('href', '/add-habit');
    expect(cta).toHaveAttribute('data-next-link');
  });
});
