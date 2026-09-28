import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// @testing-library picks its fake-timer code path by checking for a `jest`
// global alongside `setTimeout.clock` (vitest's sinon clock sets the latter).
// Without the alias, waitFor's macrotask drain uses the frozen fake clock and
// hangs under vi.useFakeTimers(); `vi` provides jest.advanceTimersByTime.
(globalThis as unknown as { jest?: typeof vi }).jest ??= vi;

// jsdom ships no matchMedia; the theme code depends on it.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// jsdom ships no Element.scrollTo; the heatmap's auto-scroll effect calls it.
// (Tests that assert on it override this per-test and restore it.)
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() { /* no-op in jsdom */ };
}
