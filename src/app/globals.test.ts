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
    expect(cs.getPropertyValue('--color-accent-ink').trim()).toBe('#92400e');
    expect(cs.getPropertyValue('--color-on-accent').trim()).toBe('#0f0e0c');
    expect(cs.getPropertyValue('--blob-1').trim()).toBe('#a78bfa');
    expect(cs.getPropertyValue('--hm-4').trim()).toBe('#d97706');
  });

  it('defaults to the light palette before any theme is applied', () => {
    expect(getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()).toBe('#f0ebe3');
  });
});

describe('slice D contrast — WCAG AA sampling (spec R10, V6)', () => {
  // WCAG 2.1 relative luminance + contrast over composited translucent layers,
  // mirroring how V6 samples text against the brightest region glass can show.
  const parseColor = (value: string) => {
    const raw = value.trim();
    const rgb = raw.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) {
      const [r, g, b, a] = rgb[1].split(',').map(Number);
      return { r, g, b, a: a === undefined ? 1 : a };
    }
    const hex = raw.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    return null;
  };
  type RGBA = NonNullable<ReturnType<typeof parseColor>>;
  const over = (src: RGBA, dst: RGBA): RGBA => {
    const a = src.a + dst.a * (1 - src.a);
    return {
      r: (src.r * src.a + dst.r * dst.a * (1 - src.a)) / a,
      g: (src.g * src.a + dst.g * dst.a * (1 - src.a)) / a,
      b: (src.b * src.a + dst.b * dst.a * (1 - src.a)) / a,
      a,
    };
  };
  const luminance = ({ r, g, b }: RGBA): number => {
    const f = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (fg: RGBA, bg: RGBA): number => {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const token = (name: string): RGBA => {
    const parsed = parseColor(getComputedStyle(document.documentElement).getPropertyValue(name));
    if (!parsed) throw new Error(`unparseable token ${name}`);
    return parsed;
  };
  const textOn = (fg: RGBA, bg: RGBA): RGBA => (fg.a < 1 ? over(fg, bg) : fg);

  it('light: fg and subtle clear 4.5:1 on glass over the brightest region', () => {
    document.documentElement.dataset.theme = 'light';
    // Light blobs only darken the #f0ebe3 canvas, so the brightest region is
    // the canvas seen through the brightest stacked glass (hover layer over base).
    const glass = over(token('--glass-bg-hover'), over(token('--glass-bg'), token('--color-bg')));
    expect(contrast(textOn(token('--color-fg'), glass), glass)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(textOn(token('--color-subtle'), glass), glass)).toBeGreaterThanOrEqual(4.5);
  });

  it('light: accent-ink clears 4.5:1 on the raw canvas', () => {
    document.documentElement.dataset.theme = 'light';
    expect(contrast(token('--color-accent-ink'), token('--color-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('light: on-accent clears 4.5:1 on the amber accent', () => {
    document.documentElement.dataset.theme = 'light';
    expect(contrast(token('--color-on-accent'), token('--color-accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: warm text clears 4.5:1 on dark glass over the base canvas (DESIGN.md)', () => {
    document.documentElement.dataset.theme = 'dark';
    // DESIGN.md's AA bar is "warm off-white on dark glass". The amber blob glow
    // stays background ambience at DESIGN.md's mandated 0.55 opacity; text over
    // a full-strength blob core is physically unreachable (pure white scores
    // 3.9:1 there) and is reported as a spec tension in the V6 report instead.
    const glass = over(token('--glass-bg'), token('--color-bg'));
    expect(contrast(textOn(token('--color-fg'), glass), glass)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(textOn(token('--color-subtle'), glass), glass)).toBeGreaterThanOrEqual(4.5);
  });

  it('light: input placeholder clears 4.5:1 on the stacked input glass', () => {
    document.documentElement.dataset.theme = 'light';
    const input = over(token('--glass-input-bg'), over(token('--glass-heavy-bg'), over(token('--glass-bg'), token('--color-bg'))));
    expect(contrast(textOn(token('--color-placeholder'), input), input)).toBeGreaterThanOrEqual(4.5);
  });

  it('dark: input placeholder clears 4.5:1 on the stacked input glass', () => {
    document.documentElement.dataset.theme = 'dark';
    // Inputs sit on glass-heavy inside the Sheet — lighter than row glass, where
    // subtle (0.60) measures only ~3.3:1 (3.94:1 in-browser) — so the placeholder
    // gets its own token instead of sharing --color-subtle.
    const input = over(token('--glass-input-bg'), over(token('--glass-heavy-bg'), over(token('--glass-bg'), token('--color-bg'))));
    expect(contrast(textOn(token('--color-placeholder'), input), input)).toBeGreaterThanOrEqual(4.5);
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

// Slice D final-review findings #2 and #4.
describe('slice D review fixes — cascade order (spec R4/R6)', () => {
  it('keeps heading typography inside @layer base so tracking utilities can win (spec R6)', () => {
    const open = css.indexOf('@layer base {');
    expect(open).toBeGreaterThan(-1);
    // Brace-match the wrapper so a stray open brace can't satisfy the pin.
    let depth = 0;
    let end = -1;
    for (let i = css.indexOf('{', open); i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    expect(end).toBeGreaterThan(-1);
    const block = css.slice(open, end + 1);
    expect(block).toContain('h1, h2, h3 {');
    expect(block).toContain('h1 { letter-spacing: -0.02em; }');
    expect(block).toContain('h2 { letter-spacing: -0.01em; }');
    // …and nowhere unlayered: an unlayered rule beats every layered
    // declaration regardless of specificity, silently killing
    // tracking-wide/widest on every section heading.
    expect(css.slice(0, open) + css.slice(end + 1)).not.toContain('h1, h2, h3 {');
  });

  it('lets glass-card hover outrank .reveal.visible and animates it (spec R4/R9)', () => {
    // Equal specificity + later source order meant .reveal.visible
    // { transform: none } vetoed the hover lift on stat tiles and
    // category sections; raising the hover selector's specificity
    // puts the lift back without touching the reveal itself.
    expect(css).toContain('.glass-card.glass-card:hover');
    // The reveal's transition list also owns background/border-color/
    // box-shadow for elements carrying both classes — otherwise those
    // hover changes land with no animation.
    expect(css).toMatch(/\.reveal \{[^}]*background \.25s ease[^}]*box-shadow \.25s ease[^}]*\}/);
    // prefers-reduced-motion must out-rank the raised selector too.
    expect(css).toContain('.glass-card.glass-card:hover, .btn-primary:hover, .btn-glass:hover { transform: none; }');
  });

  it('keeps the canvas fill off <body> so the z-index:-1 scene can paint (spec R3)', () => {
    // Found by the final screenshot pass: an opaque background on <body>
    // paints in step 3 of the root stacking context — above the negative-z
    // scene (step 2) — so every blob was hidden behind a flat
    // rgb(16,13,10). Spec R3 puts the scene above the html canvas and
    // below content; only <html> may carry the canvas fill.
    const both = css.match(/html, body \{[^}]*\}/)?.[0] ?? '';
    expect(both).not.toContain('background');
    expect(css).toMatch(/(^|\n)html \{[^}]*background: var\(--color-bg\)/);
  });
});
