# Slice D — Glassmorphism Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all of Habibit's UI to the approved glassmorphism design (tokens, fonts, blob background, glass utilities, per-screen treatment, subtle motion) with zero behavior change and all 347 existing tests green.

**Architecture:** Token-first layered approach (Approach A): one foundation commit re-points every `--color-*` token to the glass palette and adds glass utility classes + vendored fonts + the background scene; then chrome → today → overlays → stats → screens each swap their surfaces onto those utilities. Tailwind v4 CSS-first (`@layer components` in `globals.css`), `next/font/local` for fonts, one tiny `useReveal` IntersectionObserver hook for scroll reveals.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, vitest + @testing-library/react, lucide-react (icons unchanged).

**Spec:** `docs/superpowers/specs/2026-09-30-slice-d-glassmorphism-design.md` (read it first — every requirement R1–R13 + verification V1–V9 argues from it).

## Global Constraints

- Gates before **every** commit, in order: `npm test` (347 baseline) → `npm run typecheck` → `npm run lint` (2-warning baseline in `src/lib/stats.test.ts`) → `npm run build`.
- Exact staging only (`git add <paths>`); never `git add .`; never stage `.opencode/` or `opencode.json`.
- Commit messages on Windows/PowerShell 5: `[System.IO.File]::WriteAllText("$env:TEMP\commitmsg.txt", $msg, [System.Text.UTF8Encoding]::new($false))` then `git commit -F "$env:TEMP\commitmsg.txt"`.
- **Behavior frozen:** no logic, copy, aria-label, focus, or state-machine changes. Existing tests may only be *rewritten* to pin new visuals, never weakened or deleted.
- Frozen pins: `CompletionToast` (`pointer-events-none`, `z-[60]`, `pointer-events-auto`, `motion-safe:animate-[toast-in_200ms_ease-out]`, testid, copy); `DateStrip` placeholder cells `h-11 w-11 rounded-full` (7×); `Sheet` focus trap/scroll lock/Escape; Sheet z-50 under toast z-60; `habit-fill` testid; all A2 aria-labels byte-identical.
- No new runtime dependencies; no network at runtime; no CDN fonts (the one authoring-time font download in Task 1 is build-time only, like `npm install`).
- Glass fills white-neutral `rgba(255,255,255,N)` only; no tinted glass, no glowing/pulsing borders, no 3D tilt, no emoji.
- Exact token values from spec R1 (e.g. dark bg `#100d0a`, light bg `#f0ebe3`, accent `#f59e0b`, light accent-ink `#b45309`, on-accent `#0f0e0c`); blobs 650/450/350px, `blur(90px)`, opacity .55, delays 0/−4s/−7s, 10s loop, transform-only.
- All three a11y fallbacks required (`@supports not (backdrop-filter…)`, `prefers-reduced-transparency`, `prefers-reduced-motion`); `-webkit-backdrop-filter` alongside `backdrop-filter` everywhere.
- Tap targets stay ≥40px; destructive confirm buttons (`Yes, reset` / `Yes, delete`, red) keep their red — red is semantic, not palette.

## Review Focus

1. **Fonts must work offline** — a stray CDN reference would break the local-first promise silently. Owner: Task 1's `fonts` test (fs existence of both `.woff2` + source scan for `fonts.googleapis|fonts.gstatic` in `layout.tsx` and `globals.css`); V-step re-checks the browser network tab.
2. **Reveal could leave content invisible** — `.reveal` starts at `opacity:0`; if the observer never fires (jsdom, no IO, reduced-motion) content must still appear. Owner: Task 1's `useReveal.test.tsx` (adds `visible` immediately when `IntersectionObserver` is undefined) + Task 3's CategorySection assertion that a rendered section carries `reveal visible`.
3. **Accent contrast on light** — amber text on `#f0ebe3` fails AA; white-on-amber fails AA. Owner: Task 1's globals.test token pins (`--color-accent-ink` = `#b45309`, `--color-on-accent` = `#0f0e0c` in light) + every `text-white`-on-accent migration test in Tasks 2–6; V6 samples computed ratios.
4. **Progress fill semantics under `scaleX`** — the fill must still show the 55% floor, full fill, and cap behavior. Owner: Task 3's rewritten `HabitRow` tests (`transform: scaleX(0.55)` / `scaleX(1)`, plus the untouched width/x-y/ring assertions).
5. **Overlay z-order regression** — new blurred layers could bury the completion toast. Owner: Task 4's Sheet test pins `z-50` on the wrapper; the existing CompletionToast `z-[60]` pin stays untouched; V7 clicks a timer completion and confirms the toast renders above the sheet.

## File Structure

| File | Change | Task |
|---|---|---|
| `src/app/globals.css` | Replace token blocks; add glass utilities, scene, motion CSS, fallbacks, focus-visible | 1 |
| `src/app/fonts/outfit-variable.woff2`, `dm-sans-variable.woff2` | Create (downloaded once) | 1 |
| `src/app/layout.tsx` | `next/font/local` vars on `<body>` | 1 |
| `src/components/BackgroundScene.tsx` (+ test) | Create | 1 |
| `src/lib/useReveal.ts` (+ test) | Create | 1 |
| `src/app/globals.test.ts`, `src/app/layout.test.tsx` | Extend | 1 |
| `src/components/NavShell.tsx` (+test), `WriteErrorBanner.tsx` (+test), `CompletionToast.tsx` | Glass chrome | 2 |
| `HabitRow.tsx`, `TodayScreen.tsx`, `DateStrip.tsx`, `CategorySection.tsx` (+tests), `FlameBadge.tsx`, `ProgressRing.tsx` | Glass today | 3 |
| `Sheet.tsx` (+test), `ValueSheet.tsx`, `MenuDrawer.tsx`, `HabitForm.tsx` (+test), `Combobox.tsx`, `HabitsPanel.tsx` (+test), `HabitList.tsx` (+test) | Glass overlays/forms | 4 |
| `StatsScreen.tsx`, `StatTile.tsx`, `Heatmap.tsx` (+tests) | Glass stats | 5 |
| `NoteScreen.tsx` (+test), `SettingsScreen.tsx`, `ThemePanel.tsx`, `DataPanel.tsx` (+test) | Glass remaining screens + reveal applications | 6 |

`TimerModal.tsx` is deliberately untouched (frozen dark surface, spec §6 — its white-on-dark controls stay). `IntentionBar.tsx`, `ProgressRing` geometry, `Page` tests, and all `src/lib` tests are untouched.

---

