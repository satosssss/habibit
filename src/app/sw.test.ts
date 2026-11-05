import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The worker is a plain public/ file (not bundled), so these are text pins: the
// behaviour that matters is which requests it refuses to touch.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const swPath = join(root, 'public', 'sw.js');

describe('service worker (account spec R8)', () => {
  it('exists and is versioned', () => {
    expect(existsSync(swPath)).toBe(true);
    expect(readFileSync(swPath, 'utf8')).toContain("const VERSION = 'habibit-v1'");
  });

  it('never caches API traffic', () => {
    const sw = readFileSync(swPath, 'utf8');
    expect(sw).toContain("url.pathname.startsWith('/api/')");
  });

  it('serves navigations network-first with /home as the offline fallback', () => {
    const sw = readFileSync(swPath, 'utf8');
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain('networkFirst');
    expect(sw).toContain("cache.match('/home')");
  });

  it('caches static assets first and drops old versions on activate', () => {
    const sw = readFileSync(swPath, 'utf8');
    expect(sw).toContain('cacheFirst');
    expect(sw).toContain('caches.delete');
    expect(sw).toContain('skipWaiting');
  });

  it('has a real icon behind every manifest entry', () => {
    for (const icon of ['icon-192.png', 'icon-512.png', 'maskable-512.png']) {
      expect(existsSync(join(root, 'public', 'icons', icon))).toBe(true);
    }
  });
});
