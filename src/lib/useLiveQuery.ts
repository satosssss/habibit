'use client';

import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState, type DependencyList } from 'react';
import { ensureDb } from './db';

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
    let sub: { unsubscribe: () => void } | undefined;
    // Dexie registers liveQuery observability (PSD.subscr) at dbcore-request
    // time; if the querier's `await ensureDb()` is still pending when we
    // subscribe, the zone-echo window closes before the request runs and the
    // subscription never receives storagemutated notifications (fresh page
    // loads show an empty app). Subscribing after ensureDb() resolves keeps
    // that await inside the window.
    void ensureDb().then(() => {
      if (!alive) return;
      sub = observable.subscribe({
        next: (v) => { if (alive) setValue(v); },
        error: (err) => console.error('[habibit] liveQuery error', err),
      });
    });
    return () => { alive = false; sub?.unsubscribe(); };
  }, [observable]);

  return value;
}
