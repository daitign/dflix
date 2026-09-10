# DAITIGN Stream — Phase 2

A responsive, cinematic Home / Browse experience built on the Phase 1 React, TypeScript, and Vite foundation.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run build` for a production build and `npm run typecheck` for a standalone type check.

## Phase 2 additions

- Cinematic featured-title hero with responsive metadata and UI-only deferred-action notices
- Curated row hierarchy covering Top 10, trending, continue watching, recently added, releases, movies, series, genres, Korean series, anime, and critically acclaimed titles
- Reusable `HeroBanner`, `MediaRow`, `MediaCard`, `RankedMediaCard`, `ContinueWatchingCard`, `StatusBadge`, and `CarouselControls`
- Normalized `MediaItem` and `HomeCatalog` types with a mock gateway/adapter boundary
- Original DAITIGN-owned cinematic artwork in responsive WebP sizes
- Lazy-loaded below-the-fold artwork, fixed media aspect ratios, image fade-in, keyboard carousel navigation, touch scrolling, and desktop controls

## Architecture

- `src/styles/tokens.css` — Phase 1 global color, type, spacing, radius, shadow, motion, layout, breakpoint, and z-index tokens
- `src/components` — Phase 1 primitives and responsive navigation shell
- `src/features/catalog` — normalized catalog types plus the mock home-catalog adapter
- `src/features/home` — Phase 2 browse components
- `src/integrations` — typed TMDB, Supabase, and Vidstuck boundaries; concrete implementations remain deferred
- `public/media` — optimized original artwork with 640px/960px card sources and a 1600px hero source

## Deferred by design

Authentication, profiles, TMDB calls, Supabase persistence, Vidstuck playback, a full details modal, and expanding hover cards are not implemented in Phase 2.
