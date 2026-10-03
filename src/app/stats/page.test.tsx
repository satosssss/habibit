import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
import StatsPage from './page';

describe('/stats', () => {
  it('redirects to /insights (slice E R6)', () => {
    expect(() => StatsPage()).toThrow('NEXT_REDIRECT:/insights');
  });
});
