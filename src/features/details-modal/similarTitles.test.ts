import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDurationLabel,
  getMaturityLabel,
  hasSpatialAudio,
  getStatusBadgeLabel,
} from './similarTitlesUtils.ts';
import { MAX_TRAILERS_COUNT, filterAndRankTrailers } from './trailersUtils.ts';
import type { MediaItem } from '../catalog/types.ts';
import type { TmdbVideo } from '../../lib/tmdb/types.ts';

test('1. Duration label: TV show with seasons returns "X Seasons"', () => {
  const item: MediaItem = {
    id: 'tv-1',
    type: 'tv',
    title: 'Series Title',
    seasons: 3,
  };
  assert.equal(getDurationLabel(item), '3 Seasons');
});

test('2. Duration label: TV show with 1 season returns "1 Season"', () => {
  const item: MediaItem = {
    id: 'tv-2',
    type: 'tv',
    title: 'Single Season',
    seasons: 1,
  };
  assert.equal(getDurationLabel(item), '1 Season');
});

test('3. Duration label: TV show with episode label', () => {
  const item: MediaItem = {
    id: 'tv-3',
    type: 'tv',
    title: 'Limited Series',
    episodeLabel: '6 Episodes',
  };
  assert.equal(getDurationLabel(item), '6 Episodes');
});

test('4. Duration label: Movie with explicit runtime', () => {
  const item: MediaItem = {
    id: 'movie-1',
    type: 'movie',
    title: 'Shrek 2',
    runtime: 92,
  };
  assert.equal(getDurationLabel(item), '1h 32m');
});

test('5. Duration label: Movie with fallback deterministic runtime', () => {
  const item: MediaItem = {
    id: 'movie-2',
    tmdbId: 808,
    type: 'movie',
    title: 'Shrek 2',
  };
  const label = getDurationLabel(item);
  assert.match(label, /^\d+h \d+m$/);
});

test('6. Maturity label: Explicit maturityRating is preserved', () => {
  const item: MediaItem = {
    id: 'movie-3',
    type: 'movie',
    title: 'Rated Title',
    maturityRating: 'PG-13',
  };
  assert.equal(getMaturityLabel(item), 'PG-13');
});

test('7. Maturity label: Inferred from genres (Animation -> 7+)', () => {
  const item: MediaItem = {
    id: 'movie-4',
    type: 'movie',
    title: 'Animated Film',
    genres: ['Animation', 'Comedy'],
  };
  assert.equal(getMaturityLabel(item), '7+');
});

test('8. Maturity label: Inferred from genres (Horror -> 18+)', () => {
  const item: MediaItem = {
    id: 'movie-5',
    type: 'movie',
    title: 'Scary Movie',
    genres: ['Horror', 'Mystery'],
  };
  assert.equal(getMaturityLabel(item), '18+');
});

test('9. Maturity label: Inferred from genres (Action -> 16+)', () => {
  const item: MediaItem = {
    id: 'movie-6',
    type: 'movie',
    title: 'Action Movie',
    genres: ['Action', 'Thriller'],
  };
  assert.equal(getMaturityLabel(item), '16+');
});

test('10. Spatial Audio: qualifying modern title returns boolean', () => {
  const item: MediaItem = {
    id: 'movie-7',
    tmdbId: 300,
    type: 'movie',
    title: 'Spatial Title',
    year: 2021,
  };
  assert.equal(hasSpatialAudio(item), true);
});

test('11. Status badge: maps known badges to human-readable strings', () => {
  assert.equal(getStatusBadgeLabel('new-episode'), 'New Episode');
  assert.equal(getStatusBadgeLabel('new-season'), 'New Season');
  assert.equal(getStatusBadgeLabel('recently-added'), 'Recently Added');
  assert.equal(getStatusBadgeLabel('new'), 'New');
  assert.equal(getStatusBadgeLabel(undefined), null);
});

test('12. Trailers & More: enforces a maximum of 3 trailers displayed in movie details', () => {
  assert.equal(MAX_TRAILERS_COUNT, 3, 'MAX_TRAILERS_COUNT must be 3');

  const mockVideos: TmdbVideo[] = [
    { id: '1', key: 'key_trailer_1', name: 'Final Trailer', site: 'YouTube', type: 'Trailer', official: true },
    { id: '2', key: 'key_trailer_2', name: 'New Trailer', site: 'YouTube', type: 'Trailer', official: true },
    { id: '3', key: 'key_trailer_3', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', official: true },
    { id: '4', key: 'key_teaser_1', name: 'Teaser 1', site: 'YouTube', type: 'Teaser', official: true },
    { id: '5', key: 'key_teaser_2', name: 'Teaser 2', site: 'YouTube', type: 'Teaser', official: true },
    { id: '6', key: 'key_teaser_3', name: 'Teaser 3', site: 'YouTube', type: 'Teaser', official: true },
  ];

  const result = filterAndRankTrailers(mockVideos);
  assert.equal(result.length, 3, 'Must cap results to exactly 3 trailers maximum');
  assert.equal(result[0].name, 'Final Trailer');
  assert.equal(result[1].name, 'New Trailer');
  assert.equal(result[2].name, 'Official Trailer');
});

test('13. Trailers & More: deduplicates by YouTube key and preserves top official videos', () => {
  const mockVideosWithDuplicates: TmdbVideo[] = [
    { id: '1', key: 'duplicate_key_1', name: 'Trailer A', site: 'YouTube', type: 'Trailer', official: true },
    { id: '2', key: 'duplicate_key_1', name: 'Trailer A Duplicate', site: 'YouTube', type: 'Trailer', official: true },
    { id: '3', key: 'key_teaser_b', name: 'Teaser B', site: 'YouTube', type: 'Teaser', official: false },
    { id: '4', key: 'key_clip_c', name: 'Clip C', site: 'YouTube', type: 'Clip', official: false },
  ];

  const result = filterAndRankTrailers(mockVideosWithDuplicates);
  assert.equal(result.length, 3);
  assert.equal(result[0].key, 'duplicate_key_1');
  assert.equal(result[1].key, 'key_teaser_b');
  assert.equal(result[2].key, 'key_clip_c');
});
