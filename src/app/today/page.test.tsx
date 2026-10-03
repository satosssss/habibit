import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
import TodayPage from './page';

describe('/today', () => {
  it('redirects to / (slice E R2)', () => {
    expect(() => TodayPage()).toThrow('NEXT_REDIRECT:/');
  });
});
