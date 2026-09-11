import test from 'node:test';
import assert from 'node:assert/strict';
import { getFreshnessBadge } from './freshness.ts';
import type { FreshnessMediaInput } from './freshness.ts';

// Fixed reference date: 2026-09-11 (simulating current date)
const now = new Date('2026-09-11T12:00:00Z');

test('1. 1992 movie → no freshness badge', () => {
  const movie: FreshnessMediaInput = {
    id: 'movie-1992',
    title: 'Classic Movie 1992',
    playbackType: 'movie',
    type: 'movie',
    releaseDate: '1992-06-19',
  };
  const badge = getFreshnessBadge(movie, now);
  assert.equal(badge, undefined);
});

test('2. 2005 movie → no freshness badge', () => {
  const movie: FreshnessMediaInput = {
    id: 'movie-2005',
    title: 'Mid 2000s Movie',
    playbackType: 'movie',
    type: 'movie',
    releaseDate: '2005-11-18',
  };
  const badge = getFreshnessBadge(movie, now);
  assert.equal(badge, undefined);
});

test('3. 2026 movie released 5 days ago → New', () => {
  // 5 days before 2026-09-11 is 2026-09-06
  const movie: FreshnessMediaInput = {
    id: 'movie-recent-5d',
    title: 'Blockbuster 2026',
    playbackType: 'movie',
    type: 'movie',
    releaseDate: '2026-09-06',
  };
  const badge = getFreshnessBadge(movie, now);
  assert.equal(badge, 'new');
});

test('4. 2026 movie released 20 days ago → Recently Added', () => {
  // 20 days before 2026-09-11 is 2026-08-22
  const movie: FreshnessMediaInput = {
    id: 'movie-recent-20d',
    title: 'Summer Hit 2026',
    playbackType: 'movie',
    type: 'movie',
    releaseDate: '2026-08-22',
  };
  const badge = getFreshnessBadge(movie, now);
  assert.equal(badge, 'recently-added');
});

test('5. Movie released in future → no freshness badge', () => {
  const movie: FreshnessMediaInput = {
    id: 'movie-future',
    title: 'Future Movie',
    playbackType: 'movie',
    type: 'movie',
    releaseDate: '2026-10-01',
  };
  const badge = getFreshnessBadge(movie, now);
  assert.equal(badge, undefined);
});

test('6. Defensive guard: movies CANNOT EVER receive New Episode or New Season', () => {
  const movieWithTvFields: FreshnessMediaInput = {
    id: 'movie-defensive',
    title: 'Movie Pretending To Be TV',
    playbackType: 'movie',
    type: 'movie',
    releaseDate: '1992-05-01',
    lastEpisodeAirDate: '2026-09-09', // 2 days ago
    seasonAirDates: ['2026-09-05'], // 6 days ago
  };
  const badge = getFreshnessBadge(movieWithTvFields, now);
  assert.notEqual(badge, 'new-episode');
  assert.notEqual(badge, 'new-season');
  assert.equal(badge, undefined);
});

test('7. old TV show with no recent episodes → no badge', () => {
  const oldTv: FreshnessMediaInput = {
    id: 'tv-1992',
    title: 'Vintage Series 1992',
    playbackType: 'tv',
    type: 'tv',
    firstAirDate: '1992-04-10',
    lastAirDate: '1997-03-28',
    lastEpisodeAirDate: '1997-03-28',
    seasonAirDates: ['1992-04-10', '1993-04-10', '1994-04-10', '1995-04-10', '1996-04-10'],
  };
  const badge = getFreshnessBadge(oldTv, now);
  assert.equal(badge, undefined);
});

test('8. old TV show with episode aired 3 days ago → New Episode', () => {
  // 3 days before 2026-09-11 is 2026-09-08
  const tvShow: FreshnessMediaInput = {
    id: 'tv-1992-active',
    title: 'Long Running Show Since 1992',
    playbackType: 'tv',
    type: 'tv',
    firstAirDate: '1992-10-03',
    lastEpisodeAirDate: '2026-09-08',
  };
  const badge = getFreshnessBadge(tvShow, now);
  assert.equal(badge, 'new-episode');
});

