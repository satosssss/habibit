import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listHabits, newId, putHabit } from './repo';
import type { Habit } from './types';
import { useLiveQuery } from './useLiveQuery';

const habit = (name: string): Habit => ({
  id: newId(), name, icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: Date.now(),
});

beforeEach(async () => { await clearAll(); });

describe('useLiveQuery', () => {
  it('resolves the query value', async () => {
    await putHabit(habit('Meditate'));
    const { result } = renderHook(() => useLiveQuery(() => listHabits(), []));
    await waitFor(() => expect(result.current).toHaveLength(1));
  });

  it('re-emits when the underlying data changes', async () => {
    await putHabit(habit('Meditate'));
    const { result } = renderHook(() => useLiveQuery(() => listHabits(), []));
    await waitFor(() => expect(result.current).toHaveLength(1));
    await putHabit(habit('Read'));
    await waitFor(() => expect(result.current).toHaveLength(2));
  });

  it('starts undefined so callers can render a loading state', async () => {
    const { result } = renderHook(() => useLiveQuery(() => listHabits(), []));
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toEqual([]));
  });
});
