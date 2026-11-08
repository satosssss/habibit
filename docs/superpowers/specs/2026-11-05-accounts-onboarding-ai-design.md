# Accounts, onboarding, and AI suggestions — design (sub-project D)

Date: 2026-11-05
Status: binding for implementation
Depends on: B (badges) and C (share card) for the home screen it extends.

## Goal

Put a Google account in front of Habibit, capture a once-only profile, and turn
that profile plus recent history into 3–5 suggested habits — generated on the
device when the browser can, on the server otherwise — while keeping every
existing screen working offline.

## Non-goals

- No server-side habit storage. Habits, entries, badges and the profile stay in
  Dexie; the server sees only what one recommendation request needs.
- No multi-tenant row scoping in v1 (see D4).
- No push notifications, no email, no billing.
- No re-theme: the existing amber glass system is the house style.

## Decisions

- **D1 — Palette.** Keep the current tokens (`--color-accent: #f59e0b`, warm
  neutral surfaces, DM Sans + Outfit). The brief's "ink & moss" does not exist
  in this repo; the same brief also asks for consistency with the existing
  palette, so consistency wins.
- **D2 — Route names.** The app home moves from `/` to `/home`; `/` becomes a
  permanent redirect. Tabs, the date strip, and every test link follow.
- **D3 — Provider.** Server suggestions use Google Gemini's free tier through a
  plain `fetch` in a Route Handler. No SDK dependency, no key in the client.
- **D4 — Account isolation.** Login gates the app; Dexie stays device-scoped.
  The profile records the last account email, and Settings shows a warning when
  a different Google account signs in on the same browser (data is shared until
  the user exports and resets).
- **D5 — First-login routing.** Auth.js lands the user on `/welcome`, a client
  gate that reads the local profile: none → `/onboarding`, present → `/home`.
  The server cannot know, because the profile never leaves the device.
- **D6 — Profile store.** One row, `id: 'me'`, in a new Dexie `profile` table
  (v4). Recommendations are cached on the same row so "update profile" and
  "regenerate" invalidate together.

## R1 — Auth (NextAuth / Auth.js v5)

- `src/auth.ts` configures the Google provider, JWT sessions, `pages.signIn:
  '/login'`, and an `authorized` callback that allows `/login` and `/api/auth/*`
  and requires a session everywhere else.
- `middleware.ts` runs the callback for every non-asset path. Unauthenticated
  users are redirected to `/login` with `callbackUrl` preserved. `/api/*` is
  exempt so route handlers answer in JSON (`/api/recommend` returns 401 itself
  instead of an HTML redirect a `fetch` caller cannot read).
- The session exposes **only** `name`, `email`, and `image`. The `jwt` callback
  copies exactly those three fields off the Google profile and nothing else.
- `/login` renders a single "Continue with Google" button. A signed-in visitor
  is sent to `/welcome` instead.
- `/welcome` redirects: no profile → `/onboarding`; profile → `/home`.
- Signing out returns to `/login` and leaves local data in place.

## R2 — Profile record and schema v4

```ts
interface Profile {
  id: 'me';
  accountEmail: string | null;      // last Google account on this device
  lifestyle: {
    wakeTime: string; sleepTime: string; schedule: string;
    activityLevel: 'low' | 'moderate' | 'high';
    currentHabits: string; timeSinks: string;
  };
  goals: { items: string[]; timeframe: string; why: string };
  challenges: string;
  preferences: { reminderTime: string; tone: 'gentle' | 'direct' };
  skipped: boolean;                 // finished onboarding via "Skip"
  onboardedAt: number;
  updatedAt: number;
  recommendations: RecommendationCache | null;
}
```

- `db.version(4).stores({ profile: 'id' })` — additive, same rule as v2/v3.
- `saveProfile(patch, now)` merges over defaults, stamps `updatedAt`, and clears
  cached recommendations when any answer changed (not when only the cache did).
- Export/import/reset include the profile. Importing a legacy export without a
  profile clears it; a profile in the export is restored verbatim.
- `emptyProfile()` is the single source of defaults; every field is a string or
  an enum, never `undefined`, so the onboarding form never needs null checks.

## R3 — Onboarding

- Route `/onboarding`; one question group per screen, four screens:
  1. Lifestyle — wake, sleep, schedule, activity, current habits, time sinks.
  2. Goals — 1–3 goals, timeframe, why.
  3. Challenges — free text plus quick chips.
  4. Preferences — reminder time, coaching tone.
- Progress is text-first: `Step 2 of 4` plus a bar with
  `role="progressbar"`/`aria-valuenow`. No step is colour-only.
- `Back` / `Next` / `Save`, and `Skip` on every step. Skip saves what has been
  filled plus `skipped: true` and goes to `/home`.
