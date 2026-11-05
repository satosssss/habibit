import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
import TodayPage from './page';

describe('/today', () => {
  it('redirects to /home (slice E R2, accounts D2)', () => {
    expect(() => TodayPage()).toThrow('NEXT_REDIRECT:/home');
  });
});
