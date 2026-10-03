import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

describe('/ (slice E R2)', () => {
  it('renders Home inside the nav shell', async () => {
    const { container } = render(<Page />);
    expect(container.querySelectorAll('.bg-scene')).toHaveLength(1);
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });
});
