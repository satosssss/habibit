# Slice D — Glassmorphism design system (full visual restyle)

Date: 2026-09-30 · Status: awaiting spec review · Predecessors: slice A (`2f8e8a4`), slice A2 (`db85bcf`)

## Context

Slice D of the user's expansion brief: "apply the glassmorphism design" using two attached docs as method + spec of record — `SKILL.md` (glassmorphism-design skill) and `DESIGN.md`. Both read in full; where they state exact values, they are record of truth.

Approved conversational decisions (this session):

- **Approach A** — token-first layered passes (foundation → chrome → today → overlays → screens), not screen-by-screen, not big-bang.
- **SKILL Step 1 choices:** Ember & Slate palette (dark default) + Light Liquid Glass via the existing System/Light/Dark toggle (both modes full); Frosted transparency; animated blob background (static under reduced-motion); Modern Geometric typography (Outfit + DM Sans) **vendored locally** (house ban on runtime CDNs ⇒ `next/font/local`, no Google Fonts link); **Subtle** animation tier (scroll reveal, hover lift, shimmer sweep, button press, focus glow, skeleton shimmer, blob float) + every DESIGN.md a11y fallback; **Expressive-only 3D tilt excluded** (house brief: restrained micro-interactions).
- Design sections 1–4 (foundation / per-screen / states-a11y / testing) presented and approved.

Corrections applied vs. the chat summary (source docs win): blobs are **650/450/350 px at `blur(90px)`**, light base is **`#f0ebe3`**, and the completion toast is **neutral** glass — the skill's core rule forbids tinted glass fills; the amber lives in the check icon.

Post-approval factual fixes (codebase reality): the app has **no landing page** (root `/` redirects to `/today`), so DESIGN's hero clamp is unused; fonts ship as **two variable `.woff2` files** (each covering the 700/800 and 400/500 weights) rather than four static ones.

Behavior is frozen: 347 tests green, same interaction model as A2 (check/steppers/ring/timer/toast), no new runtime dependencies, no network calls. This slice changes how the app looks, never what it does.

## R1 — Token system (bridged, both themes)

Existing `--color-*` names stay as the API; values move to the glass palette. Roles verified against current usage.

| Token (role) | Dark (Ember & Slate) | Light (Liquid Glass) |
|---|---|---|
| `--color-bg` (canvas) | `#100d0a` | `#f0ebe3` |
| `--color-fg` (primary text) | `rgba(255,248,240,0.95)` | `rgba(20,16,12,0.90)` |
| `--color-subtle` (secondary text) | `rgba(255,235,210,0.60)` | `rgba(20,16,12,0.55)` |
| `--color-muted` (hover/surface tint) | `rgba(255,255,255,0.13)` | `rgba(255,255,255,0.62)` |
| `--color-panel` (ad-hoc surface) | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.45)` |
| `--color-line` (plain hairline) | `rgba(255,255,255,0.12)` | `rgba(20,16,12,0.10)` |
| `--color-accent` (fills, bars, rings) | `#f59e0b` | `#f59e0b` |
| `--color-accent-ink` **(new** — accent-colored *text*) | `#f59e0b` | `#b45309` |
| `--color-on-accent` **(new** — text/icon on amber fills) | `#0f0e0c` | `#0f0e0c` |

Why the two new tokens: amber as text on light surfaces fails AA (≈2.1:1), and white on amber fails (≈2.2:1). Every `text-white`-on-accent site found by audit migrates to `--color-on-accent`; every accent-colored *label/link* migrates to `--color-accent-ink` (it stays `--color-accent` for bars/rings/fills, which are non-text). Known sites: `DateStrip` selected pill, `HabitForm` active swatches + submit, `HabitsPanel` add pill, `MenuDrawer` segmented control, `NavShell` active states, `CategorySection` circle.

Glass tokens (new, per skill Step 4, exact): `--glass-bg` (dark `rgba(255,255,255,0.08)` / light `rgba(255,255,255,0.45)`), `--glass-bg-hover` (0.13 / 0.55), `--glass-border` (0.12 / `rgba(255,255,255,0.60)`), `--glass-border-hover` (0.22 / 0.75), `--glass-blur` (`blur(20px) saturate(180%)` / `blur(24px) saturate(200%)`), `--glass-specular` (dark `0 1px 0 0 rgba(255,255,255,0.20) inset` / light `0 2px 0 0 rgba(255,255,255,0.80) inset, 0 -1px 0 0 rgba(0,0,0,0.06) inset`), `--glass-shadow` (dark `0 12px 40px rgba(0,0,0,0.35)` / light `0 8px 32px rgba(0,0,0,0.12)`), `--glass-shadow-hover` (dark `0 20px 60px rgba(0,0,0,0.50)` / light `0 12px 40px rgba(0,0,0,0.16)`), `--blob-1..3` (dark `#f59e0b`/`#c2410c`/`#78350f`, light `#a78bfa`/`#5eead4`/`#fb923c`), `--glass-fallback` (dark `rgba(20,16,12,0.90)` / light `rgba(240,235,227,0.96)`).

