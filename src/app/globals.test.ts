import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stylesheetForJsdom } from '@/lib/testStylesheet';

// Vitest runs with css:false, so the Next.js CSS import never reaches jsdom;
// inject the real stylesheet and assert against it. Resolved via
// fileURLToPath + path.join because Vite rewrites `new URL(rel,
// import.meta.url)` into a non-file asset URL in this environment.
// `css` stays raw for source-text assertions; jsdom gets the layer-unwrapped
// copy (its CSSOM predates @layer and would reject the whole sheet).
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'globals.css'), 'utf8');
let style: HTMLStyleElement;

beforeAll(() => {
  style = document.createElement('style');
  style.dataset.from = 'globals';
  style.textContent = stylesheetForJsdom(css);
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

describe('slice D glass token system (spec R1)', () => {
  it('exposes the Ember & Slate palette on the dark theme', () => {
    document.documentElement.dataset.theme = 'dark';
    const cs = getComputedStyle(document.documentElement);
    expect(cs.getPropertyValue('--color-bg').trim()).toBe('#100d0a');
    expect(cs.getPropertyValue('--color-fg').trim()).toBe('rgba(255, 248, 240, 0.95)');
    expect(cs.getPropertyValue('--color-subtle').trim()).toBe('rgba(255, 235, 210, 0.60)');
    expect(cs.getPropertyValue('--color-accent').trim()).toBe('#f59e0b');
    expect(cs.getPropertyValue('--color-accent-ink').trim()).toBe('#f59e0b');
    expect(cs.getPropertyValue('--color-on-accent').trim()).toBe('#0f0e0c');
    expect(cs.getPropertyValue('--blob-1').trim()).toBe('#f59e0b');
    expect(cs.getPropertyValue('--hm-4').trim()).toBe('#f59e0b');
  });

  it('exposes the Liquid Glass palette on the light theme', () => {
    document.documentElement.dataset.theme = 'light';
    const cs = getComputedStyle(document.documentElement);
    expect(cs.getPropertyValue('--color-bg').trim()).toBe('#f0ebe3');
    expect(cs.getPropertyValue('--color-fg').trim()).toBe('rgba(20, 16, 12, 0.90)');
    expect(cs.getPropertyValue('--color-accent-ink').trim()).toBe('#b45309');
    expect(cs.getPropertyValue('--color-on-accent').trim()).toBe('#0f0e0c');
    expect(cs.getPropertyValue('--blob-1').trim()).toBe('#a78bfa');
    expect(cs.getPropertyValue('--hm-4').trim()).toBe('#d97706');
  });

  it('defaults to the light palette before any theme is applied', () => {
    expect(getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()).toBe('#f0ebe3');
  });
});

describe('slice D glass utilities, motion, and fallbacks (spec R4)', () => {
  it('defines every glass/motion class', () => {
    for (const cls of ['.glass-card', '.glass-row', '.glass-nav', '.glass-heavy', '.glass-menu',
      '.glass-input', '.btn-primary', '.btn-glass', '.glass-pill', '.skeleton', '.reveal',
      '.bg-scene', '.blob-1', '.font-display']) {
      expect(css).toContain(cls);
    }
  });

  it('ships all three accessibility fallbacks', () => {
    expect(css).toContain('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))');
    expect(css).toContain('prefers-reduced-transparency: reduce');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('keeps a visible :focus-visible outline (spec R10)', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline\s*:\s*(?!none)/);
  });

  it('animates blobs on transform only (spec R3)', () => {
    const kf = css.match(/@keyframes blob-float \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(kf).toContain('transform');
    expect(kf).not.toMatch(/opacity|filter|width|height/);
  });
});
