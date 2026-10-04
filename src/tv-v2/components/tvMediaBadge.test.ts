import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  isTopTenItem,
  resolveTvFreshnessBadge,
  getFreshnessLabel,
} from './tvMediaBadgeLogic.ts';
import type { MediaItem } from '../../features/catalog/types.ts';

test('1. New Episode uses TV V1-compatible treatment', () => {
  const item: MediaItem = {
    id: 'show-1',
    title: 'Series with New Episode',
    type: 'tv',
    badge: 'new-episode',
  };
  const resolved = resolveTvFreshnessBadge(item);
  assert.equal(resolved, 'new-episode');
  assert.equal(getFreshnessLabel('new-episode'), 'New Episode');

  const css = fs.readFileSync(path.resolve('src/tv-v2/components/TvComponents.css'), 'utf-8');
  assert.ok(css.includes('.tv-v2-card__badge-container'), 'Badge container must be defined');
  assert.ok(css.includes('.tv-v2-card__bottom-badge'), 'Bottom badge must be defined');
  assert.ok(css.includes('background-color: #e50914'), 'Must use authentic Netflix red (#e50914)');
  assert.ok(css.includes('bottom: 0'), 'Badge must be attached flush to bottom');
  assert.ok(css.includes('border-radius: 3px 3px 0 0'), 'Top corners rounded, bottom flush');
});

test('2. New Season uses same treatment', () => {
  const item: MediaItem = {
    id: 'show-2',
    title: 'Series with New Season',
    type: 'tv',
    badge: 'new-season',
  };
  const resolved = resolveTvFreshnessBadge(item);
  assert.equal(resolved, 'new-season');
  assert.equal(getFreshnessLabel('new-season'), 'New Season');

  const css = fs.readFileSync(path.resolve('src/tv-v2/components/TvComponents.css'), 'utf-8');
  assert.ok(css.includes('.tv-v2-card__bottom-badge'), 'Uses unified bottom badge styling');
});

test('3. Recently Added uses same treatment', () => {
  const item: MediaItem = {
    id: 'movie-1',
    title: 'Recent Movie',
    type: 'movie',
    badge: 'recently-added',
  };
  const resolved = resolveTvFreshnessBadge(item);
  assert.equal(resolved, 'recently-added');
  assert.equal(getFreshnessLabel('recently-added'), 'Recently Added');

  const css = fs.readFileSync(path.resolve('src/tv-v2/components/TvComponents.css'), 'utf-8');
  assert.ok(css.includes('.tv-v2-card__bottom-badge'), 'Uses unified bottom badge styling');
});

test('4. Top 10 uses corner badge', () => {
  const item: MediaItem = {
    id: 'top-item',
    title: 'Top 10 Title',
    type: 'movie',
    badge: 'top-10',
    inTopTen: true,
  };
  assert.equal(isTopTenItem(item), true);

  const badgeComponent = fs.readFileSync(path.resolve('src/tv-v2/components/TvMediaBadge.tsx'), 'utf-8');
  assert.ok(badgeComponent.includes('tv-v2-card__top10-badge'), 'Renders Top 10 corner badge container');
  assert.ok(badgeComponent.includes('tv-v2-card__top10-text'), 'Renders stacked TOP label');
  assert.ok(badgeComponent.includes('tv-v2-card__top10-rank'), 'Renders stacked 10 digit');

  const css = fs.readFileSync(path.resolve('src/tv-v2/components/TvComponents.css'), 'utf-8');
  assert.ok(css.includes('.tv-v2-card__top10-badge'), 'Top 10 badge CSS defined');
  assert.ok(css.includes('position: absolute'), 'Pinned position');
  assert.ok(css.includes('top: 0'), 'Anchored top edge');
  assert.ok(css.includes('left: 0'), 'Anchored left corner');
  assert.ok(css.includes('border-radius: 0 0 4px 0'), 'Outer corner clips flush, inner corner rounded');
});

test('5. Badges are informational/non-focusable', () => {
  const badgeComponent = fs.readFileSync(path.resolve('src/tv-v2/components/TvMediaBadge.tsx'), 'utf-8');
  assert.ok(badgeComponent.includes('data-tv-focusable="false"'), 'Badges must have data-tv-focusable="false"');
  assert.ok(badgeComponent.includes('tabIndex={-1}'), 'Badges must have tabIndex={-1}');
  assert.ok(!badgeComponent.includes('tabIndex={0}'), 'Badges must not be tabIndex={0}');
  assert.ok(!badgeComponent.includes('role="button"'), 'Badges must not be role="button"');

  const css = fs.readFileSync(path.resolve('src/tv-v2/components/TvComponents.css'), 'utf-8');
  assert.ok(css.includes('pointer-events: none'), 'Pointer events disabled for badges');
  assert.ok(css.includes('user-select: none'), 'User select disabled for badges');
});