Heatmap `--hm-*` retunes from indigo to a warm amber ramp (names unchanged; meaning carried by scale + legend + aria, never hue alone):

- dark: empty `#1c1510`, 0 `#2e2115`, 1 `#55350f`, 2 `#82500f`, 3 `#b06a0d`, 4 `#f59e0b`
- light: empty `#f4eee4`, 0 `#fbe8cd`, 1 `#f7d6a6`, 2 `#f2bc71`, 3 `#eaa23c`, 4 `#d97706`

Color rules (skill core): glass fills are white-neutral `rgba(255,255,255,N)` only — never tinted; no glowing/pulsing accent borders anywhere; body/placeholder text never uses a sub-0.55-alpha token (placeholders use `--color-subtle`).

## R2 — Typography (vendored)

- Outfit (variable, 100–900) and DM Sans (variable) as `.woff2` files in `src/app/fonts/` — two files covering the required 700/800 and 400/500 weights — loaded via `next/font/local` with CSS variables wired on `<body>` in `layout.tsx`. No `<link>` to any CDN, no runtime font fetch (the one-time authoring download happens during implementation, like `npm install`). Test asserts both files exist and no `fonts.googleapis|fonts.gstatic` string appears in source.
- Body everywhere = DM Sans (`--font-body`); `h1/h2/h3`, the wordmark, and stat-tile numerals = Outfit (`--font-display`) with the spec's tight tracking (`-0.02em` h1, `-0.01em` h2).
- **App-scale adaptation:** the app has no landing page (root `/` redirects to `/today`), so DESIGN's hero `clamp()` is unused; in-app headings keep current visual sizes, just in Outfit (h1 ≈ 1.875–2rem/800, h2 ≈ 1.375rem/700, h3 ≈ 1.0625rem/600) — a full hero scale would swallow screen headers.

## R3 — Background scene

New `src/components/BackgroundScene.tsx` (presentational, no state), mounted as the **first child of NavShell's root div** (verified: that div creates no stacking context):

- Container `.bg-scene`: `position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; aria-hidden="true"`, background = dark gradient `#100d0a → #1c1510` (light: flat `#f0ebe3`). `z-index: -1` paints above the html canvas and below all content — content needs no z-index changes.
- Three `.blob` circles per skill: 650px (`top:-180px; left:-180px`, delay 0), 450px (`bottom:-120px; right:-120px`, delay -4s), 350px (`top:45%; left:45%`, delay -7s); `border-radius: 50%; filter: blur(90px); opacity: 0.55`; background from `--blob-1..3`.
- `@keyframes blob-float`: 10s ease-in-out infinite, **transform only** (translate + scale), `will-change: transform`. Under `prefers-reduced-motion: reduce` → `animation: none` (static composition, same colors).
- NavShell's rail, bottom bar, and any other chrome that currently carries `bg-[var(--color-bg)]` drop it (the canvas stays on `html, body`) so the scene shows through glass.

## R4 — Glass utilities, fallbacks, motion CSS (all in `globals.css`)

`@layer components` classes (Tailwind v4 CSS-first, no config file):

