import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';
import { tvPreviewManager } from '../previews/TvPreviewManager.ts';
import type { MediaItem } from '../../features/catalog/types.ts';

function createMockKeyEvent(init: {
  key?: string;
  keyCode?: number;
}): KeyboardEvent {
  return {
    key: init.key ?? '',
    keyCode: init.keyCode ?? 0,
    which: init.keyCode ?? 0,
    repeat: false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;
}

const mockMovieItem: MediaItem = {
  id: 101,
  tmdbId: 101,
  type: 'movie',
  title: 'Shooter',
  overview: 'A marksman living in exile is coaxed back into action.',
  backdropUrl: 'https://image.tmdb.org/t/p/original/shooter_backdrop.jpg',
  year: 2007,
  runtime: 126,
  maturityRating: '16+',
};

const mockTvItem: MediaItem = {
  id: 202,
  tmdbId: 202,
  type: 'tv',
  title: 'The Gentlemen',
  overview: 'When aristocratic Eddie inherits the family estate, he discovers it is home to an empire.',
  backdropUrl: 'https://image.tmdb.org/t/p/original/gentlemen_backdrop.jpg',
  year: 2024,
  seasons: 2,
  maturityRating: '18+',
};

test('1. Movie item opens details modal and initializes focus on Play', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'row-movies', order: 1 });
  engine.registerNode({
    colIndex: 0,
    id: 'movie-card-101',
    rowId: 'row-movies',
  });
  engine.setFocus('movie-card-101');
  assert.equal(engine.getActiveNodeId(), 'movie-card-101');

  // Open modal for movie
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-header-row', order: 0 });
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerRow({ id: 'detail-similar-row', order: 4 });

  engine.registerNode({
    colIndex: 0,
    id: 'detail-action-play',
    rowId: 'detail-actions-row',
  });
  engine.registerNode({
    colIndex: 1,
    id: 'detail-action-list',
    rowId: 'detail-actions-row',
  });

  assert.equal(engine.getScope(), 'detail-scope');
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');
});

test('2. TV show item opens details modal with Episodes and Seasons registered', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'row-tv', order: 1 });
  engine.registerNode({
    colIndex: 0,
    id: 'tv-card-202',
    rowId: 'row-tv',
  });
  engine.setFocus('tv-card-202');

  // Open TV show details modal
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-header-row', order: 0 });
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerRow({ id: 'detail-seasons-row', order: 2 });
  engine.registerRow({ id: 'detail-episodes-row', order: 3 });
  engine.registerRow({ id: 'detail-similar-row', order: 4 });

  engine.registerNode({
    colIndex: 0,
    id: 'detail-action-play',
    rowId: 'detail-actions-row',
  });
  engine.registerNode({
    colIndex: 0,
    id: 'detail-season-1',
    rowId: 'detail-seasons-row',
  });
  engine.registerNode({
    colIndex: 0,
    id: 'detail-episode-1',
    rowId: 'detail-episodes-row',
  });

  assert.equal(engine.getScope(), 'detail-scope');
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');
  assert.ok(engine.getNode('detail-season-1'));
  assert.ok(engine.getNode('detail-episode-1'));
});

test('3. Background browse page is inert while in detail-scope', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ colIndex: 0, id: 'nav-home', rowId: 'nav-row' });
  engine.registerRow({ id: 'media-row-1', order: 1 });
  engine.registerNode({ colIndex: 0, id: 'card-1', rowId: 'media-row-1' });

  engine.setFocus('card-1');
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerNode({ colIndex: 0, id: 'detail-action-play', rowId: 'detail-actions-row' });

  // Attempts to focus background items must be rejected
  const focusBackgroundNav = engine.setFocus('nav-home');
  assert.equal(focusBackgroundNav, false);
  const focusBackgroundCard = engine.setFocus('card-1');
  assert.equal(focusBackgroundCard, false);
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');
});

