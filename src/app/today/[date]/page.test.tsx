import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { todayKey } from '@/lib/dates';
import DayPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/today',
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('/today/[date]', () => {
  // React's `use()` resolves a thenable synchronously only once its tracked
  // status is 'fulfilled'; pre-mark it so redirect() throws out of the
  // synchronous render instead of suspending the root first.
  const paramsOf = (date: string) => {
    const p = Promise.resolve({ date }) as Promise<{ date: string }> & {
      status?: string;
      value?: { date: string };
    };
    p.status = 'fulfilled';
    p.value = { date };
    return p;
  };

  it('future date redirects to /today', () => {
    expect(() =>
      render(<DayPage params={paramsOf('2099-01-01')} />)
    ).toThrow(/NEXT_REDIRECT:\/today/);
  });

  it('redirects for a malformed date', () => {
    expect(() =>
      render(<DayPage params={paramsOf('not-a-date')} />)
    ).toThrow(/NEXT_REDIRECT:\/today/);
  });

  it('renders the note view for a past date', async () => {
    render(<DayPage params={paramsOf('2026-05-24')} />);
    expect(await screen.findByText(/May 24/)).toBeInTheDocument();
  });

  it("renders the Today screen for today's own date", async () => {
    render(<DayPage params={paramsOf(todayKey())} />);
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });
});
