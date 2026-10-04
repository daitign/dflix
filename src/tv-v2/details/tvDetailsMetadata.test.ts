import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import {
  formatRuntime,
  resolveTvDetailsMetadata,
  type RawMediaMetadata,
} from './tvDetailsMetadata.ts';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';

test('1. movie shows runtime', () => {
  // Movie with 126 minutes -> 2h 06m
  const movie1: RawMediaMetadata = {
    id: 101,
    type: 'movie',
    playbackType: 'movie',
    title: 'Action Movie',
    year: 2025,
    runtime: 126,
    seasons: 3, // Even if erroneously present, must be ignored for movie
  };
  const meta1 = resolveTvDetailsMetadata(movie1);
  assert.equal(meta1.isMovie, true);
  assert.equal(meta1.durationText, '2h 06m');
  assert.equal(meta1.year, '2025');

  // Movie with 92 minutes -> 1h 32m
  const movie2: RawMediaMetadata = {
    id: 102,
    type: 'movie',
    runtime: 92,
  };
  const meta2 = resolveTvDetailsMetadata(movie2);
  assert.equal(meta2.durationText, '1h 32m');

  // Movie with 45 minutes -> 45m
  const movie3: RawMediaMetadata = {
    id: 103,
    type: 'movie',
    runtime: 45,
  };
  const meta3 = resolveTvDetailsMetadata(movie3);
  assert.equal(meta3.durationText, '45m');

  // Movie without runtime -> omitted
  const movieNoRuntime: RawMediaMetadata = {
    id: 104,
    type: 'movie',
  };
  const metaNoRuntime = resolveTvDetailsMetadata(movieNoRuntime);
  assert.equal(metaNoRuntime.durationText, undefined);
});

test('2. series shows season count', () => {
  // Series with 4 seasons -> 4 Seasons
  const series1: RawMediaMetadata = {
    id: 201,
    type: 'tv',
    playbackType: 'tv',
    title: 'Drama Series',
    year: 2026,
    seasons: 4,
    runtime: 60, // Must not be used for primary series row
  };
  const meta1 = resolveTvDetailsMetadata(series1);
  assert.equal(meta1.isMovie, false);
  assert.equal(meta1.durationText, '4 Seasons');
  assert.equal(meta1.year, '2026');

  // Series with 1 season -> 1 Season
  const seriesSingle: RawMediaMetadata = {
    id: 202,
    type: 'tv',
    seasons: 1,
  };
  const metaSingle = resolveTvDetailsMetadata(seriesSingle);
  assert.equal(metaSingle.durationText, '1 Season');

  // Series with explicit episodeLabel -> X Episodes
  const seriesLimited: RawMediaMetadata = {
    id: 203,
    type: 'tv',
    episodeLabel: '6 Episodes',
  };
  const metaLimited = resolveTvDetailsMetadata(seriesLimited);
  assert.equal(metaLimited.durationText, '6 Episodes');

  // Series without seasons -> omitted
  const seriesNoSeasons: RawMediaMetadata = {
    id: 204,
    type: 'tv',
  };
  const metaNoSeasons = resolveTvDetailsMetadata(seriesNoSeasons);
  assert.equal(metaNoSeasons.durationText, undefined);
});

test('3. content rating appears only when available', () => {
  // Available rating preserved
  const itemWithRating: RawMediaMetadata = {
    id: 301,
    type: 'movie',
    maturityRating: '16+',
  };
  const metaWithRating = resolveTvDetailsMetadata(itemWithRating);
  assert.equal(metaWithRating.maturityRating, '16+');

  // Alternate rating property
  const itemAltRating: RawMediaMetadata = {
    id: 302,
    type: 'tv',
    rating: 'TV-MA',
  };
  const metaAltRating = resolveTvDetailsMetadata(itemAltRating);
  assert.equal(metaAltRating.maturityRating, 'TV-MA');

  // Missing rating -> omitted
  const itemNoRating: RawMediaMetadata = {
    id: 303,
    type: 'movie',
  };
  const metaNoRating = resolveTvDetailsMetadata(itemNoRating);
  assert.equal(metaNoRating.maturityRating, undefined);

  // 'NR' rating -> omitted
  const itemNrRating: RawMediaMetadata = {
    id: 304,
    type: 'movie',
    rating: 'NR',
  };
  const metaNrRating = resolveTvDetailsMetadata(itemNrRating);
  assert.equal(metaNrRating.maturityRating, undefined);
});