### Task 1: Foundation — tokens, utilities, fonts, scene, reveal hook (commit 1)

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/layout.test.tsx`, `src/app/globals.test.ts`, `src/components/NavShell.tsx` (mount only), `src/components/NavShell.test.tsx`
- Create: `src/app/fonts/*.woff2`, `src/components/BackgroundScene.tsx`, `src/components/BackgroundScene.test.tsx`, `src/lib/useReveal.ts`, `src/lib/useReveal.test.tsx`

**Interfaces:**
- Produces (all later tasks consume): tokens `--color-*`, `--glass-*`, `--blob-*`; classes `.glass-card .glass-row .glass-nav .glass-heavy .glass-menu .glass-input .btn-primary .btn-glass .glass-pill .skeleton .reveal .bg-scene`; `.font-display` utility; `useReveal<T>() => React.RefObject<T|null>`; `<BackgroundScene />`; font vars `--font-display` / `--font-body`.

- [ ] **Step 1: Write the failing token/utility tests (globals.test.ts)**

Append to `src/app/globals.test.ts` (the existing `beforeAll` already injects the real stylesheet; `afterEach` already clears `data-theme`):

```ts
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
```

- [ ] **Step 2: Run tests, confirm the new block fails**

Run: `npm test -- globals.test` → FAIL (tokens undefined, classes absent).

- [ ] **Step 3: Implement the token system in globals.css**

In `src/app/globals.css`: **keep** `@import "tailwindcss";`, keep both `color-scheme` declarations, keep `html, body` (font-family edited in Step 8), keep the existing `toast-in` keyframes/rule. **Replace** the entire `:root { … }` and `[data-theme="dark"] { … }` blocks with:

```css
:root {
  color-scheme: light;
  /* Slice D R1 — Light Liquid Glass */
  --color-bg: #f0ebe3;
  --color-fg: rgba(20, 16, 12, 0.90);
  --color-subtle: rgba(20, 16, 12, 0.55);
  --color-muted: rgba(255, 255, 255, 0.62);
  --color-panel: rgba(255, 255, 255, 0.45);
  --color-line: rgba(20, 16, 12, 0.10);
  --color-accent: #f59e0b;
  --color-accent-ink: #b45309;
  --color-on-accent: #0f0e0c;
  --hm-empty: #f4eee4;
  --hm-0: #fbe8cd;
  --hm-1: #f7d6a6;
  --hm-2: #f2bc71;
  --hm-3: #eaa23c;
  --hm-4: #d97706;

  --glass-bg: rgba(255, 255, 255, 0.45);
  --glass-bg-hover: rgba(255, 255, 255, 0.55);
  --glass-border: rgba(255, 255, 255, 0.60);
  --glass-border-hover: rgba(255, 255, 255, 0.75);
  --glass-blur: blur(24px) saturate(200%);
  --glass-specular: 0 2px 0 0 rgba(255, 255, 255, 0.80) inset, 0 -1px 0 0 rgba(0, 0, 0, 0.06) inset;
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  --glass-shadow-hover: 0 12px 40px rgba(0, 0, 0, 0.16);
  --glass-nav-bg: rgba(255, 255, 255, 0.55);
  --glass-heavy-bg: rgba(255, 255, 255, 0.70);
  --glass-heavy-blur: blur(14px) saturate(160%);
  --glass-heavy-border: rgba(255, 255, 255, 0.75);
  --glass-menu-bg: rgba(255, 255, 255, 0.60);
  --glass-input-bg: rgba(255, 255, 255, 0.55);
  --glass-input-border: rgba(255, 255, 255, 0.60);
  --glass-input-focus-border: rgba(20, 16, 12, 0.35);
  --glass-input-focus-ring: rgba(20, 16, 12, 0.08);
  --glass-fallback: rgba(240, 235, 227, 0.96);
  --glass-fallback-strong: rgba(240, 235, 227, 0.98);
  --blob-1: #a78bfa;
  --blob-2: #5eead4;
  --blob-3: #fb923c;
}

[data-theme="dark"] {
  color-scheme: dark;
  /* Slice D R1 — Ember & Slate */
  --color-bg: #100d0a;
  --color-fg: rgba(255, 248, 240, 0.95);
  --color-subtle: rgba(255, 235, 210, 0.60);
  --color-muted: rgba(255, 255, 255, 0.13);
  --color-panel: rgba(255, 255, 255, 0.08);
  --color-line: rgba(255, 255, 255, 0.12);
  --color-accent: #f59e0b;
  --color-accent-ink: #f59e0b;
  --color-on-accent: #0f0e0c;
  --hm-empty: #1c1510;
  --hm-0: #2e2115;
  --hm-1: #55350f;
  --hm-2: #82500f;
  --hm-3: #b06a0d;
  --hm-4: #f59e0b;

  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-bg-hover: rgba(255, 255, 255, 0.13);
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-border-hover: rgba(255, 255, 255, 0.22);
  --glass-blur: blur(20px) saturate(180%);
  --glass-specular: 0 1px 0 0 rgba(255, 255, 255, 0.20) inset;
  --glass-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  --glass-shadow-hover: 0 20px 60px rgba(0, 0, 0, 0.50);
  --glass-nav-bg: rgba(255, 255, 255, 0.06);
  --glass-heavy-bg: rgba(255, 255, 255, 0.20);
  --glass-heavy-blur: blur(14px) saturate(160%);
  --glass-heavy-border: rgba(255, 255, 255, 0.20);
  --glass-menu-bg: rgba(255, 255, 255, 0.10);
  --glass-input-bg: rgba(255, 255, 255, 0.06);
  --glass-input-border: rgba(255, 255, 255, 0.12);
  --glass-input-focus-border: rgba(255, 255, 255, 0.30);
  --glass-input-focus-ring: rgba(255, 255, 255, 0.06);
  --glass-fallback: rgba(20, 16, 12, 0.90);
  --glass-fallback-strong: rgba(20, 16, 12, 0.94);
  --blob-1: #f59e0b;
  --blob-2: #c2410c;
  --blob-3: #78350f;
}
```

- [ ] **Step 4: Append glass utilities, scene, motion CSS, focus, fallbacks**

Append to `globals.css` (after the existing rules; keyframes can live anywhere):

```css
/* Slice D R10 — one visible focus ring in both themes (amber-ink on light) */
:focus-visible {
  outline: 2px solid var(--color-accent-ink);
  outline-offset: 2px;
}

