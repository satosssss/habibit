import { describe, expect, it } from 'vitest';
import { QUOTES, quoteFor } from './quotes';

describe('quoteFor', () => {
  it('is deterministic for a given date', () => {
    expect(quoteFor('2026-05-24')).toEqual(quoteFor('2026-05-24'));
  });

  it('stays within the bundled array', () => {
    for (let i = 0; i < 40; i++) {
      const q = quoteFor(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`);
      expect(QUOTES).toContainEqual(q);
    }
  });

  it('does not repeat the same quote two days running', () => {
    expect(quoteFor('2026-05-24').text).not.toBe(quoteFor('2026-05-25').text);
  });
});