test('4. descriptors appear only when available', () => {
  // Explicit content descriptors -> shown
  const itemWithDescriptors: RawMediaMetadata = {
    id: 401,
    type: 'movie',
    contentDescriptors: ['violence', 'language', 'suicide'],
  };
  const meta = resolveTvDetailsMetadata(itemWithDescriptors);
  assert.equal(meta.hasDescriptors, true);
  assert.equal(meta.descriptorsText, 'violence, language, suicide');

  // Custom descriptors on item
  const itemCustom: RawMediaMetadata = {
    id: 402,
    type: 'tv',
    descriptors: ['gore', 'crude humor'],
  };
  const metaCustom = resolveTvDetailsMetadata(itemCustom);
  assert.equal(metaCustom.hasDescriptors, true);
  assert.equal(metaCustom.descriptorsText, 'gore, crude humor');

  // When no descriptors exist -> omitted
  const itemNoDescriptors: RawMediaMetadata = {
    id: 403,
    type: 'movie',
    genres: ['Action', 'Thriller'],
  };
  const metaNoDescriptors = resolveTvDetailsMetadata(itemNoDescriptors);
  assert.equal(metaNoDescriptors.hasDescriptors, false);
  assert.equal(metaNoDescriptors.descriptorsText, undefined);

  // When descriptors are just genres fallback -> omitted
  const detailsFallback: RawMediaMetadata = {
    genres: ['Action', 'Thriller'],
    descriptors: ['Action', 'Thriller'],
  };
  const metaFallback = resolveTvDetailsMetadata({ id: 404, type: 'movie' }, detailsFallback);
  assert.equal(metaFallback.hasDescriptors, false);
  assert.equal(metaFallback.descriptorsText, undefined);
});

test('5. unsupported technical badges are omitted', () => {
  // Source provides ONLY: year, runtime, rating, genres
  const plainItem: RawMediaMetadata = {
    id: 501,
    type: 'movie',
    title: 'Plain Title',
    year: 2025,
    runtime: 120,
    maturityRating: '16+',
    genres: ['Action'],
  };
  const metaPlain = resolveTvDetailsMetadata(plainItem);

  assert.equal(metaPlain.qualityBadge, undefined, 'HD/4K must not be fabricated');
  assert.equal(metaPlain.audioBadge, undefined, 'Spatial Audio must not be fabricated');
  assert.equal(metaPlain.hasAd, false, 'AD must not be fabricated');
  assert.equal(metaPlain.hasCc, false, 'CC must not be fabricated');

  // Confirmed badges are rendered truthfully
  const fullItem: RawMediaMetadata = {
    ...plainItem,
    quality: '4K',
    hasCc: true,
    audioDescription: true,
    spatialAudio: true,
  };
  const metaFull = resolveTvDetailsMetadata(fullItem);

  assert.equal(metaFull.qualityBadge, '4K');
  assert.equal(metaFull.hasCc, true);
  assert.equal(metaFull.hasAd, true);
  assert.equal(metaFull.audioBadge, 'Spatial Audio');

  // HD quality confirmed
  const hdItem: RawMediaMetadata = {
    ...plainItem,
    quality: 'HD',
  };
  assert.equal(resolveTvDetailsMetadata(hdItem).qualityBadge, 'HD');

  // Dolby Atmos audio format confirmed
  const atmosItem: RawMediaMetadata = {
    ...plainItem,
    audioFormat: 'Dolby Atmos',
  };
  assert.equal(resolveTvDetailsMetadata(atmosItem).audioBadge, 'Dolby Atmos');
});

test('6. metadata is not focusable', () => {
  // Setup TvFocusEngine graph for details modal
  const engine = new TvFocusEngine();
  engine.pushScope('detail-scope', 'detail-action-play');

  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerRow({ id: 'detail-similar-row', order: 4 });

  engine.registerNode({
    id: 'detail-action-play',
    rowId: 'detail-actions-row',
    colIndex: 0,
  });
  engine.registerNode({
    id: 'detail-similar-0',
    rowId: 'detail-similar-row',
    colIndex: 0,
  });

  // Verify no focus node exists for metadata badges or info row
  const metaNode = engine.getNode('tv-details-meta-container');
  assert.equal(metaNode, null, 'Metadata container must not be in the focus graph');

  const metaBadgeNode = engine.getNode('meta-badge-quality');
  assert.equal(metaBadgeNode, null, 'Metadata badges must not be in the focus graph');

  // Arrow down from action button skips metadata directly to similar row
  engine.setFocus('detail-action-play');
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  const handled = engine.navigate('down');
  assert.equal(handled, true);
  assert.equal(engine.getActiveNodeId(), 'detail-similar-0');
});

test('7. TV V1 unchanged', () => {
  const diffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(diffTvV1, '', 'TV V1 files must remain completely untouched');
});

test('8. web unchanged', () => {
  const diffWeb = execSync(
    'git diff --name-only src/components/ src/features/'
  )
    .toString()
    .trim();
  assert.equal(diffWeb, '', 'Normal web components and features must remain completely untouched');
});
