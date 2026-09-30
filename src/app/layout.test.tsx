import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from './layout';

// next/font/local is rewritten by Next's build pipeline; vitest sees the raw
// module, so map it to inert values before layout.tsx is imported.
vi.mock('next/font/local', () => ({
  default: () => ({ className: '__mock_font', variable: '--font-mock', style: { fontFamily: 'serif' } }),
}));

// Server markup is exactly what the browser parses before first paint (Task 1's
// boot path); a client-side render can't nest <html>/<head> inside RTL's div.
const markup = renderToStaticMarkup(<RootLayout><main /></RootLayout>);

const cleanupTheme = () => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePref;
};

afterEach(cleanupTheme);

describe('theme boot script (spec §9, Task 14 review issue 5c)', () => {
  it('renders an inline script inside <head>, before first paint', () => {
    const head = markup.slice(markup.indexOf('<head'), markup.indexOf('</head>'));
    expect(head).toContain('<script');
    expect(head).toContain('habibit:theme');
    expect(head).toContain('dataset.theme');
    expect(head.indexOf('habibit:theme')).toBeLessThan(markup.indexOf('</head>'));
  });

  it('applies the persisted preference when the page re-loads', () => {
    const source = markup.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(source).toBeDefined();
    cleanupTheme();
    localStorage.setItem('habibit:theme', 'dark');
    try {
      new Function(source!)(); // what the browser does when it parses the page again
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(document.documentElement.dataset.themePref).toBe('dark');
    } finally {
      cleanupTheme();
    }
  });
});

describe('vendored fonts (slice D R2)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  it('ships the Outfit and DM Sans woff2 files locally', () => {
    expect(existsSync(join(here, 'fonts', 'outfit-variable.woff2'))).toBe(true);
    expect(existsSync(join(here, 'fonts', 'dm-sans-variable.woff2'))).toBe(true);
  });
  it('never references a font CDN in layout or globals', () => {
    const banned = /fonts\.googleapis|fonts\.gstatic/;
    expect(readFileSync(join(here, 'layout.tsx'), 'utf8')).not.toMatch(banned);
    expect(readFileSync(join(here, 'globals.css'), 'utf8')).not.toMatch(banned);
  });
});
