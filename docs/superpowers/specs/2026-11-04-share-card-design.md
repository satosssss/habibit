# Share card — design (sub-project C)

Date: 2026-11-04
Status: binding for implementation
Depends on: challenges (A) and badges (B) for the badge count. Uses the same
stats engine as Insights.

## Goal

Let the user turn a year of Habibit into a single PNG they can post or send:
generated locally, shared through the OS share sheet where available, and
downloadable everywhere. Zero cost, no accounts, no server.

## Non-goals

- No public links, uploads, or OG image hosting (that is sub-project D).
- No habit names, notes, or per-entry timestamps on the card (aggregates only).
- No template picker, custom colours, or editable copy.
- No new runtime dependencies; Canvas 2D only.
- No server rendering; the image is built in the browser.

## Decisions

- **Year in review**, for the year currently selected in Insights. A past year
  renders the full calendar year; the current year renders Jan 1 → today.
- **Fixed dark brand card**, independent of the app theme, so the artifact reads
  the same on every social feed. This is the one place the light theme does not
  apply.
- **Native share + download**: one primary action. If
  `navigator.canShare({ files })` is true, share the PNG; otherwise download it.
  When sharing is available, Download stays as a secondary action.
- Card is **1080 × 1350** (4:5 portrait), 1× — already high-resolution.

## R1 — Pure model (`src/lib/shareCard.ts`)

`shareCardModel({ habits, entries, badges, year, today })` returns:

```ts
interface ShareCardModel {
  year: number;
  activeDays: number;
  perfectDays: number;
  completions: number;
  ratePct: number;          // 0–100, rounded
  longestStreak: number;    // longest run inside the year window
  earnedBadges: number;     // known badge ids only
  totalBadges: number;      // BADGES.length
  cells: HeatCell[];        // heatmapCells(year, …) — 371-ish cells
  months: { label: string; column: number }[];  // monthLabelPositions(year)
}
```

- Year window: `{ from: '${year}-01-01', to: year === currentYear ? today : '${year}-12-31' }`.
- Stats come from `buildDayStats` + `completionRate` / `countActiveDays` /
  `countPerfectDays` / `sumCompletions` / `longestStreak`. Never reimplement a
  rule.
- Heatmap comes from `heatmapCells(year, habits, entries, today)`; month columns
  come from `monthLabelPositions(year)`. The model computes neither itself.
- `earnedBadges` counts stored ids that exist in `BADGES`; unknown ids are
  ignored (forward compatibility, badges R3). Badge count is all-time, matching
  the Insights "X of 16 earned" line.
- `ratePct = Math.round(rate * 100)`; empty data yields 0, not NaN.
- Pure: no React, no Dexie, no DOM. Deterministic for fixed inputs.

## R2 — Canvas renderer (`src/lib/shareCardCanvas.ts`)

- Exports `CARD_WIDTH = 1080`, `CARD_HEIGHT = 1350`,
  `drawShareCard(ctx, model)`, `renderShareCard(model, doc = document): Promise<HTMLCanvasElement>`,
  `shareCardBlob(canvas): Promise<Blob>`.
- `drawShareCard` only touches the context it is given (no DOM lookups, no
  async), so it is testable with a recording fake. Rounded panels use a local
  path helper rather than `ctx.roundRect` (older Safari).
- `renderShareCard` creates a canvas at the fixed size, awaits
  `doc.fonts?.ready` when present, then draws. If `getContext('2d')` is null it
  throws `new Error("This browser can't create the image.")`.
- `shareCardBlob` wraps `canvas.toBlob(..., 'image/png')` and rejects when the
  callback receives null.
- Fixed palette (dark tokens, literals by design):
  - background `#100d0a` → `#171009` gradient, amber/teal radial glows at low alpha
  - foreground `#fff8f0`; subtle `rgba(255,235,210,0.60)`
  - accent `#f59e0b`
  - heatmap `#2b2119` (empty) and `#2e2115`, `#55350f`, `#82500f`, `#b06a0d`, `#f59e0b`
- Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; no web
  fonts (offline, zero cost). Text is short enough that no wrapping is needed.
- Layout, top to bottom (72 px side margins):
  1. Header: `HABIBIT` left, `YEAR IN REVIEW` right.
  2. Hero: the year at ~148 px, subtitle `A year of showing up.`
  3. 2 × 2 stat panels: Active days, Perfect days, Completions, Completion rate.
  4. Streak band: `LONGEST STREAK` + `N days`; right side `X / 16 badges`.
  5. Heatmap: month labels + a 53-column day grid using the model's levels;
     out-of-year cells are transparent, future cells use the empty colour.
  6. Footer: `Made with Habibit`.