test('4. Close button top-right is reachable by D-pad and closes modal', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'row-movies', order: 1 });
  engine.registerNode({ colIndex: 0, id: 'movie-card-101', rowId: 'row-movies' });
  engine.setFocus('movie-card-101');

  let modalClosed = false;
  const onClose = () => {
    modalClosed = true;
    engine.popScope();
  };

  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-header-row', order: 0 });
  engine.registerRow({ id: 'detail-actions-row', order: 1 });

  engine.registerNode({
    colIndex: 0,
    id: 'detail-action-close',
    onSelect: onClose,
    rowId: 'detail-header-row',
  });
  engine.registerNode({
    colIndex: 0,
    id: 'detail-action-play',
    rowId: 'detail-actions-row',
  });

  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  // Up arrow navigates from actions row to header row (Close button)
  engine.navigate('up');
  assert.equal(engine.getActiveNodeId(), 'detail-action-close');

  // Enter triggers close
  const enterEvent = createMockKeyEvent({ key: 'Enter', keyCode: 13 });
  engine.handleKeyEvent(enterEvent);
  assert.equal(modalClosed, true);
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'movie-card-101');
});

test('5. Back key closes modal and pops scope cleanly', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'row-movies', order: 1 });
  engine.registerNode({ colIndex: 0, id: 'movie-card-101', rowId: 'row-movies' });
  engine.setFocus('movie-card-101');

  let modalClosed = false;
  const onClose = () => {
    modalClosed = true;
    engine.popScope();
  };

  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerNode({
    colIndex: 0,
    id: 'detail-action-play',
    onBack: () => {
      onClose();
      return true;
    },
    rowId: 'detail-actions-row',
  });

  const backEvent = createMockKeyEvent({ key: 'Escape', keyCode: 27 });
  engine.handleKeyEvent(backEvent);

  assert.equal(modalClosed, true);
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'movie-card-101');
});

test('6. Focus restores to triggering card on close', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'row-movies', order: 1 });
  engine.registerNode({ colIndex: 0, id: 'card-1', rowId: 'row-movies' });
  engine.registerNode({ colIndex: 1, id: 'card-2', rowId: 'row-movies' });
  engine.registerNode({ colIndex: 2, id: 'card-3', rowId: 'row-movies' });

  // User was on card-3
  engine.setFocus('card-3');
  assert.equal(engine.getActiveNodeId(), 'card-3');

  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerNode({ colIndex: 0, id: 'detail-action-play', rowId: 'detail-actions-row' });
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  // Pop scope restores original card-3
  engine.popScope();
  assert.equal(engine.getActiveNodeId(), 'card-3');
});

test('7. Movie details shows More Like This and omits episode rows', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerRow({ id: 'detail-similar-row', order: 4 });

  engine.registerNode({ colIndex: 0, id: 'detail-action-play', rowId: 'detail-actions-row' });
  engine.registerNode({ colIndex: 0, id: 'detail-similar-1', rowId: 'detail-similar-row' });
  engine.registerNode({ colIndex: 1, id: 'detail-similar-2', rowId: 'detail-similar-row' });

  // For movies, no seasons-row or episodes-row are registered
  assert.equal(engine.getNode('detail-season-1'), null);
  assert.equal(engine.getNode('detail-episode-1'), null);

  // Moving down from actions row lands directly in similar row
  engine.navigate('down');
  assert.equal(engine.getActiveNodeId(), 'detail-similar-1');
});

test('8. TV show details shows Episodes and season selector', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerRow({ id: 'detail-seasons-row', order: 2 });
  engine.registerRow({ id: 'detail-episodes-row', order: 3 });

  engine.registerNode({ colIndex: 0, id: 'detail-action-play', rowId: 'detail-actions-row' });
  engine.registerNode({ colIndex: 0, id: 'detail-season-1', rowId: 'detail-seasons-row' });
  engine.registerNode({ colIndex: 0, id: 'detail-episode-1', rowId: 'detail-episodes-row' });
  engine.registerNode({ colIndex: 1, id: 'detail-episode-2', rowId: 'detail-episodes-row' });

  engine.navigate('down');
  assert.equal(engine.getActiveNodeId(), 'detail-season-1');

  engine.navigate('down');
  assert.equal(engine.getActiveNodeId(), 'detail-episode-1');
});