@layer components {
  /* ---- Slice D R4: glass utilities (frosted = default level) ---- */
  .glass-card {
    position: relative;
    overflow: hidden;
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: var(--glass-specular), var(--glass-shadow);
    transition: background .25s ease, border-color .25s ease, box-shadow .25s ease,
                transform .25s cubic-bezier(.34, 1.56, .64, 1);
  }
  .glass-card:hover {
    background: var(--glass-bg-hover);
    border-color: var(--glass-border-hover);
    box-shadow: var(--glass-specular), var(--glass-shadow-hover);
    transform: translateY(-4px);
  }
  .glass-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 50%; height: 100%;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, .07) 50%, rgba(255, 255, 255, 0) 100%);
    transform: skewX(-18deg) translateX(-200%);
    transition: transform .65s ease;
  }
  .glass-card:hover::after { transform: skewX(-18deg) translateX(500%); }

  .glass-row {
    position: relative;
    overflow: hidden;
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-blur);
    backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: var(--glass-specular), var(--glass-shadow);
    transition: background .25s ease, border-color .25s ease;
  }
  .glass-row:hover { background: var(--glass-bg-hover); border-color: var(--glass-border-hover); }

  .glass-nav {
    background: var(--glass-nav-bg);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.06) inset;
  }

  .glass-heavy {
    background: var(--glass-heavy-bg);
    -webkit-backdrop-filter: var(--glass-heavy-blur);
    backdrop-filter: var(--glass-heavy-blur);
    border: 1px solid var(--glass-heavy-border);
    border-radius: 28px;
    box-shadow: var(--glass-specular), var(--glass-shadow);
  }

  .glass-menu {
    background: var(--glass-menu-bg);
    -webkit-backdrop-filter: blur(28px) saturate(200%);
    backdrop-filter: blur(28px) saturate(200%);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.18) inset, 0 20px 60px rgba(0, 0, 0, 0.40);
    overflow: hidden;
  }

  .glass-input {
    width: 100%;
    background: var(--glass-input-bg);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid var(--glass-input-border);
    border-radius: 999px;
    color: var(--color-fg);
    padding: .7rem 1.25rem;
    outline: none;
    transition: background .2s ease, border-color .2s ease, box-shadow .2s ease;
  }
  .glass-input::placeholder { color: var(--color-subtle); }
  .glass-input:focus {
    background: var(--glass-bg-hover);
    border-color: var(--glass-input-focus-border);
    box-shadow: 0 0 0 3px var(--glass-input-focus-ring), var(--glass-specular);
    outline: none;
  }

  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
    background: var(--color-accent);
    color: var(--color-on-accent);
    border: none;
    border-radius: 999px;
    padding: .7rem 1.6rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    transition: transform .18s cubic-bezier(.34, 1.56, .64, 1), filter .18s ease, box-shadow .18s ease;
  }
  .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.1); }
  .btn-primary:active { transform: translateY(1px) scale(.97); transition-duration: .08s; }

  .btn-glass {
    display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
    background: var(--glass-bg);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    border-radius: 999px;
    padding: .65rem 1.5rem;
    color: var(--color-fg);
    font-weight: 500;
    cursor: pointer;
    box-shadow: var(--glass-specular);
    transition: background .2s ease, border-color .2s ease, transform .18s cubic-bezier(.34, 1.56, .64, 1);
  }
  .btn-glass:hover { background: var(--glass-bg-hover); border-color: var(--glass-border-hover); transform: translateY(-2px); }
  .btn-glass:active { transform: translateY(1px) scale(.97); transition-duration: .08s; }

  .glass-pill {
    display: inline-flex; align-items: center; gap: .375rem;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 999px;
    box-shadow: var(--glass-specular);
    color: var(--color-fg);
    transition: background .2s ease, border-color .2s ease;
  }
  .glass-pill:hover { background: var(--glass-bg-hover); border-color: var(--glass-border-hover); }

  .skeleton {
    position: relative;
    overflow: hidden;
    background: var(--glass-bg);
    border-radius: 16px;
  }
  .skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, rgba(255, 255, 255, 0) 20%, rgba(255, 255, 255, .07) 50%, rgba(255, 255, 255, 0) 80%);
    background-size: 200% 100%;
    animation: skeleton-sweep 1.8s linear infinite;
  }
  @keyframes skeleton-sweep { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  .reveal {
    opacity: 0;
    transform: translateY(24px);
    filter: blur(8px);
    transition: opacity .7s cubic-bezier(.34, 1.56, .64, 1),
                transform .7s cubic-bezier(.34, 1.56, .64, 1),
                filter .6s ease;
  }
  .reveal.visible { opacity: 1; transform: none; filter: none; }
  .reveal:nth-child(2) { transition-delay: .08s; }
  .reveal:nth-child(3) { transition-delay: .16s; }
  .reveal:nth-child(4) { transition-delay: .24s; }

  .font-display { font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif; }
}

/* ---- Slice D R3: background scene ---- */
.bg-scene {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  background: var(--color-bg);
}
[data-theme="dark"] .bg-scene {
  background: linear-gradient(160deg, #100d0a 0%, #1c1510 100%);
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.55;
  animation: blob-float 10s ease-in-out infinite;
  will-change: transform;
}
.blob-1 { width: 650px; height: 650px; background: var(--blob-1); top: -180px; left: -180px; }
.blob-2 { width: 450px; height: 450px; background: var(--blob-2); bottom: -120px; right: -120px; animation-delay: -4s; }
.blob-3 { width: 350px; height: 350px; background: var(--blob-3); top: 45%; left: 45%; animation-delay: -7s; }
@keyframes blob-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(40px, -40px) scale(1.06); }
  66% { transform: translate(-25px, 25px) scale(.95); }
}

