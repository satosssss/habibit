'use client';

import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState, type DependencyList } from 'react';

/**
 * Subscribes to a Dexie liveQuery. `deps` must list every value the query
 * function closes over (e.g. `[date]` for a per-day query) — changing them
 * tears the subscription down and re-subscribes. There is deliberately no
 * effect that writes route/date state back into React.
 */
export function useLiveQuery<T>(fn: () => Promise<T>, deps: DependencyList): T | undefined {
  // Async wrapper: sync queriers can race Dexie's ambient zone state across
  // awaits (e.g. ensureDb()), so they may stop re-emitting — environment-
  // dependent. The async querier is Dexie's designed, guaranteed path.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const observable = useMemo(() => liveQuery(async () => fn()), deps);
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const sub = observable.subscribe({
      next: (v) => { if (alive) setValue(v); },
      error: (err) => console.error('[habibit] liveQuery error', err),
    });
    return () => { alive = false; sub.unsubscribe(); };
  }, [observable]);

  return value;
}
