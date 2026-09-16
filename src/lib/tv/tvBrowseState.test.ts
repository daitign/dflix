import test from 'node:test';
import assert from 'node:assert/strict';
import { clearTvBrowseState, getTvBrowseState, restoreTvBrowseState, saveTvBrowseState } from './tvBrowseState.ts';
import { initTVMode, isTVMode } from './tvDetection.ts';

test('1. TV Browse State: saves and retrieves custom browse state in memory', () => {
  clearTvBrowseState();
  assert.equal(getTvBrowseState(), null);

  const saved = saveTvBrowseState({
    route: '/?tv=1#shows',
    scrollY: 450,
    focusedRowId: 'trending-tv',
    rowScrollPositions: { 'trending-tv': 320 },
    focusedMediaId: '105',
    focusedCardIndex: 2,
  });

  assert.equal(saved.route, '/?tv=1#shows');
  assert.equal(saved.scrollY, 450);
  assert.equal(saved.focusedRowId, 'trending-tv');
  assert.equal(saved.rowScrollPositions['trending-tv'], 320);
  assert.equal(saved.focusedMediaId, '105');
  assert.equal(saved.focusedCardIndex, 2);

  const retrieved = getTvBrowseState();
  assert.ok(retrieved);
  assert.equal(retrieved?.route, '/?tv=1#shows');
  assert.equal(retrieved?.scrollY, 450);
  assert.equal(retrieved?.focusedMediaId, '105');
});

test('2. TV Browse State: clearTvBrowseState cleans up saved state', () => {
  saveTvBrowseState({ route: '/movies', scrollY: 120 });
  assert.ok(getTvBrowseState());

  clearTvBrowseState();
  assert.equal(getTvBrowseState(), null);
});

test('3. TV Browse State: restoreTvBrowseState returns false when no state exists', () => {
  clearTvBrowseState();
  const restored = restoreTvBrowseState();
  assert.equal(restored, false);
});
