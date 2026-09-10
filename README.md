# DAITIGN Stream — Phase 5

A responsive cinematic streaming interface with a real TMDB catalog boundary and isolated VIDSTUCK playback.

## Local configuration

Copy `.env.example` to `.env.local`, then add either a TMDB v4 read access token (preferred) or a v3 API key:

```bash
TMDB_ACCESS_TOKEN=your_v4_read_access_token
# or TMDB_API_KEY=your_v3_api_key
```

Secrets are read only by the same-origin Node/Vite TMDB proxy. They are not bundled into browser JavaScript. Locale values default to `en-US` and `PH` and can be adjusted with `VITE_TMDB_LANGUAGE` and `VITE_TMDB_REGION`.

## Run locally

```bash
npm install
npm run dev
```

For a production-style local server:

```bash
npm run build
npm start
```

Use `npm run typecheck` for a standalone TypeScript check.

## Phase 5 architecture

- `server/tmdbProxy.mjs` — allowlisted, credential-safe TMDB transport with in-flight request de-duplication and TTL caching.
- `src/lib/tmdb` — endpoint definitions, raw response types, image helpers, normalized adapters, cached client methods, and reusable multi-search.
- `src/features/catalog/data/tmdbHomeCatalog.ts` — maps real TMDB datasets into the existing DAITIGN row hierarchy.
- `src/features/details-modal` — fetches real details on demand and lazily loads/cache seasons within the modal lifecycle.
- `src/lib/vidstuck` — the only VIDSTUCK URL construction and progress-payload validation boundary.
- `src/components/player` — the only live iframe component and postMessage listener.
- `src/features/watch` — distraction-free movie and episode watch pages.

## Internal watch routes

- Movies: `/watch/movie/:tmdbId`
- TV/anime playback: `/watch/tv/:tmdbId/:season/:episode`

Anime remains a DAITIGN catalog category while retaining its real TMDB ID and underlying movie/TV playback type.

## Deferred to Phase 6

Accounts, profiles, My List persistence, likes, watch history, progress persistence, and Continue Watching persistence remain intentionally unimplemented. Player progress is validated and exposed in memory through `onProgress`.