test('9. old TV show with season premiered 10 days ago and no recent episode → New Season', () => {
  // 10 days before 2026-09-11 is 2026-09-01
  const tvShow: FreshnessMediaInput = {
    id: 'tv-2005-new-season',
    title: 'Show From 2005 New Season',
    playbackType: 'tv',
    type: 'tv',
    firstAirDate: '2005-09-13',
    lastEpisodeAirDate: '2026-08-20', // episode aired 22 days ago (not within 7 days)
    seasonAirDates: ['2026-09-01', '2024-03-10'],
  };
  const badge = getFreshnessBadge(tvShow, now);
  assert.equal(badge, 'new-season');
});

test('10. TV show with episode aired 10 days ago (outside 7 days) → no episode badge', () => {
  const tvShow: FreshnessMediaInput = {
    id: 'tv-old-ep',
    title: 'Show With Episode 10 Days Ago',
    playbackType: 'tv',
    type: 'tv',
    firstAirDate: '2018-01-01',
    lastEpisodeAirDate: '2026-09-01', // 10 days ago
  };
  const badge = getFreshnessBadge(tvShow, now);
  assert.equal(badge, undefined);
});

test('11. TV show with upcoming episode in future → no badge (never treat upcoming as new)', () => {
  const tvShow: FreshnessMediaInput = {
    id: 'tv-upcoming',
    title: 'Show With Upcoming Episode',
    playbackType: 'tv',
    type: 'tv',
    firstAirDate: '2020-01-01',
    lastEpisodeAirDate: '2026-09-15', // 4 days in future
  };
  const badge = getFreshnessBadge(tvShow, now);
  assert.equal(badge, undefined);
});

test('12. TV show with only Season 0 / Specials premiered recently → ignored, no badge', () => {
  // Season 0 must be filtered out before calling or not present in seasonAirDates
  const tvShow: FreshnessMediaInput = {
    id: 'tv-specials-only',
    title: 'Show With No Regular Season Premiere',
    playbackType: 'tv',
    type: 'tv',
    firstAirDate: '2015-05-01',
    seasonAirDates: [], // regular seasons filtered out
  };
  const badge = getFreshnessBadge(tvShow, now);
  assert.equal(badge, undefined);
});

test('13. TV show with first_air_date 25 days ago and no episodes/seasons → Recently Added', () => {
  // 25 days before 2026-09-11 is 2026-08-17
  const tvShow: FreshnessMediaInput = {
    id: 'tv-recently-added',
    title: 'Brand New TV Show',
    playbackType: 'tv',
    type: 'tv',
    firstAirDate: '2026-08-17',
  };
  const badge = getFreshnessBadge(tvShow, now);
  assert.equal(badge, 'recently-added');
});

test('14. missing date data → no badge', () => {
  assert.equal(getFreshnessBadge({ id: 'missing-dates', playbackType: 'movie' }, now), undefined);
  assert.equal(getFreshnessBadge({ id: 'missing-dates-tv', playbackType: 'tv' }, now), undefined);
  assert.equal(getFreshnessBadge({ id: 'empty' }, now), undefined);
  assert.equal(getFreshnessBadge(null, now), undefined);
  assert.equal(getFreshnessBadge(undefined, now), undefined);
});

test('15. TV Watch route builds direct path to recent episode', async () => {
  const { buildWatchPath } = await import('../../lib/navigation/watchRoutes.ts');
  const path = buildWatchPath({
    episode: 7,
    season: 2,
    tmdbId: 1399,
    type: 'tv',
  });
  assert.equal(path, '/watch/tv/1399/2/7');
});

test('16. Movie Watch route builds direct movie path', async () => {
  const { buildWatchPath } = await import('../../lib/navigation/watchRoutes.ts');
  const path = buildWatchPath({
    tmdbId: 550,
    type: 'movie',
  });
  assert.equal(path, '/watch/movie/550');
});