- Goals require at least one non-empty item; everything else is optional.
- Editing reuses the same screen: when a profile already exists the screen
  prefills it, starts on step 1 with a `Cancel` back to `/settings`, and says
  "Save changes".
- Empty state: with no profile, `/home` still works and the suggestions section
  explains that completing the profile enables suggestions.

## R4 — Recommendations

- `RecommendationCache` = `{ generatedAt, dataThrough, source, suggestions }`,
  `source: 'server' | 'on-device'`; max 5 suggestions.
- Each suggestion: `{ id, name, reason, suggestedTime, firstStep }`.
- `recommendationsStale({ cache, profileUpdatedAt, latestEntryDate, now })` is
  true when there is no cache, the profile changed after generation, or new
  entries exist at least 7 days beyond `dataThrough`.
- Generation order: on-device (mobile + available) → server → error with retry.
  A failed on-device attempt falls through to the server.
- Home shows 3–5 cards: name, reason, suggested time, first step, and
  `Add to my habits`, which opens the existing `HabitForm` prefilled. Added
  suggestions are disabled and the habit appears in today's list immediately.
- Regenerate button; generation state is announced (`role="status"`), failures
  as `role="alert"`.
- Privacy line on the section: the profile stays on the device; only goals,
  routine, and completion counts are sent.

## R5 — Prompt contract

`buildRecommendationPrompt(input)` is pure and shared by both paths:

- Input: profile (lifestyle, goals, challenges, preferences) and a history
  summary (last 14 days: active days, completions, rate, existing habit names).
- Excludes email, name, avatar, and any entry timestamps.
- Output: a system line (role, tone, "3–5 habits, JSON only") plus the user
  prompt. The server adds Gemini's `responseSchema`; the device adds an explicit
  JSON skeleton because the Prompt API has no schema option.
- `normalizeSuggestions(value)` trims, drops empty names, dedupes case-
  insensitively, caps at 5, and rejects anything that is not an array of
  objects. Both paths use it, so a malformed model response cannot reach the UI.

## R6 — Server route

- `POST /api/recommend` in `src/app/api/recommend/route.ts`.
- Requires a session (`auth()`), returns 401 otherwise.
- Body is validated: strings trimmed and capped (2 000 chars), habit names
  capped at 50, arrays capped at 10. Invalid input → 400 with a message.
- Missing `GEMINI_API_KEY` → 503 with a clear message; the client shows it.
- Model from `GEMINI_MODEL` (default `gemini-3.5-flash`). Request asks for JSON
  via `responseMimeType` + `responseSchema`; the reply is parsed and normalised.
- Best-effort per-session limit of 10 generations per hour (in-memory; resets
  with the instance) → 429.
- No request or response body is logged.

## R7 — On-device AI

- `onDeviceStatus()` feature-detects `LanguageModel` (Chrome Prompt API) and the
  legacy `ai.languageModel`, returning `available | downloadable | unavailable`.
- Only `available` is used automatically; `downloadable` is surfaced as a hint,
  never downloaded behind the user's back.
- `onDeviceSuggestions(prompt)` creates a session, prompts once, parses JSON
  tolerantly (fenced blocks and prose tolerated), normalises, and destroys the
  session. Rejects after 45 s.
- Only attempted on phones (`(pointer: coarse)` or a mobile UA).

## R8 — PWA

- `app/manifest.ts` exposes name, short name, `start_url: '/home'`, standalone
  display, theme/background from the tokens, and 192/512/maskable icons.
- `public/sw.js` caches the app shell and runtime assets: navigation is
  network-first with a cached `/home` fallback; same-origin static assets are
  cache-first; `/api/*` is never cached.
- Registration happens once from a client component; failures are silent.
- Offline: the shell and IndexedDB keep every screen usable; suggestions fall
  back to on-device when the model is available and otherwise show the retry
  state.

## R9 — Tests and gates

- Pure: `emptyProfile`, `saveProfile` merge, staleness rules, prompt contents
  (no email/name/avatar), `normalizeSuggestions`, on-device detection/parsing.
- Data: Dexie v3→v4 migration, profile CRUD, export/import/reset.
- UI: login button, onboarding steps/skip/edit, suggestions render + add +
  regenerate + privacy note, profile panel, manifest, service worker text.
- Gates: `npm test`, `npm run lint` (0 errors, no new warnings), `npm run
  typecheck`, `npm run build`.

## R10 — Environment

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Auth.js JWT signing (`npx auth secret`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client |
| `GEMINI_API_KEY` | Server-side suggestions |
| `GEMINI_MODEL` | Optional model override (default `gemini-3.5-flash`) |

Google Cloud Console: create a project → OAuth consent screen (External, test
users while unverified) → Credentials → OAuth client ID → Web application →
Authorised redirect URI `http://localhost:3000/api/auth/callback/google` plus
`https://<vercel-domain>/api/auth/callback/google`. On Vercel, set the same four
variables for Production and Preview.