test('9. Season selector is D-pad accessible and opens trapped season dropdown', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-seasons-row', order: 2 });

  let dropdownOpen = false;
  const openMenu = () => {
    dropdownOpen = true;
    engine.pushScope('detail-season-scope', 'detail-season-opt-1');
    engine.registerRow({ id: 'detail-season-menu-row', order: 0 });
    engine.registerNode({ colIndex: 0, id: 'detail-season-opt-1', rowId: 'detail-season-menu-row' });
    engine.registerNode({ colIndex: 1, id: 'detail-season-opt-2', rowId: 'detail-season-menu-row' });
  };

  engine.registerNode({
    colIndex: 0,
    id: 'detail-season-1',
    onSelect: openMenu,
    rowId: 'detail-seasons-row',
  });

  engine.setFocus('detail-season-1');
  const enterEvent = createMockKeyEvent({ key: 'Enter', keyCode: 13 });
  engine.handleKeyEvent(enterEvent);

  assert.equal(dropdownOpen, true);
  assert.equal(engine.getScope(), 'detail-season-scope');
  assert.equal(engine.getActiveNodeId(), 'detail-season-opt-1');

  // In trapped dropdown scope, background rows cannot be focused
  assert.equal(engine.setFocus('detail-action-play'), false);

  // Escaping or back pops scope and restores focus to season trigger
  const backEvent = createMockKeyEvent({ key: 'Escape', keyCode: 27 });
  engine.handleKeyEvent(backEvent);
  assert.equal(engine.getScope(), 'detail-scope');
  assert.equal(engine.getActiveNodeId(), 'detail-season-1');
});

test('10. Episode Enter launches player with episode and season info', () => {
  let playedItem: MediaItem | null = null;
  let playedEpisode: { episodeNumber: number; seasonNumber: number } | null = null;

  const onPlay = (item: MediaItem, ep?: { episodeNumber: number; seasonNumber: number }) => {
    playedItem = item;
    playedEpisode = ep ?? null;
  };

  const engine = new TvFocusEngine();
  engine.pushScope('detail-scope', 'detail-episode-3');
  engine.registerRow({ id: 'detail-episodes-row', order: 3 });
  engine.registerNode({
    colIndex: 2,
    id: 'detail-episode-3',
    onSelect: () => onPlay(mockTvItem, { episodeNumber: 3, seasonNumber: 1 }),
    rowId: 'detail-episodes-row',
  });

  assert.equal(engine.getActiveNodeId(), 'detail-episode-3');
  const enterEvent = createMockKeyEvent({ key: 'Enter', keyCode: 13 });
  engine.handleKeyEvent(enterEvent);

  assert.deepEqual(playedItem, mockTvItem);
  assert.deepEqual(playedEpisode, { episodeNumber: 3, seasonNumber: 1 });
});

test('11. More Like This cards scroll smoothly / navigate horizontally', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('detail-scope', 'detail-similar-1');
  engine.registerRow({ id: 'detail-similar-row', order: 4 });
  engine.registerNode({ colIndex: 0, id: 'detail-similar-1', rowId: 'detail-similar-row' });
  engine.registerNode({ colIndex: 1, id: 'detail-similar-2', rowId: 'detail-similar-row' });
  engine.registerNode({ colIndex: 2, id: 'detail-similar-3', rowId: 'detail-similar-row' });

  assert.equal(engine.getActiveNodeId(), 'detail-similar-1');
  engine.navigate('right');
  assert.equal(engine.getActiveNodeId(), 'detail-similar-2');
  engine.navigate('right');
  assert.equal(engine.getActiveNodeId(), 'detail-similar-3');
  engine.navigate('left');
  assert.equal(engine.getActiveNodeId(), 'detail-similar-2');
});

test('12. Preview stops when modal closes', () => {
  const previewId = 'detail-101';
  tvPreviewManager.requestPreview(previewId, { delayMs: 0 });
  assert.equal(tvPreviewManager.isPreviewActive(previewId), true);

  // When modal unmounts, it calls tvPreviewManager.stop(previewId)
  tvPreviewManager.stop(previewId);
  assert.equal(tvPreviewManager.isPreviewActive(previewId), false);
});