- **`.glass-card`** — frosted: `--glass-bg` + `--glass-blur` + 1px `--glass-border` + `--glass-specular` + `--glass-shadow`, radius 20px, `position: relative; overflow: hidden`; hover → `--glass-bg-hover`, `--glass-border-hover`, `--glass-shadow-hover`, `translateY(-4px)` spring `cubic-bezier(.34,1.56,.64,1)`; `::after` shimmer sweep (skewed white gradient, 0.65s) on hover. Standalone panels only (stats tiles, settings/note/data cards, category sections, landing cards).
- **`.glass-row`** — same frosting minus lift/shimmer (dense lists must not jump under the cursor); hover only brightens fill/border.
- **`.glass-nav`** — persistent chrome: fill `rgba(255,255,255,0.06)` dark / `rgba(255,255,255,0.55)` light, `blur(24px) saturate(180%/200%)`, border-bottom only + top inset specular, **no drop shadow** (DESIGN). Vertical variant swaps border-right for the rail.
- **`.glass-heavy`** — overlays (Sheet body, MenuDrawer): Heavy level per skill scale — fill 0.20 dark / 0.70 light, `blur(14px) saturate(160%)`, border 0.20 / 0.75, shadow `0 20px 60px rgba(0,0,0,0.40)` dark.
- **`.glass-menu`** — drawer items: fill 0.10 / 0.60, `blur(28px) saturate(200%)`, border 0.14, inset specular 0.18, item hover row highlight, divider hairlines.
- **`.glass-input`** — pill (999px), fill 0.06 / 0.55, `blur(12px)`, border 0.12 / 0.60; focus → border 0.30 + `0 0 0 3px rgba(255,255,255,0.06)` ring + specular (extends, never replaces, the global focus-visible outline pinned by `globals.test`).
- **`.btn-primary`** — solid amber pill, `--color-on-accent` label (see R1 contrast), `0 4px 20px rgba(0,0,0,0.25)` shadow; hover `translateY(-2px)` + `brightness(1.1)`; active `translateY(1px) scale(.97)` at 0.08s.
- **`.btn-glass`** / **`.glass-pill`** — secondary glass pill; `.glass-pill` also covers small chips/badges (glass fill, hairline border, muted text).
- **`.skeleton`** — glass panel + diagonal shimmer sweep (`skeleton-sweep` 1.8s linear infinite). Applied *around* existing loading copy; the `Loading…` text itself is untouched (tests assert it).
- **`.reveal`** — starts `opacity:0; translateY(24px); blur(8px)`, `.visible` → in place; spring 0.7s; stagger via `nth-child` delays (skill).
- Radius discipline: cards 20px, panels/sheets 28px, buttons/inputs/badges 999px, always 1px borders (never 0).

Fallbacks (all three, per skill Step 8):

```css
@supports not (backdrop-filter: blur(1px)) { /* all glass classes: solid var(--glass-fallback), no blur */ }
@media (prefers-reduced-transparency: reduce) { /* same, var(--glass-fallback) raised to 0.94/0.98, backdrop-filter: none */ }
@media (prefers-reduced-motion: reduce) { /* .reveal visible, .blob animation none, skeleton static, lift/press transitions instant */ }
```

Both `-webkit-backdrop-filter` and `backdrop-filter` everywhere. Guardrail: never more than three stacked backdrop-filter layers on any pixel path (rows sit on the scene; an overlay adds backdrop + panel = 3 max); backdrop-filters are never animated.

## R5 — Chrome (NavShell, banners, toast)

- Rail + bottom tab bar → `.glass-nav` (rail: border-right variant). Active tab = accent pill with `--color-on-accent` label (rail) / `--color-accent-ink` label (bottom bar, where no pill sits under it); inactive = `--color-subtle`, hover `--color-muted`. Wordmark: flame inline in `--color-accent`, text in Outfit.
- `WriteErrorBanner` + NavShell storage alert → `.glass-card` warning treatment: `role` semantics unchanged, **icon** (lucide, `--color-accent-ink`) carries the warning signal — no colored borders (glow rule).
- `CompletionToast` → neutral `.glass-card` frosting; all pinned classes preserved exactly (`pointer-events-none` wrapper, `z-[60]`, `motion-safe:animate-[toast-in_200ms_ease-out]`, testid, `role="status"`, copy). Check icon stays `--color-accent`.

## R6 — Today (rows, date strip, sections)

**HabitRow** (signature surface):

