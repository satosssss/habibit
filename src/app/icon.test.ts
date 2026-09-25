import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Next auto-injects <link rel="icon"> for app/icon.svg; without the file the
// browser's /favicon.ico request 404s on every page.
const iconPath = join(dirname(fileURLToPath(import.meta.url)), 'icon.svg');

describe('app icon', () => {
  it('ships a self-contained 32x32 flame mark at src/app/icon.svg', () => {
    expect(existsSync(iconPath)).toBe(true);
    const svg = readFileSync(iconPath, 'utf8');
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('#f97316'); // the Habibit flame orange
    // Nothing that could 404: no embedded images, hrefs or external refs.
    expect(svg).not.toMatch(/<image|xlink:href|href=|@import|url\(/);
  });
});