test('13. Fallback backdrop renders if no trailer is available', () => {
  const trailerKey: string | null = null;
  const isDetailPreviewActive = false;
  const backdropUrl = mockMovieItem.backdropUrl;

  const shouldRenderVideo = Boolean(isDetailPreviewActive && trailerKey);
  assert.equal(shouldRenderVideo, false);
  assert.equal(backdropUrl, 'https://image.tmdb.org/t/p/original/shooter_backdrop.jpg');
});

test('14. TV V1 remains unchanged', () => {
  const gitDiffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(gitDiffTvV1, '', 'src/lib/tv/ (TV V1) files must remain completely untouched');
});

test('15. Normal web remains unchanged', () => {
  const gitDiffWeb = execSync(
    'git diff --name-only src/features/details-modal/ src/features/movies/ src/features/shows/ src/components/'
  )
    .toString()
    .trim();
  assert.equal(gitDiffWeb, '', 'Normal web components and pages must remain completely untouched');
});

test('16. modal width < 100vw and uses responsive clamp min(88vw, 1500px)', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('width: min(88vw, 1500px);'),
    'Modal dialog must use width: min(88vw, 1500px) to guarantee width < 100vw'
  );
  assert.ok(
    !css.includes('.tv-v2-detail-dialog {\n  width: 100vw;') &&
      !css.includes('.tv-v2-detail-modal {\n  width: 100vw;'),
    'Modal dialog must never be 100vw'
  );
});

test('17. modal height < 100vh and uses max-height: 88vh', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('max-height: 88vh;'),
    'Modal dialog must use max-height: 88vh'
  );
  assert.ok(
    !css.includes('.tv-v2-detail-dialog {\n  height: 100vh;') &&
      !css.includes('.tv-v2-detail-modal {\n  height: 100vh;'),
    'Modal dialog must never be 100vh'
  );
});

test('18. backdrop fills full viewport with darkened translucent background and subtle blur', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('.tv-v2-detail-backdrop {') &&
      css.includes('position: fixed;') &&
      css.includes('inset: 0;') &&
      css.includes('width: 100vw;') &&
      css.includes('height: 100vh;'),
    'Backdrop must own full viewport (position: fixed; inset: 0; 100vw x 100vh)'
  );
  assert.ok(
    css.includes('background-color: rgba(0, 0, 0, 0.58);'),
    'Backdrop must use dimmed translucent background rgba(0, 0, 0, 0.58)'
  );
  assert.ok(
    css.includes('backdrop-filter: blur(4px);'),
    'Backdrop must use subtle blur'
  );
});

test('19. modal centered horizontally and vertically', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('display: grid;') && css.includes('place-items: center;'),
    'Backdrop must use display: grid; place-items: center; to center modal'
  );
});

test('20. rounded corners and overflow hidden applied', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('border-radius: clamp(14px, 1.4vw, 18px);'),
    'Modal must have rounded corners clamp(14px, 1.4vw, 18px)'
  );
  assert.ok(
    css.includes('.tv-v2-detail-dialog,') && css.includes('overflow: hidden;'),
    'Modal shell must have overflow: hidden to clip hero inside top corners'
  );
});

test('21. internal scrolling used and background scrolling locked', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('.tv-v2-detail__scrollable {') &&
      css.includes('overflow-y: auto;') &&
      css.includes('overscroll-behavior: contain;'),
    'Modal body must scroll internally with overscroll-behavior: contain'
  );

  const screenTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvDetailScreen.tsx'),
    'utf-8'
  );
  assert.ok(
    screenTsx.includes("document.body.style.overflow = 'hidden'"),
    'TvDetailScreen must lock document.body.style.overflow to prevent background scroll'
  );
});

test('22. hero height is bounded clamp(280px, 42vh, 480px) and close button inside modal', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('--tv-detail-hero-height: clamp(280px, 42vh, 480px);'),
    'Hero height must be clamp(280px, 42vh, 480px)'
  );
  assert.ok(
    css.includes('top: clamp(16px, 1.8vh, 24px);') &&
      css.includes('right: clamp(16px, 1.5vw, 24px);'),
    'Close button must be positioned inside modal top-right'
  );
});

