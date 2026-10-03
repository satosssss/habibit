import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavShell } from './NavShell';

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn(() => '/') }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const fab = () => document.querySelector('a[aria-label="Add a habit"][href="/add-habit"]');

describe('NavShell (slice E R1)', () => {
  beforeEach(() => pathname.mockReturnValue('/'));

  it('renders all five destinations in both nav variants', () => {
    render(<NavShell><main>content</main></NavShell>);
    for (const [name, href] of [
      ['Home', '/'], ['Habits', '/habits'], ['Calendar', '/calendar'],
      ['Insights', '/insights'], ['Settings', '/settings'],
    ] as const) {
      const links = screen.getAllByRole('link', { name });
      expect(links).toHaveLength(2);                    // sidebar + bottom bar
      for (const l of links) expect(l).toHaveAttribute('href', href);
    }
  });

  it('offers Add habit from the desktop sidebar (not as a tab)', () => {
    render(<NavShell><main>c</main></NavShell>);
    const adds = screen.getAllByRole('link', { name: 'Add habit' });  // FAB says "Add a habit"
    expect(adds).toHaveLength(1);
    expect(adds[0]).toHaveAttribute('href', '/add-habit');
  });

  it('lights Home on /', () => {
    render(<NavShell><main>c</main></NavShell>);
    for (const l of screen.getAllByRole('link', { name: 'Home' }))
      expect(l).toHaveAttribute('aria-current', 'page');
    for (const l of screen.getAllByRole('link', { name: 'Insights' }))
      expect(l).not.toHaveAttribute('aria-current');
  });

  it('keeps Home lit on /today/<date> (date view is Home, spec R1)', () => {
    pathname.mockReturnValue('/today/2026-10-03');
    render(<NavShell><main>c</main></NavShell>);
    for (const l of screen.getAllByRole('link', { name: 'Home' }))
      expect(l).toHaveAttribute('aria-current', 'page');
  });

  it('lights Habits on /habits', () => {
    pathname.mockReturnValue('/habits');
    render(<NavShell><main>c</main></NavShell>);
    for (const l of screen.getAllByRole('link', { name: 'Habits' }))
      expect(l).toHaveAttribute('aria-current', 'page');
  });

  it('lights no tab on /add-habit', () => {
    pathname.mockReturnValue('/add-habit');
    render(<NavShell><main>c</main></NavShell>);
    expect(screen.queryAllByRole('link', { name: /home|habits|calendar|insights|settings/i })
      .filter((l) => l.getAttribute('aria-current') === 'page')).toHaveLength(0);
  });

  it('shows the FAB on Home, date views, and Habits only', () => {
    for (const p of ['/', '/today/2026-10-03', '/habits']) {
      pathname.mockReturnValue(p);
      const { unmount } = render(<NavShell><main>c</main></NavShell>);
      expect(fab()).not.toBeNull();
      unmount();
    }
    for (const p of ['/calendar', '/insights', '/settings', '/add-habit']) {
      pathname.mockReturnValue(p);
      const { unmount } = render(<NavShell><main>c</main></NavShell>);
      expect(fab()).toBeNull();
      unmount();
    }
  });

  it('reserves bottom room for the FAB (spec V6: never covers the last row)', () => {
    pathname.mockReturnValue('/');
    const a = render(<NavShell><main>c</main></NavShell>);
    expect(a.container.querySelector('main')!.parentElement!.className).toContain('pb-40');
    a.unmount();
    pathname.mockReturnValue('/calendar');
    const b = render(<NavShell><main>c</main></NavShell>);
    expect(b.container.querySelector('main')!.parentElement!.className).toContain('pb-24');
  });

  // ——— slice D pins, carried forward (labels updated to Home) ———
  it('mounts the background scene exactly once behind the content (slice D R3)', () => {
    const { container } = render(<NavShell><main>content</main></NavShell>);
    expect(container.querySelectorAll('.bg-scene')).toHaveLength(1);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders its children', () => {
    render(<NavShell><main>content</main></NavShell>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('frosts both nav variants and drops the opaque canvas (slice D R5)', () => {
    const { container } = render(<NavShell><main>c</main></NavShell>);
    const navs = container.querySelectorAll('nav[aria-label="Primary"]');
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(nav.className).toContain('glass-nav');
      expect(nav.className).not.toContain('bg-[var(--color-bg)]');
    }
    expect(navs[0].className).toContain('border-r');
    expect(navs[1].className).toContain('border-t');
  });

  it('prints active tabs with the on-accent/ink tokens (slice D R1 contrast)', () => {
    render(<NavShell><main>c</main></NavShell>);
    const home = screen.getAllByRole('link', { name: 'Home' });   // [0] sidebar, [1] bottom bar
    expect(home[0].className).toContain('bg-[var(--color-accent)]');
    expect(home[0].className).toContain('text-[var(--color-on-accent)]');
    expect(home[1].className).toContain('text-[var(--color-accent-ink)]');
    expect(home[1].className).not.toContain('text-[var(--color-accent)]');
  });
});
