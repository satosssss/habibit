import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// Vitest runs with css:false, so the Next.js CSS import never reaches jsdom;
// inject the real stylesheet and assert against it. Resolved via
// fileURLToPath + path.join because Vite rewrites `new URL(rel,
// import.meta.url)` into a non-file asset URL in this environment.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'globals.css'), 'utf8');
let style: HTMLStyleElement;

beforeAll(() => {
  style = document.createElement('style');
  style.dataset.from = 'globals';
  style.textContent = css;
  document.head.appendChild(style);
});

afterAll(() => style.remove());
afterEach(() => { delete document.documentElement.dataset.theme; });

describe('globals.css color-scheme (Task 14 review issue 4)', () => {
  it('switches color-scheme with the theme so native controls follow along', () => {
    document.documentElement.dataset.theme = 'dark';
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');
    document.documentElement.dataset.theme = 'light';
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('light');
  });

  it('defaults to a light color-scheme before any theme is applied', () => {
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('light');
  });
});