/* ---- Slice D R4: a11y fallbacks ---- */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-card, .glass-row, .glass-nav, .glass-heavy, .glass-menu, .glass-input,
  .btn-glass, .glass-pill, .skeleton {
    background: var(--glass-fallback);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
@media (prefers-reduced-transparency: reduce) {
  .glass-card, .glass-row, .glass-nav, .glass-heavy, .glass-menu, .glass-input,
  .btn-glass, .glass-pill, .skeleton {
    background: var(--glass-fallback-strong);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
  .reveal { opacity: 1; transform: none; filter: none; }
  .blob { animation: none; }
  .skeleton::after { animation: none; }
  .glass-card:hover, .btn-primary:hover, .btn-glass:hover { transform: none; }
}
```

- [ ] **Step 5: Run the test block to green, then full suite**

Run: `npm test -- globals.test` → PASS for the new describes; run `npm test` → 347 + new still green (if jsdom's CSSOM balks at an at-rule, the failure will name it — the at-rules above are all forms jsdom already parses; do not delete a fallback to make a test pass).

- [ ] **Step 6: Write the failing font + CDN tests (layout.test.tsx)**

Append to `src/app/layout.test.tsx`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// next/font/local is rewritten by Next's build pipeline; vitest sees the raw
// module, so map it to inert values before layout.tsx is imported.
vi.mock('next/font/local', () => ({
  default: () => ({ className: '__mock_font', variable: '--font-mock', style: { fontFamily: 'serif' } }),
}));

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
```

(`vi` must be added to the existing vitest import list at the top of the file.)

- [ ] **Step 7: Run tests, confirm failure (font files missing)**

Run: `npm test -- layout.test` → FAIL `outfit-variable.woff2` does not exist.

- [ ] **Step 8: Download the fonts (one-time, authoring only) and wire them**

Run in the project root (network used here only, exactly like `npm install`; nothing fetches at runtime):

```powershell
New-Item -ItemType Directory -Force src\app\fonts | Out-Null
$ua = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' }
function Get-LatinUrl($familyCssUrl) {
  $css = (Invoke-WebRequest -Uri $familyCssUrl -Headers $ua).Content
  $m = [regex]::Match($css, '/\*\s*latin\s*\*/\s*@font-face\s*\{[\s\S]*?url\((https://[^)]+\.woff2)\)')
  if (-not $m.Success) { throw "latin @font-face block not found for $familyCssUrl" }
  $m.Groups[1].Value
}
$urls = @(
  (Get-LatinUrl 'https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap'),
  (Get-LatinUrl 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,100..1000&display=swap')
)
Invoke-WebRequest -Uri $urls[0] -OutFile 'src\app\fonts\outfit-variable.woff2' -Headers $ua
Invoke-WebRequest -Uri $urls[1] -OutFile 'src\app\fonts\dm-sans-variable.woff2' -Headers $ua
foreach ($f in 'src\app\fonts\outfit-variable.woff2', 'src\app\fonts\dm-sans-variable.woff2') {
  $magic = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($f)[0..3])
  if ($magic -ne 'wOF2') { throw "$f is not a woff2 file" }
  if ((Get-Item $f).Length -lt 20KB) { throw "$f looks truncated" }
}
```

If the DM Sans axis URL 400s, fall back to `'https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..1000&display=swap'` (same latin-block parse). If Google returns static per-weight files instead of one variable file, download `…family=Outfit:wght@700` → `outfit-variable.woff2` is then renamed per reality — adjust the two `localFont` weight ranges and the test filename accordingly, keeping exactly two files.

Then in `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const display = localFont({
  path: './fonts/outfit-variable.woff2',
  weight: '100 900',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});
const body = localFont({
  path: './fonts/dm-sans-variable.woff2',
  weight: '100 1000',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});
```

and change the body to `<body className={`${display.variable} ${body.variable} antialiased`}>` (theme boot script untouched). In `globals.css`, edit the existing `html, body` rule: `font-family: var(--font-body), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;` and append:

```css
h1, h2, h3 { font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif; }
h1 { letter-spacing: -0.02em; }
h2 { letter-spacing: -0.01em; }
```

- [ ] **Step 9: Run tests to green**

Run: `npm test -- layout.test` → PASS; `npm test` → full green.

- [ ] **Step 10: Write the failing BackgroundScene tests**

Create `src/components/BackgroundScene.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackgroundScene } from './BackgroundScene';

describe('BackgroundScene (slice D R3)', () => {
  it('renders three inert blobs behind the app', () => {
    const { container } = render(<BackgroundScene />);
    const scene = container.firstElementChild!;
    expect(scene.className).toContain('bg-scene');
    expect(scene.className).toContain('pointer-events-none');
    expect(scene).toHaveAttribute('aria-hidden', 'true');
    const blobs = scene.querySelectorAll('.blob');
    expect(blobs).toHaveLength(3);
    expect(scene.querySelector('.blob-1')).toBeInTheDocument();
    expect(scene.querySelector('.blob-2')).toBeInTheDocument();
    expect(scene.querySelector('.blob-3')).toBeInTheDocument();
  });
});
```

Add to `src/components/NavShell.test.tsx`:

```tsx
it('mounts the background scene exactly once behind the content (slice D R3)', () => {
  const { container } = render(<NavShell><main>content</main></NavShell>);
  expect(container.querySelectorAll('.bg-scene')).toHaveLength(1);
  expect(screen.getByText('content')).toBeInTheDocument();
});
```

- [ ] **Step 11: Run tests, confirm failure**

Run: `npm test -- BackgroundScene NavShell.test` → FAIL (`BackgroundScene` module not found).

- [ ] **Step 12: Implement BackgroundScene + mount it**

Create `src/components/BackgroundScene.tsx`:

```tsx
/** Slice D R3: the fixed color-blob canvas every glass panel frosts over.
 *  Non-interactive and aria-hidden — pure decoration, transform-only motion. */
export function BackgroundScene() {
  return (
    <div className="bg-scene pointer-events-none" aria-hidden="true">
      <span className="blob blob-1" />
      <span className="blob blob-2" />
      <span className="blob blob-3" />
    </div>
  );
}
```

In `src/components/NavShell.tsx`: `import { BackgroundScene } from './BackgroundScene';` and make it the first child of the root `<div className="min-h-dvh md:flex">`:

```tsx
<div className="min-h-dvh md:flex">
  <BackgroundScene />
  …
```

- [ ] **Step 13: Run tests to green**

Run: `npm test -- BackgroundScene NavShell.test` → PASS.

- [ ] **Step 14: Write the failing useReveal tests**

Create `src/lib/useReveal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReveal } from './useReveal';

function Probe({ className }: { className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} data-testid="probe" className={`reveal ${className ?? ''}`} />;
}

afterEach(() => vi.unstubAllGlobals());

describe('useReveal (slice D R9)', () => {
  it('reveals immediately when IntersectionObserver is unavailable (jsdom / older engines)', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').className).toContain('visible');
  });

  it('observes, reveals on intersect, and unobserves (spec threshold 0.12)', () => {
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    let fire: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    const MockIO = vi.fn((cb: (entries: { isIntersecting: boolean }[]) => void) => {
      fire = cb;
      return { observe, unobserve, disconnect };
    });
    vi.stubGlobal('IntersectionObserver', MockIO);
    render(<Probe />);
    expect(MockIO).toHaveBeenCalledWith(expect.any(Function), { threshold: 0.12 });
    expect(observe).toHaveBeenCalledTimes(1);
    const probe = screen.getByTestId('probe');
    expect(probe.className).not.toContain('visible');
    fire!([{ isIntersecting: true }]);
    expect(probe.className).toContain('visible');
    expect(unobserve).toHaveBeenCalledWith(probe);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('disconnects on unmount', () => {
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect })));
    const { unmount } = render(<Probe />);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 15: Run tests, confirm failure**

Run: `npm test -- useReveal` → FAIL (module not found).

- [ ] **Step 16: Implement useReveal**

Create `src/lib/useReveal.ts`:

```ts
import { useEffect, useRef } from 'react';

/**
 * Slice D R9: adds `visible` to the returned element when it scrolls into view
 * (skill threshold 0.12), then stops observing. Environments without
 * IntersectionObserver (jsdom) — and elements already in view — reveal
 * immediately, so content can never stay hidden.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
```

- [ ] **Step 17: Run tests to green**

Run: `npm test -- useReveal` → PASS.

- [ ] **Step 18: Gates**

Run: `npm test` → full suite green (347 baseline + ~14 new) → `npm run typecheck` → `npm run lint` (2-warning baseline) → `npm run build`.

- [ ] **Step 19: Commit**

```powershell
git add src/app/globals.css src/app/layout.tsx src/app/layout.test.tsx src/app/globals.test.ts src/app/fonts src/components/BackgroundScene.tsx src/components/BackgroundScene.test.tsx src/components/NavShell.tsx src/components/NavShell.test.tsx src/lib/useReveal.ts src/lib/useReveal.test.tsx
# commit via -F with message:
# feat(theme): glass token system, utilities, fonts, and background scene (D)
```

---

### Task 2: Chrome — navigation, error banner, completion toast (commit 2)

**Files:**
- Modify: `src/components/NavShell.tsx`, `src/components/NavShell.test.tsx`, `src/components/WriteErrorBanner.tsx`, `src/components/WriteErrorBanner.test.tsx`, `src/components/CompletionToast.tsx`, `src/components/CompletionToast.test.tsx`

**Interfaces:**
- Consumes: tokens + `.glass-nav/.glass-card` from Task 1.
- Produces: none (pure restyle).

- [ ] **Step 1: Write the failing chrome tests**

Append to `NavShell.test.tsx`:

```tsx
it('frosts both nav variants and drops the opaque canvas (slice D R5)', () => {
  const { container } = render(<NavShell><main>c</main></NavShell>);
  const navs = container.querySelectorAll('nav[aria-label="Primary"]');
  expect(navs).toHaveLength(2);
  for (const nav of navs) {
    expect(nav.className).toContain('glass-nav');
    expect(nav.className).not.toContain('bg-[var(--color-bg)]');
  }
  expect(navs[0].className).toContain('border-r');   // rail edge stays
  expect(navs[1].className).toContain('border-t');   // bottom bar edge stays
});

it('prints active tabs with the on-accent/ink tokens (slice D R1 contrast)', () => {
  render(<NavShell><main>c</main></NavShell>);
  const today = screen.getAllByRole('link', { name: /today/i });
  expect(today[0].className).toContain('bg-[var(--color-accent)]');
  expect(today[0].className).toContain('text-[var(--color-on-accent)]');   // pill on amber
  expect(today[1].className).toContain('text-[var(--color-accent-ink)]');  // bottom-bar label
  expect(today[1].className).not.toContain('text-[var(--color-accent)]');
});
```

Append to `WriteErrorBanner.test.tsx` (keep every existing assertion):

```tsx
it('frosts the banner and signals the warning with an icon, not a red fill (slice D R5)', () => {
  // reuse the existing harness that triggers reportWriteError in this file
  const banner = screen.getByTestId('write-error');
  expect(banner.className).toContain('glass-card');
  expect(banner.className).not.toContain('bg-red-50');
  expect(banner.querySelector('svg.lucide-triangle-alert')).toBeInTheDocument();
});
```

Append to `CompletionToast.test.tsx` (keep every A2 pin untouched):

```tsx
it('frosts the toast body as neutral glass (slice D)', () => {
  render(<CompletionToast />);
  act(() => { celebrateIfCompleted(qty, 0, 8); });
  const body = screen.getByRole('button', { name: /nice work/i });
  expect(body.className).toContain('glass-card');
  expect(body.className).not.toContain('bg-[var(--color-bg)]');
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npm test -- NavShell.test WriteErrorBanner CompletionToast` → the three new tests FAIL.

- [ ] **Step 3: Implement the chrome restyle**

`NavShell.tsx`:
- Rail nav: classes become
  `'sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-[var(--color-line)] p-3 md:flex md:w-[72px] xl:w-[240px] glass-nav'` (the old `bg-[var(--color-bg)]` is gone — the scene shows through).
- `linkClass(active)` active branch → `'bg-[var(--color-accent)] text-[var(--color-on-accent)]'`; inactive branch unchanged (`hover:bg-[var(--color-muted)]` now hovers the translucent tint).
- Bottom bar: `fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-line)] md:hidden glass-nav` (drop `bg-[var(--color-bg)]/95 backdrop-blur`); active label `text-[var(--color-accent-ink)]`, inactive `text-[var(--color-subtle)]`.
- Wordmark span gets `font-display` alongside `text-lg font-extrabold tracking-tight`.
- Storage alert `<p role="alert">` classes → `'m-3 flex items-start gap-2 rounded-2xl glass-card px-4 py-3 text-sm'` with `<TriangleAlert size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-ink)]" />` inserted before the text (import `TriangleAlert` from lucide-react); the text itself is now a `<span>` inside the `<p>`. Keep `role="alert"` and the copy byte-identical.

`WriteErrorBanner.tsx`: classes → `'m-3 flex items-start justify-between gap-3 glass-card px-4 py-3 text-sm'`; message wrapped as `<span className="flex items-start gap-2"><TriangleAlert size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-ink)]" /><span>{message}</span></span>`; Dismiss button unchanged. (`text-red-900`/`bg-red-50`/`dark:*` classes removed.)

`CompletionToast.tsx`: on the inner button, replace `border border-[var(--color-line)] bg-[var(--color-bg)]` with `glass-card border border-[var(--glass-border)]` — **keep verbatim**: `pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--color-fg)] shadow-lg motion-safe:animate-[toast-in_200ms_ease-out]`. Wrapper region (`pointer-events-none`, `z-[60]`, testid, `role="status"`) untouched.

- [ ] **Step 4: Run tests to green**

Run: `npm test -- NavShell.test WriteErrorBanner CompletionToast` → PASS (existing pins intact).

- [ ] **Step 5: Gates + commit**

Run gates in order (full suite). Commit (exact staging of the six files): `feat(chrome): glass navigation, banners, and completion toast (D)`.

---

### Task 3: Today — habit rows, date strip, category sections (commit 3)

**Files:**
- Modify: `src/components/HabitRow.tsx`, `src/components/HabitRow.test.tsx`, `src/components/TodayScreen.tsx`, `src/components/DateStrip.tsx`, `src/components/DateStrip.test.tsx`, `src/components/CategorySection.tsx`, `src/components/CategorySection.test.tsx`, `src/components/FlameBadge.tsx`, `src/components/ProgressRing.tsx`, `src/components/ProgressRing.test.tsx`

**Interfaces:**
- Consumes: tokens, `.glass-row/.glass-card/.glass-pill/.skeleton`, `useReveal`, `rgba()` util.
- Produces: `habit-fill` becomes decorative `transform: scaleX()` (same testid, same 55% floor math); everything else byte-identical to A2.

- [ ] **Step 1: Write the failing restyle tests**

`HabitRow.test.tsx` — **rewrite** the two width-floor assertions and add:

```tsx
// replaces the old width: '55%' assertion (fill now animates on transform):
it('clamps the visual ratio but never below the 55% readability floor', () => {
  render(<HabitRow habit={qtyHabit} value={0} onToggle={vi.fn()} {...base} />);
  expect(screen.getByTestId('habit-fill')).toHaveStyle({ transform: 'scaleX(0.55)' });
  render(<HabitRow habit={qtyHabit} value={8} onToggle={vi.fn()} {...base} />);
  expect(screen.getAllByTestId('habit-fill')[1]).toHaveStyle({ transform: 'scaleX(1)' });
});

it('shows name, frequency subtext and renders fully filled when done', () => {
  render(<HabitRow habit={boolHabit} value={1} onToggle={vi.fn()} {...base} />);
  expect(screen.getByText('Take a Cold Shower')).toBeInTheDocument();
  expect(screen.getByText('Every day')).toBeInTheDocument();
  expect(screen.getByTestId('habit-fill')).toHaveStyle({ width: '100%', transform: 'scaleX(1)' });
});
```

append:

```tsx
it('frosts the row chrome and keeps habit color only in the wash (slice D R6)', () => {
  render(<HabitRow habit={qtyHabit} value={6} onToggle={vi.fn()} {...base} />);
  const row = document.querySelector('li')!;
  expect(row.className).toContain('glass-row');
  expect(row.style.background).toBe('');                       // no inline tinted surface
  const fill = screen.getByTestId('habit-fill');
  expect(fill).toHaveAttribute('aria-hidden', 'true');          // decorative; ring+subtext authoritative
  expect(fill.style.width).toBe('100%');
  expect(fill.style.transform).toBe('scaleX(0.75)');            // 6/8 above the floor
  expect(fill.style.background).toContain('linear-gradient');   // wash, not solid slab
});

it('prints done state on the check control with the accent tokens (slice D R1)', () => {
  const { rerender } = render(<HabitRow habit={qtyHabit} value={4} onToggle={vi.fn()} {...base} />);
  const notDone = screen.getByRole('button', { name: 'Mark Drink Water done' });
  expect(notDone.className).toContain('text-[var(--color-subtle)]');
  rerender(<HabitRow habit={qtyHabit} value={8} onToggle={vi.fn()} {...base} />);
  const done = screen.getByRole('button', { name: 'Mark Drink Water not done' });
  expect(done.className).toContain('bg-[var(--color-accent)]');
  expect(done.className).toContain('text-[var(--color-on-accent)]');
});

it('keeps the row text on theme tokens, never fixed white (slice D R6)', () => {
  render(<HabitRow habit={boolHabit} value={0} onToggle={vi.fn()} {...base} />);
  expect(screen.getByText('Take a Cold Shower').className).toContain('text-[var(--color-fg)]');
  expect(screen.getByText('Every day').className).toContain('text-[var(--color-subtle)]');
});
```

`DateStrip.test.tsx` — append:

```tsx
it('prints day numerals on accent fills with the on-accent token (slice D R1)', () => {
  render(<DateStrip selected={TODAY} today={TODAY} onSelect={vi.fn()} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons[5].className).toContain('text-[var(--color-on-accent)]'); // selected today
  expect(buttons[4].className).toContain('text-[var(--color-on-accent)]'); // past day
  expect(buttons[6].className).toContain('text-[var(--color-subtle)]');    // future preview
  expect(buttons[6].className).not.toContain('text-white');
});
```

`CategorySection.test.tsx` — append:

```tsx
it('frosts the section card and reveals it immediately in jsdom (slice D R6/R9)', () => {
  render(<CategorySection category="Morning" habits={[habit('a', 'Meditate')]}
                          collapsed={false} onToggleCollapse={vi.fn()} {...handlers} />);
  const section = screen.getByText('Morning').closest('section')!;
  expect(section.className).toContain('glass-card');
  expect(section.className).toContain('reveal');
  expect(section.className).toContain('visible');   // no IntersectionObserver → never hidden
  expect(section.className).not.toContain('bg-[var(--color-panel)]');
});
```

`ProgressRing.test.tsx` — append:

```tsx
it('tracks with the theme hairline so the ring survives light glass (slice D)', () => {
  const { container } = render(<ProgressRing size={64} stroke={6} progress={0.5} color="#6366f1">4/8</ProgressRing>);
  const [track] = container.querySelectorAll('circle');
  expect(track.getAttribute('stroke')).toBe('var(--color-line)');
});
```

- [ ] **Step 2: Run tests, confirm failures**

Run: `npm test -- HabitRow.test DateStrip.test CategorySection.test ProgressRing.test` → new/rewritten tests FAIL (old width assertion will also fail until implementation — that's the red).

- [ ] **Step 3: Implement the Today restyle**

`HabitRow.tsx`:
- Root `li`: `'relative isolate overflow-hidden rounded-3xl'` + `style={{background: rgba(habit.color, 0.2)}}` → `className="glass-row isolate"` (drop `rounded-3xl`, `relative` kept by glass-row, drop inline background).
- Fill div →
  ```tsx
  <div data-testid="habit-fill" aria-hidden="true"
       className="absolute inset-y-0 left-0 w-full origin-left"
       style={{
         transform: `scaleX(${fill})`,
         background: `linear-gradient(90deg, ${rgba(habit.color, 0.4)} 0%, ${rgba(habit.color, 0.1)} 100%)`,
         transition: 'transform 300ms ease',
       }} />
  ```
- Name `<p>`: `text-white drop-shadow-sm` → `text-[var(--color-fg)]`; subtext `<p>`: `text-white/90 drop-shadow-sm` → `text-[var(--color-subtle)]`.
- Avatar `<span>`: `'grid h-10 w-10 shrink-0 place-items-center rounded-full'` with `style={{ background: habit.color }}` (white glyph stays — identity chip, spec R6).
- FlameBadge className: `'pointer-events-none absolute right-3 top-1.5 glass-pill px-1.5'` (drop `text-white`).
- Steppers: minus button `'grid h-8 w-8 shrink-0 place-items-center rounded-full glass-pill disabled:opacity-40'`; plus button same with `h-10 w-10` (glyphs keep habit color).
- Timer ring children: `<Check size={18} className="text-[var(--color-fg)]" strokeWidth={3} />` / `<Plus size={18} className="text-[var(--color-fg)]" />`; quantity ring percent span `text-white` → `text-[var(--color-fg)]`.
- Check button: `done ? 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow' : 'grid h-10 w-10 shrink-0 place-items-center rounded-full glass-pill text-[var(--color-subtle)] disabled:opacity-40'`; when done the inner `<Check size={22} strokeWidth={3} />` inherits on-accent (drop `color={habit.color}`); not-done keeps the `○` span without `text-slate-400`.
- Aria-labels: untouched, byte-identical.

`ProgressRing.tsx`: track circle `stroke="rgba(255,255,255,0.35)"` → `stroke="var(--color-line)"`.

`FlameBadge.tsx`: `<Flame size={12} className="text-[#f97316]" fill="#f97316" />` → `<Flame size={12} className="text-[var(--color-accent)]" fill="currentColor" />`.

`DateStrip.tsx`: selected branch `text-white` → `text-[var(--color-on-accent)]`; past branch `text-white` → `text-[var(--color-on-accent)]` (fills, ring, connector, placeholder cells all untouched).

`CategorySection.tsx`: section className `'mb-3 break-inside-avoid rounded-3xl bg-[var(--color-panel)] p-3'` → `'mb-3 break-inside-avoid glass-card reveal p-3'`; add `const revealRef = useReveal<HTMLElement>()` + `ref={revealRef}` on the section (import `useReveal` from `@/lib/useReveal`). Counter circle: `border-[var(--color-accent)] text-[var(--color-accent)]` → `border-[var(--color-accent-ink)] text-[var(--color-accent-ink)]`.

`TodayScreen.tsx`: the `Loading…` `<p>` at line ~175 gains the `skeleton` class; the empty-state `<Link href="/settings">` at line ~180 swaps `bg-[var(--color-accent)] … text-white` → `btn-primary` (drop `rounded-2xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white`, keep as `btn-primary text-sm`).

- [ ] **Step 4: Run the four test files, then the full suite**

Run: `npm test -- HabitRow.test DateStrip.test CategorySection.test ProgressRing.test` → PASS; `npm test` → all green (TodayScreen/NoteScreen assertions unaffected — they query text/roles/testids).

- [ ] **Step 5: Gates + commit**

Gates in order. Commit exact staging: `feat(today): glass habit rows, date strip, and category sections (D)`.

---

### Task 4: Overlays — sheets, drawer, forms (commit 4)

**Files:**
- Modify: `src/components/Sheet.tsx`, `src/components/Sheet.test.tsx`, `src/components/ValueSheet.tsx`, `src/components/MenuDrawer.tsx`, `src/components/HabitForm.tsx`, `src/components/HabitForm.test.tsx`, `src/components/Combobox.tsx`, `src/components/HabitsPanel.tsx`, `src/components/HabitsPanel.test.tsx`, `src/components/HabitList.tsx`, `src/components/HabitList.test.tsx`

**Interfaces:**
- Consumes: tokens, `.glass-heavy/.glass-menu/.glass-input/.btn-primary/.btn-glass/.skeleton`.
- Produces: `Sheet` panel surface = class-driven glass (no inline background); `dark` prop = dark scrim + fixed light text (spec §6 preserved).

- [ ] **Step 1: Write the failing tests**

`Sheet.test.tsx` — **rewrite** the whole `describe('theme tokens (branch review #3)')` block to:

```ts
describe('glass surfaces (slice D R7; replaces branch-review #3 pins)', () => {
  it('frosts the dark panel with themed text and no inline surface', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('glass-heavy');
    expect(panel.style.background).toBe('');                          // surface comes from the class
    expect(panel.style.color).toBe('rgba(255, 248, 240, 0.95)');      // --color-fg (dark)
  });

  it('frosts the light panel with themed text and no inline surface', () => {
    document.documentElement.dataset.theme = 'light';
    render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('glass-heavy');
    expect(panel.style.background).toBe('');
    expect(panel.style.color).toBe('rgba(20, 16, 12, 0.90)');         // --color-fg (light)
  });

  it('keeps the timer sheet dark in light theme via the heavy scrim (spec §6)', () => {
    document.documentElement.dataset.theme = 'light';
    const { container } = render(<Sheet open dark onClose={vi.fn()} title="Timer"><span>body</span></Sheet>);
    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('glass-heavy');
    expect(panel.style.background).toBe('');
    expect(panel.style.color).toBe('#f5f5f7');                        // fixed light text on dark glass
    const scrim = container.querySelector('[data-sheet-backdrop]')!;
    expect(scrim.className).toContain('bg-black/75');
    expect(scrim.className).toContain('backdrop-blur-sm');
  });

  it('keeps the non-timer scrim blurring and the layer under the toast (z-order)', () => {
    const { container } = render(<Sheet open onClose={vi.fn()} title="Exact value"><span>body</span></Sheet>);
    const scrim = container.querySelector('[data-sheet-backdrop]')!;
    expect(scrim.className).toContain('bg-black/50');
    expect(scrim.className).toContain('backdrop-blur-sm');
    expect(scrim.parentElement!.className).toContain('z-50');          // toast stays z-[60] above it
  });
});
```

(`style.color` strings must match the authored token text from Task 1 exactly; if cssstyle normalizes whitespace differently, assert `toContain('255, 248, 240')` style instead — same pin, adjusted to reality.)

`HabitForm.test.tsx` — append (reuse the file's existing render harness):

```tsx
it('styles inputs as glass pills and Save as the primary amber pill (slice D)', () => {
  const { container } = render(/* same props as existing tests */);
  expect(container.querySelector('.glass-input')).not.toBeNull();
  expect(container.querySelector('input.focus\\:border-\\[var\\(--color-accent\\)\\]')).toBeNull(); // focus utility gone
  expect(screen.getByRole('button', { name: 'Save habit' }).className).toContain('btn-primary');
});
```

`HabitsPanel.test.tsx` — append:

```tsx
it('shimmers the loading line and prints New habit on the accent token (slice D)', () => {
  // reuse the existing loading harness (habits undefined)
  const loading = screen.getByText('Loading…');
  expect(loading.className).toContain('skeleton');
  const add = screen.getByRole('button', { name: /new habit/i });
  expect(add.className).toContain('text-[var(--color-on-accent)]');
  expect(add.className).not.toContain('text-white');
});
```

`HabitList.test.tsx` — append:

```tsx
it('frosts every manage-screen habit row (slice D)', () => {
  // reuse the existing loaded harness
  const rows = document.querySelectorAll('.glass-row');
  expect(rows.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npm test -- Sheet.test HabitForm.test HabitsPanel.test HabitList.test` → new/rewritten tests FAIL (old Sheet surface pins fail too — they are intentionally replaced).

- [ ] **Step 3: Implement**

`Sheet.tsx`:
- `TIMER_SURFACE` → `{ fg: '#f5f5f7' }` only (drop bg/line literals).
- `themedSurface()` → `const themedFg = (): string => typeof document === 'undefined' ? 'rgba(20, 16, 12, 0.90)' : getComputedStyle(document.documentElement).getPropertyValue('--color-fg').trim() || 'rgba(20, 16, 12, 0.90)';`
- `CENTER` → `md: { wrap: 'md:items-center', panel: 'md:max-w-lg md:rounded-[28px]' }`, `lg: { wrap: 'lg:items-center', panel: 'lg:max-w-lg lg:rounded-[28px]' }`.
- Scrim: `className={`absolute inset-0 bg-black/${dark ? '75' : '50'} backdrop-blur-sm`}`.
- Panel: className `relative z-10 glass-heavy max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] rounded-b-none p-5 ${center.panel}` and `style={{ color: dark ? TIMER_SURFACE.fg : themedFg() }}` (inline `background`/`border` removed — class owns them). Focus trap, Escape, scroll lock, `data-sheet-backdrop`, `aria-*`: untouched.

`MenuDrawer.tsx`: the drawer panel element gains `glass-menu` (drop its `bg-[var(--color-bg)]`-style fill/radius/shadow classes if present — the class owns them); segmented active `text-white` → `text-[var(--color-on-accent)]`; item rows keep structure (their `bg-[var(--color-muted)]` now hovers the glass tint).

`HabitForm.tsx`: all three inputs (lines ~94/194/205) → `className="glass-input"` (drop `rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-accent)]`); swatch/icon/day active states `text-white` → `text-[var(--color-on-accent)]` (lines ~115/222/239); submit → `className="mt-1 btn-primary"`. Everything else (labels, errors, aria) untouched.

`Combobox.tsx`: input → `glass-input` (same drop as HabitForm inputs).

`HabitsPanel.tsx`: root `<section>` → `<section className="glass-card mb-6 p-4">`; `New habit` button → `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-on-accent)]`; `Loading…` `<p>` gains `skeleton`.

`HabitList.tsx`: row div (line ~77) → `'flex items-center gap-3 glass-row px-3 py-2.5'` (drop `rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]`); `Yes, delete` red button untouched; Cancel → `btn-glass rounded-xl px-3 py-1.5 text-sm`.

`ValueSheet.tsx`: save button (line ~50) → `className="btn-primary w-full"` (drop `rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-semibold text-white`).

`TimerModal.tsx`: **no changes** — frozen dark surface (spec §6); its white-on-dark controls are correct.

- [ ] **Step 4: Run tests to green**

Run: `npm test -- Sheet.test HabitForm.test HabitsPanel.test HabitList.test ValueSheet TimerModal` → PASS (TimerModal/ValueSheet existing suites untouched by these edits must stay green); then full `npm test`.

- [ ] **Step 5: Gates + commit**

Gates in order. Commit exact staging: `feat(overlays): glass sheets, drawer, timer host, and forms (D)`.

---

### Task 5: Stats — glass tiles and warm heatmap (commit 5)

**Files:**
- Modify: `src/components/StatsScreen.tsx`, `src/components/StatsScreen.test.tsx`, `src/components/StatTile.tsx`, `src/components/Heatmap.tsx`, `src/components/Heatmap.test.tsx`

**Interfaces:**
- Consumes: tokens (warm `--hm-*` already live from Task 1), `.glass-card/.skeleton/.font-display`, `useReveal`.

- [ ] **Step 1: Write the failing tests**

`StatsScreen.test.tsx` — append (reuse the file's existing loaded + loading harnesses):

```tsx
it('frosts the stat panels, tiles, and loading line (slice D R8)', async () => {
  // loaded render (same setup as the existing tiles test):
  // ...after habits+entries resolve:
  expect(document.querySelectorAll('.glass-card').length).toBeGreaterThan(0);
  expect(document.querySelector('.font-display')).not.toBeNull();

  // loading branch (habits undefined), separate render:
  expect(screen.getByText('Loading…').className).toContain('skeleton');
});
```

(`skeleton` and loaded-state assertions may be two separate `it`s if the existing harness renders one state at a time — keep each assertion attached to a real render.)

`Heatmap.test.tsx` — append:

```tsx
it('frosts the heatmap panel (slice D R8)', () => {
  // reuse the existing render harness in this file
  const panel = document.querySelector('section[aria-label="Activity heatmap"]')!;
  expect(panel.className).toContain('glass-card');
  expect(panel.className).not.toContain('bg-[var(--color-panel)]');
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npm test -- StatsScreen.test Heatmap.test` → FAIL.

- [ ] **Step 3: Implement**

`StatTile.tsx`: root div (line ~7) → `'glass-card reveal flex flex-col items-center gap-0.5 px-4 py-4 text-center'` (drop `rounded-2xl bg-[var(--color-panel)]`); add `const revealRef = useReveal<HTMLDivElement>()` + `ref={revealRef}`; the element rendering `value` gains the `font-display` class.

`StatsScreen.tsx`:
- `Loading…` `<p>` (line ~80) gains `skeleton`.
- "By intention" panel (line ~107): `'rounded-2xl bg-[var(--color-panel)] px-4 py-2'` → `'glass-card px-4 py-2'`.
- Any sibling panel below using `bg-[var(--color-panel)]` (grep the file during implementation — same swap).

`Heatmap.tsx`: section (line ~105) → `'glass-card p-4'` + `aria-label="Activity heatmap"` kept verbatim; tooltip/legend/labels untouched (warm ramp already applied via tokens).

- [ ] **Step 4: Run tests to green**

Run: `npm test -- StatsScreen.test Heatmap.test` then full `npm test` (Heatmap's "no `--hm-N` inline" pin must remain green — token values changed, mechanism didn't).

- [ ] **Step 5: Gates + commit**

Gates in order. Commit exact staging: `feat(stats): glass tiles and warm heatmap ramp (D)`.

---

### Task 6: Screens — note, settings, data + reveal applications (commit 6)

**Files:**
- Modify: `src/components/NoteScreen.tsx`, `src/components/NoteScreen.test.tsx`, `src/components/SettingsScreen.tsx`, `src/components/ThemePanel.tsx`, `src/components/DataPanel.tsx`, `src/components/DataPanel.test.tsx`

**Interfaces:**
- Consumes: tokens, `.glass-card/.glass-pill/.btn-glass/.skeleton`, `useReveal`.
- Produces: final restyle state — after this task every spec R5–R8 surface is glass.

- [ ] **Step 1: Write the failing tests**

`NoteScreen.test.tsx` — append (reuse existing harnesses for quote/loading/day renders):

```tsx
it('frosts the quote, keeps loading shimmering, and reveals the list (slice D R8/R9)', () => {
  // quote present render:
  const quote = document.querySelector('blockquote')!;
  expect(quote.className).toContain('glass-card');
  expect(quote.className).not.toContain('bg-[var(--color-panel)]');
  // loading render (habits undefined):
  expect(screen.getByText('Loading…').className).toContain('skeleton');
});

it('styles intention groups as neutral glass with theme text (slice D R8)', () => {
  // reuse the existing scheduled-day render from this file:
  const group = document.querySelector('section')!;
  expect(group.className).toContain('glass-card');
  const heading = group.querySelector('h2')!;
  expect(heading.className).toContain('text-[var(--color-fg)]');
  expect(heading.className).not.toContain('text-white');
  const checkbox = screen.getByRole('checkbox');
  expect(checkbox.className).toContain('accent-[var(--color-accent)]');
});
```

`DataPanel.test.tsx` — append:

```tsx
it('frosts the data panel and secondary actions (slice D R8)', () => {
  // reuse the existing render harness:
  const panel = screen.getByRole('heading', { name: 'Data' }).closest('section')!;
  expect(panel.className).toContain('glass-card');
  const exportBtn = screen.getByRole('button', { name: /export json/i });
  expect(exportBtn.className).toContain('btn-glass');
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npm test -- NoteScreen.test DataPanel.test` → FAIL.

- [ ] **Step 3: Implement**

`NoteScreen.tsx`:
- Quote blockquote (line ~85) → `'mb-5 glass-card px-4 py-3 text-sm italic'` (drop `rounded-2xl bg-[var(--color-panel)]`).
- Groups container `<div className="mt-5 flex flex-col gap-3">` gets `const revealRef = useReveal<HTMLDivElement>()` + `ref={revealRef}` (add `reveal` to its className) so the day's panels blur-in once.
- Intention section (line ~100): `'rounded-3xl p-4'` + `style={{ background: color }}` → `'glass-card p-4'` with the inline background **removed**; `<h2 … text-white>` → `text-[var(--color-fg)]` and `<Icon size={16} style={{ color }} />` keeps the intention color as content.
- Habit `<li>` (line ~110): `'flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2 text-white'` → `'flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-hover)] px-3 py-2 text-[var(--color-fg)]'` (no backdrop-filter — nesting under the card keeps ≤3 blurred layers).
- Checkbox (line ~121): `accent-white` → `accent-[var(--color-accent)]`.
- x/y span (line ~125): `text-white/70` → `text-[var(--color-subtle)]`.
- `Loading…` `<p>` (line ~93) gains `skeleton`.
- `done ? 'line-through opacity-80'` span logic untouched (meaning never color-only).

`SettingsScreen.tsx`: no logic change — its children carry the treatment (HabitsPanel done in Task 4, DataPanel below, ThemePanel here).

`ThemePanel.tsx`: segmented active `text-white` (line ~22) → `text-[var(--color-on-accent)]`; the panel's outer wrapper gains `glass-card p-4 mb-4`; description/labels untouched.

`DataPanel.tsx`: root `<section className="mt-6">` → `<section className="mt-6 glass-card p-4 mb-4">`; Export/Import/Cancel/reset-trigger buttons (`border border-[var(--color-line)] rounded-2xl/rounded-xl px-* py-*`) → add `btn-glass` and drop only the duplicated `rounded-* border border-[var(--color-line)]` pieces (keep size/text utilities); **`Yes, reset` keeps `bg-red-600 text-white`** (semantic destructive); message line untouched.

- [ ] **Step 4: Run tests to green**

Run: `npm test -- NoteScreen.test DataPanel.test` → PASS; full `npm test`.

- [ ] **Step 5: Gates + commit**

Gates in order. Commit exact staging: `feat(screens): glass note, settings, and data screens (D)`.

---

### Task 7: Verification — both themes, motion, a11y, first-timer flow (spec V1–V9)

**Files:** none expected; fixes only if V finds defects (each fix batch = one `fix(d): …` commit with its own gates + a regression test where the defect was testable).

- [ ] **Step 1: Production build + server**

Run: `npm run build`, then `npm run start` (background shell; port 3000 — stop any stale server first).

- [ ] **Step 2: V1 dark pass**

Open `/today`. Verify: blobs drift behind frosted rail/cards (dark `#100d0a` canvas + amber/sienna glow), rows are neutral glass with color only in the wash, spec shimmer on stat-tile hover, toast appears as neutral glass with amber check. Screenshot each screen (Today, Stats, Settings, Note, sheet, drawer, timer).

- [ ] **Step 3: V2 light pass**

Toggle Light: canvas `#f0ebe3`, pastel blobs, dark warm text, active tab = amber pill with near-black label; toggle System/Dark/Light live + reload persistence (existing theme tests cover logic; this covers pixels).

- [ ] **Step 4: V3 reduced-motion**

DevTools → Rendering → `prefers-reduced-motion: reduce`: blobs static, no reveal blur-in (content visible instantly), no shimmer sweep, toast still appears (motion-safe gate → instant).

- [ ] **Step 5: V4 reduced-transparency**

Emulate `prefers-reduced-transparency: reduce` → panels go near-solid and readable, no blur.

- [ ] **Step 6: V5 viewports**

375px (bottom glass bar, no overflow, tap targets ≥40px), 768px (icon rail), 1280px (labelled sidebar): no horizontal scroll, truncation sane, no clipped pills.

- [ ] **Step 7: V6 contrast sampling**

In both themes, evaluate computed styles for: row name, row subtext, active tab, primary button label, secondary text, input placeholder → compute WCAG ratios against sampled backgrounds (brightest blob region). All ≥4.5:1 (accent-ink light ≥4.5, on-accent ≥4.5). Fix any miss with a token adjustment + globals.test pin, then re-run gates.

- [ ] **Step 8: V7 interaction smoke (A2 protocol)**

Check button completes + toasts; undo never re-fires; stepper caps at target; ring opens ValueSheet; no-op save silent; timer full duration → toast **above** the sheet; partial session silent; NoteScreen checkbox celebrates; theme switch live; keyboard: Tab reaches every control with the amber focus ring, Escape closes sheets, focus returns to opener.

- [ ] **Step 9: V8 first-time-user flow review**

Clear `localStorage` + IndexedDB, reload → `/` → `/today` empty state (`No habits yet — create one.`) → create a habit (form glass check) → complete it (celebration) → Stats (tiles/heatmap) → Settings (panels/theme). Judge as a first-timer: does it *look* like designed glass, does motion feel smooth, anything broken/ugly? Fix findings (test where testable) → gates → `fix(d): …` commit.

- [ ] **Step 10: V9 perf sanity + network**

Scroll Today with blurred rows — no visible jank; DevTools network shows only local `.woff2` (no googleapis/gstatic). Confirm final counts: tests ≥ 360 all green, typecheck clean, lint 2-warning baseline, build succeeds.

- [ ] **Step 11: Report**

Summarize for the user: screenshots/observations per V-step, final gate numbers, commit list (`f79a8ee` spec → 6 task commits [+ fixes]).
