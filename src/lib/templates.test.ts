import { describe, expect, it } from 'vitest';
import { TEMPLATE_GROUPS } from './templates';
import { ICONS } from './icons';
import { HABIT_COLORS } from './colors';

describe('template catalog (slice E R7)', () => {
  it('exposes exactly the four groups in spec order', () => {
    expect(TEMPLATE_GROUPS.map((g) => g.key)).toEqual(['good', 'health', 'bad', 'todo']);
    expect(TEMPLATE_GROUPS.map((g) => g.label)).toEqual(['Good', 'Health', 'Bad', 'To-do']);
  });

  it('every template satisfies the shape rules (spec §9)', () => {
    for (const g of TEMPLATE_GROUPS) {
      expect(g.habits.length).toBeGreaterThanOrEqual(5);
      const names = g.habits.map((h) => h.name);
      expect(new Set(names).size).toBe(names.length);        // unique within group
      for (const h of g.habits) {
        expect(h.name).toBe(h.name.trim());
        expect(h.name.length).toBeGreaterThan(0);
        expect(ICONS).toHaveProperty(h.icon);                 // real ICONS key
        expect(HABIT_COLORS).toContain(h.color);
        expect(h.category).toBe(g.label);
        expect(h.intention.trim().length).toBeGreaterThan(0);
        if (h.type === 'boolean') { expect(h.target).toBe(1); expect(h.unit).toBe(''); }
        if (h.type === 'quantity') {
          expect(h.target).toBeGreaterThanOrEqual(1);
          expect(h.unit.trim().length).toBeGreaterThan(0);
        }
        if (h.type === 'timer') expect(h.target).toBeGreaterThanOrEqual(60); // seconds
      }
    }
  });

  it('pins the catalog contents (spec §9 tables)', () => {
    const names = Object.fromEntries(
      TEMPLATE_GROUPS.map((g) => [g.label, g.habits.map((h) => h.name)]),
    );
    expect(names.Good).toEqual([
      'Meditate', 'Reading', 'Journal', 'Gratitude', 'Deep Work', 'Wake Early', 'Practice Language',
    ]);
    expect(names.Health).toEqual([
      'Steps', 'Run', 'Cycle', 'Swim', 'Stretch', 'Workout', 'Sleep',
    ]);
    expect(names['Bad']).toEqual([
      'No Junk Food', 'No Smoking', 'No Soda', 'No Late-Night Scrolling',
      'No Impulse Buying', 'No Oversleeping',
    ]);
    expect(names['To-do']).toEqual([
      'Plan Tomorrow', 'Review Goals', 'Inbox Zero', 'Prep Meals', 'Tidy Up', 'Weekly Review',
    ]);
    const steps = TEMPLATE_GROUPS.find((g) => g.label === 'Health')!.habits
      .find((h) => h.name === 'Steps')!;
    expect(steps).toMatchObject({
      type: 'quantity', target: 10000, unit: 'steps', icon: 'workout',
      color: '#22c55e', intention: 'Health', category: 'Health',
    });
  });

  it('Bad templates are all abstinence booleans (Q4-A)', () => {
    const bad = TEMPLATE_GROUPS.find((g) => g.key === 'bad')!;
    for (const h of bad.habits) {
      expect(h.type).toBe('boolean');
      expect(h.name).toMatch(/^No /);
    }
  });
});
