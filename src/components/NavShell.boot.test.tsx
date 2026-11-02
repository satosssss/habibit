import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavShell } from './NavShell';

// The boot chain is the one place ordering is load-bearing: a fresh install
// only earns badges if the seed lands before evaluation runs (badges spec R4).
// Both stores are stubbed so the test pins ordering rather than timing.
const boot = vi.hoisted(() => ({
  order: [] as string[],
  releaseSeed: null as null | (() => void),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('@/lib/seed', () => ({
  seedIfEmpty: () =>
    new Promise<boolean>((resolve) => {
      boot.releaseSeed = () => resolve(true);
    }),
}));
vi.mock('@/lib/repo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repo')>();
  return {
    ...actual,
    evaluateChallenges: async () => {
      boot.order.push('challenges');
      return [];
    },
    evaluateBadges: async () => {
      boot.order.push('badges');
      return [];
    },
  };
});

describe('NavShell boot pass (badges spec R4)', () => {
  it('waits for the seed, then evaluates challenges before badges', async () => {
    render(<NavShell><main>c</main></NavShell>);
    await waitFor(() => expect(boot.releaseSeed).not.toBeNull());

    // Seed still in flight: evaluation must not have started.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(boot.order).toEqual([]);

    await act(async () => boot.releaseSeed!());
    await waitFor(() => expect(boot.order).toEqual(['challenges', 'badges']));
  });
});
