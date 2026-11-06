import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));

import Page from './page';

describe('/ (accounts spec D2)', () => {
  it('redirects to /home', () => {
    expect(() => Page()).toThrow('NEXT_REDIRECT:/home');
  });
});