test('6. Card focus preserves badge placement', () => {
  const cardComponent = fs.readFileSync(path.resolve('src/tv-v2/components/TvMediaCard.tsx'), 'utf-8');
  // Badge must be placed within tv-v2-card__surface so it stays pinned during focus scaling and expansion
  assert.ok(cardComponent.includes('<TvMediaBadge'), 'Card embeds TvMediaBadge');

  const css = fs.readFileSync(path.resolve('src/tv-v2/components/TvComponents.css'), 'utf-8');
  assert.ok(css.includes('.tv-v2-card__surface'), 'Card surface must define bounding container');
  assert.ok(css.includes('overflow: hidden'), 'Surface clips badges cleanly');
  assert.ok(css.includes('.tv-v2-card__badge--hidden'), 'Supports fade out during active video preview');
});

test('7. Unsupported badge is not fabricated', () => {
  const plainItem: MediaItem = {
    id: 'plain-123',
    title: 'Regular Catalog Movie',
    type: 'movie',
    // No dates, no badge, no inTopTen
  };
  assert.equal(resolveTvFreshnessBadge(plainItem), null, 'Plain item must not resolve freshness badge');
  assert.equal(isTopTenItem(plainItem), false, 'Plain item must not resolve Top 10');
});

test('8. Top 10 requires actual ranking data', () => {
  const itemWithoutRank: MediaItem = {
    id: 'movie-norank',
    title: 'Unranked Movie',
    type: 'movie',
    inTopTen: false,
  };
  assert.equal(isTopTenItem(itemWithoutRank), false, 'Unranked item must not receive Top 10 badge');

  const itemWithTopTenFlag: MediaItem = {
    id: 'movie-ranked',
    title: 'Ranked Movie',
    type: 'movie',
    inTopTen: true,
  };
  assert.equal(isTopTenItem(itemWithTopTenFlag), true, 'Ranked item receives Top 10 badge');
});

test('9. Search uses same badge system', () => {
  const searchScreen = fs.readFileSync(path.resolve('src/tv-v2/screens/TvSearchScreen.tsx'), 'utf-8');
  assert.ok(searchScreen.includes('<TvMediaCard'), 'TvSearchScreen uses TvMediaCard');

  const screensCss = fs.readFileSync(path.resolve('src/tv-v2/screens/TvScreens.css'), 'utf-8');
  assert.ok(screensCss.includes('.tv-v2-search-screen .tv-v2-card .tv-v2-card__surface'), 'Search poster surface is styled cleanly');
});

test('10. New & Popular uses same badge system', () => {
  const catalogModule = fs.readFileSync(path.resolve('src/tv-v2/catalog/tvNewPopularCatalog.ts'), 'utf-8');
  assert.ok(catalogModule.includes('topTen: topRated.slice(0, 10)'), 'New & Popular creates top 10 ranked dataset');
  assert.ok(catalogModule.includes('fetchTvNewPopularCatalog'), 'New & Popular catalog module exports loader');
});

test('11. Details metadata badges remain separate from card merchandising badges', () => {
  const detailsMetaModule = fs.readFileSync(path.resolve('src/tv-v2/details/tvDetailsMetadata.ts'), 'utf-8');
  assert.ok(detailsMetaModule.includes('resolveTvDetailsMetadata'), 'Details metadata resolver exists');

  const detailsRow = fs.readFileSync(path.resolve('src/tv-v2/components/TvDetailsMetadataRow.tsx'), 'utf-8');
  assert.ok(detailsRow.includes('tv-v2-meta-badge'), 'Details row renders technical metadata badges');
  assert.ok(!detailsRow.includes('tv-v2-card__top10-badge'), 'Details row does not render card merchandising badge');
  assert.ok(!detailsRow.includes('tv-v2-card__bottom-badge'), 'Details row does not render card merchandising badge');
});

test('12. TV V1 behavior remains unchanged', () => {
  const v1Diff = execSync('git diff --name-only src/lib/tv/', { encoding: 'utf-8' }).trim();
  assert.equal(v1Diff, '', `TV V1 files must remain untouched. Diff: ${v1Diff}`);
});

test('13. Normal web remains unchanged', () => {
  const webDiff = execSync('git diff --name-only src/components/ src/features/', { encoding: 'utf-8' }).trim();
  assert.equal(webDiff, '', `Web files must remain untouched. Diff: ${webDiff}`);
});
