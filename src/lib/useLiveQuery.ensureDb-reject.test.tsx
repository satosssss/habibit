import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ensureDb() CAN reject (its internal catch does an unguarded
// `await import('fake-indexeddb')` in db.ts), so the hook's pre-subscribe
// chain must tolerate a rejection instead of leaking it.
vi.mock('./db', () => ({
  ensureDb: vi.fn(),
}));

import { ensureDb } from './db';
import { useLiveQuery } from './useLiveQuery';

const rejections: unknown[] = [];
const onUnhandled = (reason: unknown) => { rejections.push(reason); };

beforeEach(() => {
  rejections.length = 0;
  process.on('unhandledRejection', onUnhandled);
  vi.mocked(ensureDb).mockReset();
  vi.mocked(ensureDb).mockRejectedValue(new Error('indexedDB unavailable'));
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
  vi.restoreAllMocks();
});

describe('useLiveQuery when ensureDb rejects', () => {
  it('logs the failure, subscribes anyway, and leaks no unhandled rejection', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLiveQuery(() => Promise.resolve('ok'), []));
    // Give the rejection time to surface as an unhandled rejection (pre-fix:
    // `void ensureDb().then(...)` has no reject handler, so it lands in
    // `rejections`) and as the hook's own logging (pre-fix: never called).
    await new Promise((r) => setTimeout(r, 100));

    expect(rejections).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith('[habibit] ensureDb failed', expect.any(Error));
    // Subscribe happens either way — the value still flows.
    await waitFor(() => expect(result.current).toBe('ok'));
  });

  it("surfaces the failure through liveQuery's error handler (as pre-fix)", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mirrors the repo queries: `await ensureDb()` before touching tables.
    const { result } = renderHook(() =>
      useLiveQuery(async () => { await ensureDb(); return 'ok'; }, [])
    );

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('[habibit] liveQuery error', expect.any(Error)),
    );
    expect(rejections).toEqual([]);
    expect(result.current).toBeUndefined(); // surfaced, not swallowed
  });
});
