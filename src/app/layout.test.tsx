import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from './layout';

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