- `li` → `.glass-row`, radius 20px; habit color is **contained to content** — the row chrome is neutral glass.
- Fill (`data-testid="habit-fill"`, kept) → decorative gradient wash `rgba(habit.color, 0.40) → rgba(habit.color, 0.10)` (via the existing `rgba()` util), implemented as `width:100%` + `transform: scaleX(ratio)` + `transform-origin: left`, `transition: transform 300ms ease` (skill rule: animate transform, never layout) and `aria-hidden="true"` (the ring + x/y subtext are authoritative). Tests pinning `style.width` update to the transform consciously.
- Text → `--color-fg` name / `--color-subtle` subtext (fixes today's white-on-pale-tint light-mode problem). Contrast of theme text over the ≤0.40 wash verified in both themes (V6).
- Avatar circle = solid habit color + white glyph — **documented deviation** from the skill's "no icon boxes": it is the habit's identity chip (content, like an app icon), not a decorative container; all other icons stay inline stroke (lucide, 1.5–2px, `currentColor`).
- Check button: not-done → glass pill, `--color-subtle` glyph; done → solid `--color-accent` with `--color-on-accent` check. aria-labels byte-identical to A2 (frozen).
- Steppers → glass pills, habit-color glyphs (labeled controls — exempt from non-text contrast); ring track → neutral `--color-line`-equivalent, ring glyphs → `--color-fg` (white would vanish on light glass). Ring/stepper behavior untouched.
- `FlameBadge` → `.glass-pill`, amber flame + `--color-fg` count; keeps pinned `pointer-events-none` + position.
- `DateStrip`: cells stay `h-11 w-11 rounded-full` (the pinned classes); selected → accent fill + `--color-on-accent` text + existing ring; today-underline → `--color-accent`; unselected labels → `--color-subtle`.
- `CategorySection` panel → `.glass-card`; headers stay uppercase tracking-widest in `--color-subtle`; the round counter → glass pill in `--color-accent-ink`. `IntentionBar` track → `--color-muted`.
- Whole-category layout, control order, and every aria-label unchanged.

## R7 — Overlays (sheets, drawer, forms)

- `Sheet` primitive → `backdrop-blur` scrim + `.glass-heavy` body, radius 28px, handle hairline (ValueSheet, TimerModal inherit; their controls/typography per R4 — digits stay tabular). Z-order frozen: Sheet/TimerModal stay z-50, toast stays z-60 above them (A2-proven).
- `MenuDrawer` → `.glass-menu` heavy blur-28, items as skill's menu rows, dividers; theme segmented control keeps structure with accent + `--color-on-accent` active.
- `HabitForm` + `Combobox` inputs → `.glass-input` pills (focus ring per R4); color swatches keep habit colors (content), selected = accent ring + `--color-on-accent` check, never color alone. Submit → `.btn-primary`; Cancel/ghost → `.btn-glass`.
- `HabitsPanel`/`HabitList` rows → `.glass-row` cards, drag handle + arrows as inline glyphs.

## R8 — Screens (stats, note, settings, data, landing)

- `StatsScreen` tiles → `.glass-card` (hover lift + shimmer), numerals Outfit, bars/weekly cells read `--color-accent` (auto-amber), heatmap warm ramp + existing legend.
- `NoteScreen`: quote → `.glass-card` blockquote (no accent border), intention groups → `.glass-card`, checkboxes → glass circle + accent check, compact heatmap warm ramp, loading copy + skeleton.
- `SettingsScreen` → `.glass-card` sections; danger actions stay `.btn-glass` with explicit text labels (confirmation flows untouched).
- `DataPanel` → `.glass-card`, import/export buttons + Cancel per R4.
- `SettingsScreen` itself is a thin wrapper (header + `HabitsPanel` + `ThemePanel` + `DataPanel`) — its panels above carry the treatment; the theme segmented control goes `--color-on-accent`.

## R9 — Motion application

- New `src/lib/useReveal.ts`: ref callback + IntersectionObserver (threshold 0.12) adding `visible`, unobserving after reveal, cleaning up on unmount; **guards `typeof IntersectionObserver === 'undefined'`** → adds `visible` immediately (jsdom has no IO — this is what keeps the suite green).
- Applied to: category sections (Today), stat tiles, settings/data/note panels — **not** to individual habit rows (density + observer churn).
- Hover scope: lift + shimmer on `.glass-card` only; `.glass-row` gets fill/border brighten. Buttons press, inputs focus-glow, skeletons shimmer, blobs float. Nothing pulses, nothing glows, no 3D tilt. Every animation is transform/opacity (except the existing toast entrance, untouched).

## R10 — States, responsive, a11y

- **State matrix (uniform):** hover (brighten + lift where `.glass-card`), active/press (0.98 spring), focus-visible (existing global outline — pinned by tests — plus input ring), disabled (existing `disabled:opacity-40`, no pointer events), selected (accent pill / `aria-current`), loading (skeletons keeping `Loading…`), error (icon + text on glass warning), empty (existing copy: "No habits yet…", "Nothing scheduled…").
- **Responsive:** mobile = single column + glass bottom bar (current structure, 375px base); ≥768px icon rail; ≥1280px labelled sidebar; scene is viewport-fixed (no per-breakpoint work); truncation behavior unchanged; tap targets stay ≥40px (h-11 date cells, h-10 controls).
- **Contrast (WCAG AA, sampled in V6):** fg ≥4.5:1 and subtle ≥4.5:1 on glass over the *brightest* blob region in each theme; `--color-accent-ink` light on `#f0ebe3` ≥4.5:1; `--color-on-accent` on `#f59e0b` ≥4.5:1 (≈9.3:1 expected); disabled exempt but legible.
- **Never color-only:** done = check icon + ring + x/y text + aria-label; heatmap = legend + aria; selected = fill + ring weight; warning = icon + role.
- Reduced-motion / reduced-transparency / no-backdrop-filter all per R4; keyboard reaches every control; focus never moves to the toast (frozen).

## R11 — Out of scope

- Any behavior, copy, or state-machine change (B onboarding, C rewards, XP — those remain queued slices after D).
- 3D tilt, pulsing glows, colored glass tints, alternate palettes (Ocean Frost etc.), image backgrounds.
- New dependencies (fonts are files, not packages); runtime network of any kind.
- Google Fonts `<link>`, emoji, icon fonts (lucide inline SVG stays).

## R12 — Testing (TDD — written and watched failing first)

- **`BackgroundScene.test.tsx` (new):** three `.blob` children, `aria-hidden`, `pointer-events-none`, fixed container; NavShell renders it exactly once.
- **`useReveal.test.ts` (new):** adds `visible` on intersect (mock IO), adds it immediately when IO undefined, unobserves/cleans up.
- **`globals.test.ts` (extended):** token values resolve per theme (existing computed-style pattern incl. `data-theme` switching); glass classes compute the right fill/border; `--color-accent-ink`/`--color-on-accent` exact values; fallback + reduced-motion + reduced-transparency blocks present (source-string assertions — jsdom can't evaluate `@supports`/media reliably); no CDN font string anywhere in `src/`.
- **Fonts:** fs existence test for the two `.woff2` files.
- **Per-component:** glass-class presence on NavShell rail/bar, CompletionToast, HabitRow, Sheet, HabitForm; updated pins: HabitRow fill `width → transform` assertions, any `text-white`-on-accent assertions move to `--color-on-accent`, `layout.test.tsx` body/font-classname assertions updated consciously with the font wiring. DateStrip's `h-11 w-11 rounded-full` pin and all A2 toast pins stay byte-identical.
- **Audit before starting:** grep every test for color/class assertions (done: fixture `#6366f1`s are habit *data* — unaffected; `Heatmap` "no `--hm-N` inline" assertion unaffected by value retune; `colors.test.ts` tests the util, not the theme).
- Gates per commit: `npm test` (347 baseline) → `npm run typecheck` → `npm run lint` (2-warning baseline) → `npm run build`. Updated assertions must be *rewritten*, never loosened.

## R13 — Commit groups (Approach A; gates before each; exact staging only)

1. `feat(theme): glass token system, utilities, fonts, and background scene (D)` — `globals.css`, `src/app/fonts/*`, `layout.tsx`, `BackgroundScene.tsx`, NavShell mount + tests.
2. `feat(chrome): glass navigation, banners, and completion toast (D)` — `NavShell`, `WriteErrorBanner`, `CompletionToast` + tests.
3. `feat(today): glass habit rows, date strip, and category sections (D)` — `HabitRow`, `TodayScreen`, `DateStrip`, `CategorySection`, `FlameBadge`, `ProgressRing`, `IntentionBar` + tests.
4. `feat(overlays): glass sheets, drawer, timer, and forms (D)` — `Sheet`, `ValueSheet`, `TimerModal`, `MenuDrawer`, `HabitForm`, `Combobox`, `HabitsPanel`, `HabitList` + tests.
5. `feat(stats): glass tiles and warm heatmap ramp (D)` — `StatsScreen`, `Heatmap` + tests.
6. `feat(screens): glass note, settings, and data screens (D)` — `NoteScreen`, `SettingsScreen`, `DataPanel` + `useReveal` panel applications + tests.

Never `git add .`; never stage `.opencode/` or `opencode.json`. Windows commit messages via `git commit -F` (UTF-8 no-BOM temp file).

## V — Verification (before calling D done; production build, both themes)

1. Dark pass: every screen + overlay, blobs visible through glass, spec shimmer/lift present.
2. Light pass + System/Light/Dark toggle live-switch + reload persistence.
3. `prefers-reduced-motion` emulation: blobs static, reveals instant, no shimmer/sweep motion; existing toast gate intact.
4. `prefers-reduced-transparency` emulation → solid fallback fills readable.
5. Viewports 375 / 768 / 1280: no overflow, nav forms correct, truncation sane.
6. Contrast sampling: computed fg/subtle/link/button colors vs. backgrounds in both themes → ratios ≥ targets (R10).
7. Interaction smoke = A2 protocol (check, steppers, ring → ValueSheet, timer → toast, undo, menu, theme switch) — behavior identical, only pixels changed.
8. **First-time-user flow review (spec requirement):** fresh profile (clear storage) → `/` redirect → empty Today (`No habits yet — create one.`) → create a habit → complete it → stats → settings, judging the design as a first-timer; fix findings.
9. Scroll perf sanity on Today (blurred rows): no visible jank.
