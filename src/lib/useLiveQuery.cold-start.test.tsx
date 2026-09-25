import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { listHabits, newId, putHabit } from './repo';
import type { Habit } from './types';
import { useLiveQuery } from './useLiveQuery';

// Deliberately no beforeEach(clearAll()): a fresh file gets a fresh module
// registry and a fresh fake-indexeddb, so the first write races the pending
// IndexedDB open — the cold-start timing real page loads see.
const habitNamed = (name: string): Habit => ({
  id: newId(), name, icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: Date.now(),
});

describe('useLiveQuery cold start (pending IndexedDB open)', () => {
  it('stays subscribed when the first write races the open', async () => {
    const { result } = renderHook(() => useLiveQuery(() => listHabits(), []));
    await putHabit(habitNamed('Meditate'));   // write while the open is still pending
    // Under this timing the querier's initial read lands AFTER the write, so the
    // first emission already contains 'Meditate' — pin it before writing again.
    await waitFor(() => expect(result.current?.some((h) => h.name === 'Meditate')).toBe(true));
    await putHabit(habitNamed('Read'));       // requires a REGISTERED subscription
    await waitFor(
      () => expect(result.current?.some((h) => h.name === 'Read')).toBe(true),
      { timeout: 1200 },                      // pre-fix: times out (DEAF)
    );
  });
});
