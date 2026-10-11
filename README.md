# Habibit

Local-first habit tracker. No account, no server, no analytics — every habit and
entry lives in your browser's IndexedDB via Dexie.

Which means it's fast, it's private, and no server will ever send you a
disappointed email about the Tuesday you skipped.

## ⚠️ The one warning that matters

Your habits live in **this browser, on this machine**. Clearing site data,
clearing cookies, browsing in a private window, or opening the app in a
*different* browser all mean the same thing: everything is gone. There is no
cloud, no account, and no "forgot my password" — because there is no password.

Until automatic backups land (slice 1b), **Settings → Data → Export JSON** is
your backup. Export it whenever the data starts to matter. Future you is a
real person.

## Run it

    npm install
    npm run dev        # http://localhost:3000

    npm test           # Vitest (unit + component)
    npm run typecheck  # tsc --noEmit
    npm run lint       # next lint
    npm run build      # production build

Node **18.18+** (Next.js 15's floor — everything here is developed and tested
on Node 24). Works identically on Windows and macOS: only `npm run …` scripts,
no shell-specific tooling.

## Deploy

Production: **https://habibit-five.vercel.app/today** — Vercel, production
branch `main`.

    npx vercel deploy

Zero config: there is no backend, database, or environment to provision.

> **One stable URL, forever.** Her data is tied to the site's origin, so this
> is the production URL to give her — never a preview URL, and no domain
> change later without an export/import step first.

## What's in the box

- **Today** — check habits off, grouped by *category* (Morning / Health / Evening).
- **Calendar** — a month grid with per-day markers: perfect, partial, missed, and streak break.
- **Stats** — streaks, a year-at-a-glance activity heatmap, per-*intention* breakdowns, plus trend charts: streak growth, consistency, and when you show up.
- **Coach** — reads your rhythm and nudges: trim a slipping habit, move a reminder, stack a habit, level up, celebrate a streak.
- **Settings** — data export/import, theme, and Reset data (erases everything back to an empty app).

## Stack

Next.js (App Router) + React + Tailwind CSS; Dexie over IndexedDB for storage;
Vitest + Testing Library for tests; lucide-react for icons. No backend, no
database to provision, no environment variables to lose sleep over.

### src/ map

| Path | What lives there |
|---|---|
| `src/app/` | Routes: `/today`, `/today/[date]`, `/stats`, `/settings` |
| `src/components/` | The UI: habit rows, heatmap, stat tiles, modals, nav shell |
| `src/lib/` | The brains: dates, streaks, stats, coach, seed data, Dexie repo |
| `src/test/` | Test setup |

## Docs & roadmap

Design specs live in `docs/superpowers/specs/`, implementation plans next to
them in `docs/superpowers/plans/`. The work ships in small slices — currently
slice **1a** (bug fixes), followed by storage safety/backups, celebrations,
onboarding, and retention.

## Credits

The UX is inspired by **Grit**. This is a personal project — not affiliated
with, endorsed by, or connected to Grit in any way.
