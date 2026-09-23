// src/components/NavShell.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavShell } from './NavShell';

vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('NavShell', () => {
  it('renders all three destinations in both nav variants', () => {
    render(<NavShell><main>content</main></NavShell>);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(
      expect.arrayContaining(['/today', '/stats', '/settings'])
    );
    // desktop sidebar + mobile bottom bar = two nodes per destination
    expect(screen.getAllByRole('link', { name: /today/i })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /stats/i })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /settings/i })).toHaveLength(2);
  });

  it('marks the active destination with aria-current', () => {
    render(<NavShell><main>content</main></NavShell>);
    const current = screen.getAllByRole('link', { name: /today/i });
    for (const link of current) expect(link).toHaveAttribute('aria-current', 'page');
    for (const link of screen.getAllByRole('link', { name: /stats/i }))
      expect(link).not.toHaveAttribute('aria-current');
  });

  it('renders its children', () => {
    render(<NavShell><main>content</main></NavShell>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