- No emoji, no icon fonts, no network fetches. Colour is never the only carrier
  of meaning: every heatmap level is backed by the numeric summary above it.

## R3 — Share sheet (`src/components/ShareCardSheet.tsx`)

Props: `{ open, onClose, habits, entries, year, today }`. Badges are loaded
inside with `useLiveQuery(() => listBadges(), [])` so the sheet stays
self-contained.

- Renders the existing `Sheet` (title "Share your year", `centerFrom="md"`).
- On open: build the model, render the canvas, create an object URL, show it as
  `<img alt="Your {year} Habibit year in review">` at `max-w-full`, plus a text
  summary for screen readers (active days, perfect days, completions, rate).
- Actions:
  - Primary `Share` when `navigator.canShare?.({ files: [file] })` is true;
    otherwise primary `Download PNG`.
  - `Download PNG` secondary whenever Share is shown.
  - Both are `btn-glass`/`btn-primary` style, ≥ 40 px, icons `aria-hidden`.
- Download: anchor with `download="habibit-{year}.png"`, click, revoke URL.
- Share: `navigator.share({ files: [file], title: 'Habibit {year}' })`.
  `AbortError` is silent (the user cancelled); any other failure shows an alert.
- Generation failure (no 2D context, blob null): `role="alert"` with
  `Couldn't create the card. Try again.` and disabled actions.
- Status line `role="status"`: `Card downloaded.` / `Card shared.`
- Closing or unmounting revokes the object URL. Re-opening regenerates (data may
  have changed).
- No focus movement beyond the Sheet's own trap; no new modal stack.

## R4 — Insights entry point

- `Share card` button in the "Year stats" heading row, right-aligned
  (`flex items-center justify-between`), so it is tied to the selected year.
- Text label plus `Share2` icon (`aria-hidden`); 40 px minimum height.
- Opens `ShareCardSheet` with `habits`, `allEntries`, `year`, `today`.
- The button only exists on the loaded screen (the early return already covers
  loading).

## R5 — Accessibility

- Sheet provides focus trap and focus return; the share sheet adds no new
  dialog primitive.
- Preview image has a year-specific alt; the numeric summary is real text.
- Status messages are polite; errors are `role="alert"`.
- Buttons carry text labels; the icon alone is never the label.
- Heatmap on the card is decorative duplication of the summary — no ARIA needed
  inside the PNG.

## R6 — Privacy and cost

- Only aggregate numbers leave the device; no habit names, categories,
  intentions, notes, or entry timestamps.
- No network request is made to build or download the card.
- Canvas, Blob, and Web Share are platform features — zero marginal cost.

## R7 — Tests

- `src/lib/shareCard.test.ts`
  - current year uses Jan 1 → today; a past year uses the full year
  - rate rounding and zero-data (no habits/entries) behaviour
  - longest streak is scoped to the year
  - badge count counts known ids only and ignores unknown ids
  - cells length matches `heatmapCells`; months match `monthLabelPositions`
- `src/lib/shareCardCanvas.test.ts`
  - fixed canvas dimensions; key labels/values are drawn (`2026`, `ACTIVE DAYS`,
    `11 / 16 badges`)
  - one `fill` per in-year heat cell; out-of-year cells skipped
  - null context → the documented error; blob rejection when `toBlob` yields null
- `src/components/ShareCardSheet.test.tsx`
  - open renders the preview with the year alt and summary
  - download path creates an anchor named `habibit-{year}.png` and revokes the URL
  - share path is used when `canShare` is true; cancel (`AbortError`) is silent
  - generation failure shows the alert and disables actions
  - buttons meet the 40 px minimum
- `src/components/InsightsScreen.test.tsx`
  - the `Share card` button is present and opens the sheet
- Gates: `npm test`, `npm run lint` (0 errors, no new warnings),
  `npm run typecheck`, `npm run build`.

## R8 — Browser pass

- Desktop: open the sheet from Insights, verify the preview, download the PNG,
  and confirm `createImageBitmap` reports 1080 × 1350.
- Confirm the share path is skipped when `navigator.canShare` is unavailable and
  the download path still works.
- 320 px: sheet content does not overflow; preview scales down.
- Reduced motion: the sheet has no entrance animation to disable.
