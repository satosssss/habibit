import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Spec R10 / V5: every enabled control keeps a ≥40px tap target. jsdom has no
// layout, so the size classes are pinned at their source — the same
// source-text style globals.test uses for the raw stylesheet. Two h-8 holds
// remain by design: the DateStrip *future* cell (disabled, exempt from target
// size) and HabitList's color swatch (a non-interactive <span>).
const here = dirname(fileURLToPath(import.meta.url));
const src = (file: string) => readFileSync(join(here, file), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('tap targets ≥40px (spec R10, V5)', () => {
  it('HomeScreen header controls are h-10', () => {
    const s = src('HomeScreen.tsx');
    expect(s).toMatch(/aria-label="Open menu"[\s\S]{0,220}h-10 w-10/);
    expect(s).toMatch(/aria-label="Add habit"[\s\S]{0,220}h-10 w-10/);
  });

  it('CategorySection collapse control is h-10', () => {
    expect(src('CategorySection.tsx')).toContain(
      'grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--color-accent-ink)]',
    );
  });

  it('HabitRow steppers match at h-10', () => {
    const s = src('HabitRow.tsx');
    // minus + plus are the same class — the pair must stay symmetric; the
    // boolean check button shares the glass-pill class and is h-10 too
    expect(count(s, 'grid h-10 w-10 shrink-0 place-items-center rounded-full glass-pill')).toBe(3);
    expect(s).not.toContain('grid h-8 w-8 shrink-0 place-items-center rounded-full glass-pill');
  });

  it('DateStrip: selected h-11, enabled past h-10, disabled future exempt at h-8', () => {
    const s = src('DateStrip.tsx');
    expect(s).toContain("'h-11 w-11 bg-[var(--color-accent)]");
    expect(s).toContain("'h-10 w-10 bg-[var(--color-accent)]");
    expect(s).toContain("'h-8 w-8 text-[var(--color-subtle)]");
    expect(s).not.toContain("'h-8 w-8 bg-"); // no enabled accent cell under 40px
  });

  it('HabitForm pickers are h-10', () => {
    const s = src('HabitForm.tsx');
    expect(s).toContain('grid h-10 w-10 place-items-center rounded-xl border');
    expect(s).toContain('h-10 w-10 rounded-full border-2');
  });

  it('NoteScreen share control is h-10', () => {
    expect(src('NoteScreen.tsx')).toContain('grid h-10 w-10 place-items-center rounded-full bg-[var(--color-muted)]');
  });

  it('YearNav arrows are both h-10', () => {
    expect(count(src('YearNav.tsx'), 'grid h-10 w-10 place-items-center rounded-full disabled:opacity-30')).toBe(2);
  });

  it('HabitList row actions are all h-10', () => {
    // move up / move down / edit / delete — the non-interactive swatch span stays h-8
    const s = src('HabitList.tsx');
    expect(count(s, 'grid h-10 w-10 shrink-0 place-items-center rounded-full')).toBe(4);
    // 375px row space: tighter gap so the 40px buttons never flex-squeeze (was 38px wide)
    expect(s).toContain('gap-2 glass-row px-3');
  });

  it('Settings button rows are ≥40px tall', () => {
    // New habit was py-1.5 (32px); both theme segments were py-2 (36px)
    expect(src('HabitsPanel.tsx')).toContain('px-3 py-2.5 text-sm font-semibold text-[var(--color-on-accent)]');
    expect(src('ThemePanel.tsx')).toContain('rounded-xl px-4 py-2.5 text-sm font-semibold capitalize');
    expect(src('MenuDrawer.tsx')).toContain('rounded-xl px-4 py-2.5 text-sm font-semibold capitalize');
  });

  it('Data confirm-dialog buttons are py-2.5 (reset-to-empty V6: ≥40px)', () => {
    // Cancel / Yes, erase were py-1.5 = 34px in the browser; py-2.5 = 42px.
    const s = src('DataPanel.tsx');
    expect(s).toContain('btn-glass px-3 py-2.5 text-sm');
    expect(s).toContain('rounded-xl bg-red-600 px-3 py-2.5 font-semibold text-white');
  });

  it('calendar day cells are h-11 w-11 (slice E R5: ≥44px)', () => {
    const s = src('CalendarScreen.tsx');
    expect(s).toContain('h-11 w-11');
  });

  it('the mobile FAB is a 56px circle (slice E R1: ≥44px)', () => {
    const s = src('NavShell.tsx');
    expect(s).toMatch(/aria-label="Add a habit"[\s\S]{0,340}h-14 w-14/);
  });

  it('coach rows keep py-2.5 and ≥40px controls (coach spec R3)', () => {
    // CoachRow is defined in CoachSection.tsx and shared by both surfaces.
    const s = src('CoachSection.tsx');
    expect(s).toContain('py-2.5');
    expect(s).toContain('btn-primary mt-2 h-10 px-4 text-sm');   // Apply = 40px
    expect(s).toMatch(/aria-label="Dismiss suggestion"[\s\S]{0,240}h-10 w-10/);
  });
});
