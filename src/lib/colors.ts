import { stableIndex } from './hash';

/** Bright, saturated fills for habit rows — the screenshot palette. */
export const HABIT_COLORS = [
  '#c026d3', '#22d3ee', '#3b82f6', '#6366f1', '#22c55e',
  '#ef4444', '#f97316', '#f59e0b', '#14b8a6', '#ec4899',
];

/**
 * Deliberately subtle — intentions are groupings, not actions. No overlap with HABIT_COLORS.
 * (Brief listed #f97316/#14b8a6, which collide with the habit palette; swapped for their
 * muted 400-level siblings to keep the two scales distinct, as the spec requires.)
 */
export const INTENTION_PALETTE = [
  '#fb923c', '#eab308', '#2dd4bf', '#38bdf8',
  '#a3e635', '#fb7185', '#818cf8', '#94a3b8',
];

export function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid color: ${hex}`);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Stable, memorable color for an intention name — same name, same color, everywhere. */
export function intentionColor(name: string): string {
  return INTENTION_PALETTE[stableIndex(name.trim().toLowerCase(), INTENTION_PALETTE.length)];
}
