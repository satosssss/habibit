# Habibit

Local-first habit tracker. No account, no server, no analytics — every habit and
entry lives in your browser's IndexedDB via Dexie.

## Develop

    npm install
    npm run dev

Works identically on Windows and macOS (only `npm run …` scripts; no shell-specific tooling).

## Test

    npm test          # Vitest (unit + component)
    npm run typecheck # tsc --noEmit

## Deploy

    npx vercel deploy

Zero config: there is no backend, database, or environment to provision.

## Data

- **Today** groups habits by *category* (Morning / Health / Evening).
- **Stats** and the daily note group and color-code by *intention*.
- Settings → Data exports/imports JSON and can reset to the seeded examples.
