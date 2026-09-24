import { describe, expect, it } from 'vitest';
import { HABIT_COLORS, intentionColor, INTENTION_PALETTE, rgba } from './colors';

describe('rgba', () => {
  it('converts hex to rgba', () => {
    expect(rgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(rgba('#6366f1', 1)).toBe('rgba(99, 102, 241, 1)');
  });

  it('supports 3-digit hex', () => {
    expect(rgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)');
  });

  it('throws on unusable input rather than rendering transparent', () => {
    expect(() => rgba('not-a-color', 1)).toThrow();
  });
});

describe('intentionColor', () => {
  it('is stable for the same intention name', () => {
    expect(intentionColor('Study')).toBe(intentionColor('Study'));
  });

  it('always lands in the subtle palette', () => {
    for (const name of ['Study', 'Fix Bed', 'Take a Bath', 'Do Hard Things', 'z']) {
      expect(INTENTION_PALETTE).toContain(intentionColor(name));
    }
  });

  it('spreads different names across the palette', () => {
    const picked = new Set(['Study', 'Avoid Traps', 'Be Grateful', 'Help Others'].map(intentionColor));
    expect(picked.size).toBeGreaterThan(1);
  });

  it('keeps habit palette distinct from intention palette', () => {
    const overlap = HABIT_COLORS.filter((c) => INTENTION_PALETTE.includes(c));
    expect(overlap).toEqual([]);
  });
});
