# Share card — implementation plan

Spec: `docs/superpowers/specs/2026-11-04-share-card-design.md`

## Task 1 — Pure model
- Add `src/lib/shareCard.ts`: `shareCardModel`, `ShareCardModel`, month indices.
- Add `src/lib/shareCard.test.ts`: year windows, rate rounding, year-scoped
  streak, badge counting (known/unknown), empty data, heatmap/month alignment.

## Task 2 — Canvas renderer
- Add `src/lib/shareCardCanvas.ts`: constants, `drawShareCard`, `renderShareCard`,
  `shareCardBlob`, local rounded-panel helper, fixed dark palette.
- Add `src/lib/shareCardCanvas.test.ts` with a recording 2D-context fake:
  dimensions, labels/values, heat-cell fills, null-context and null-blob errors.

## Task 3 — Share sheet
- Add `src/components/ShareCardSheet.tsx`: Sheet wrapper, preview, summary,
  download, native share with fallback, status/alert, URL cleanup.
- Add `src/components/ShareCardSheet.test.tsx`: preview/alt, download, share,
  cancel, failure, tap targets.

## Task 4 — Insights wiring
- Add the `Share card` button to the Year stats heading row and mount the sheet.
- Extend `InsightsScreen.test.tsx`: button present, opens the sheet.

## Task 5 — Gates and live pass
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Browser: open from Insights, verify preview + download (1080 × 1350),
  fallback path without Web Share, 320 px layout.
