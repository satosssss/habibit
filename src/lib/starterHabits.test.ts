import { describe, expect, it } from 'vitest';
import { MAX_STARTERS, STARTER_HABITS, starterFor, starterToHabit } from './starterHabits';

describe('starter habits (onboarding v2)', () => {
  it('ranks habits for the chosen goals first', () => {
    const list = starterFor(['Sleep better']);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].goals).toContain('Sleep better');
    expect(list.slice(0, 3).every((habit) => habit.goals.includes('Sleep better'))).toBe(true);
  });

  it('still offers options when no goal was picked', () => {
    expect(starterFor([])).toHaveLength(6);
  });

  it('never repeats a habit and keeps the cap', () => {
    const ids = starterFor(['Move more', 'Read more', 'Save money']).map((habit) => habit.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(6);
  });

  it('maps a starter onto a normal boolean habit', () => {
    const habit = starterToHabit(STARTER_HABITS[0], 0, 1_000);
    expect(habit.name).toBe(STARTER_HABITS[0].name);
    expect(habit.type).toBe('boolean');
    expect(habit.frequency).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(habit.difficulty).toBe('easy');
    expect(habit.createdAt).toBe(1_000);
  });

  it('caps the picker at three habits', () => {
    expect(MAX_STARTERS).toBe(3);
  });
});
