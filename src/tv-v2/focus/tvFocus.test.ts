import test from 'node:test';
import assert from 'node:assert/strict';
import { TvFocusEngine, parseTvKeyEvent } from './TvFocusEngine.ts';

function createMockKeyEvent(init: {
  key?: string;
  keyCode?: number;
  repeat?: boolean;
}): {
  event: KeyboardEvent;
  prevented: boolean;
  stopped: boolean;
} {
  let prevented = false;
  let stopped = false;

  const event = {
    key: init.key ?? '',
    keyCode: init.keyCode ?? 0,
    which: init.keyCode ?? 0,
    repeat: init.repeat ?? false,
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
  } as unknown as KeyboardEvent;

  return {
    event,
    get prevented() {
      return prevented;
    },
    get stopped() {
      return stopped;
    },
  };
}

test('TV V2 Focus Engine: registers nodes and navigates horizontally $O(1)$', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'row-1', order: 1 });
  engine.registerNode({ id: 'card-1', rowId: 'row-1', colIndex: 0 });
  engine.registerNode({ id: 'card-2', rowId: 'row-1', colIndex: 1 });
  engine.registerNode({ id: 'card-3', rowId: 'row-1', colIndex: 2 });

  assert.equal(engine.getActiveNodeId(), 'card-1');

  // Navigate Right
  const movedRight = engine.navigate('right');
  assert.equal(movedRight, true);
  assert.equal(engine.getActiveNodeId(), 'card-2');

  // Navigate Right again
  engine.navigate('right');
  assert.equal(engine.getActiveNodeId(), 'card-3');

  // Navigate Right at edge (no wrap)
  const atEdge = engine.navigate('right');
  assert.equal(atEdge, false);
  assert.equal(engine.getActiveNodeId(), 'card-3');

  // Navigate Left
  engine.navigate('left');
  assert.equal(engine.getActiveNodeId(), 'card-2');
});

test('TV V2 Focus Engine: vertical navigation remembers last focused card per row', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'row-1', order: 1 });
  engine.registerRow({ id: 'row-2', order: 2 });

  engine.registerNode({ id: 'r1-c0', rowId: 'row-1', colIndex: 0 });
  engine.registerNode({ id: 'r1-c1', rowId: 'row-1', colIndex: 1 });
  engine.registerNode({ id: 'r1-c2', rowId: 'row-1', colIndex: 2 });

  engine.registerNode({ id: 'r2-c0', rowId: 'row-2', colIndex: 0 });
  engine.registerNode({ id: 'r2-c1', rowId: 'row-2', colIndex: 1 });
  engine.registerNode({ id: 'r2-c2', rowId: 'row-2', colIndex: 2 });

  // Move to r1-c2
  engine.navigate('right');
  engine.navigate('right');
  assert.equal(engine.getActiveNodeId(), 'r1-c2');

  // Move Down to row-2: should land on r2-c2 (closest colIndex)
  engine.navigate('down');
  assert.equal(engine.getActiveNodeId(), 'r2-c2');

  // In row-2, move to r2-c0
  engine.navigate('left');
  engine.navigate('left');
  assert.equal(engine.getActiveNodeId(), 'r2-c0');

  // Move Up to row-1: should remember r1-c2 was last focused in row-1!
  engine.navigate('up');
  assert.equal(engine.getActiveNodeId(), 'r1-c2');

  // Move Down to row-2: should remember r2-c0 was last focused in row-2!
  engine.navigate('down');
  assert.equal(engine.getActiveNodeId(), 'r2-c0');
});

test('TV V2 Focus Engine: pushScope and popScope cleanly restore focus stack', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'row-home', order: 1 });
  engine.registerNode({ id: 'home-card-1', rowId: 'row-home', colIndex: 0 });
  engine.registerNode({ id: 'home-card-2', rowId: 'row-home', colIndex: 1 });

  engine.setFocus('home-card-2');
  assert.equal(engine.getActiveNodeId(), 'home-card-2');

  // Open modal/detail scope
  engine.pushScope('detail-scope');
  engine.registerRow({ id: 'detail-actions', order: 1 });
  engine.registerNode({ id: 'detail-play', rowId: 'detail-actions', colIndex: 0 });
  engine.registerNode({ id: 'detail-close', rowId: 'detail-actions', colIndex: 1 });

  engine.setFocus('detail-play');
  assert.equal(engine.getActiveNodeId(), 'detail-play');
  assert.equal(engine.getScope(), 'detail-scope');

  // Close modal/detail scope: must restore 'home-card-2'
  const popped = engine.popScope();
  assert.equal(popped, true);
  assert.equal(engine.getActiveNodeId(), 'home-card-2');
  assert.equal(engine.getScope(), 'root');
});

test('TV V2 Focus Engine: key repeat throttling prevents runaway movement', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'row-1', order: 1 });
  engine.registerNode({ id: 'c-0', rowId: 'row-1', colIndex: 0 });
  engine.registerNode({ id: 'c-1', rowId: 'row-1', colIndex: 1 });
  engine.registerNode({ id: 'c-2', rowId: 'row-1', colIndex: 2 });

  // First press
  const mock1 = createMockKeyEvent({ key: 'ArrowRight', repeat: false });
  assert.equal(engine.handleKeyEvent(mock1.event), true);
  assert.equal(engine.getActiveNodeId(), 'c-1');
  assert.equal(mock1.prevented, true);

  // Immediate repeat within < 75ms should be throttled (returns true, stays on c-1)
  const mock2 = createMockKeyEvent({ key: 'ArrowRight', repeat: true });
  assert.equal(engine.handleKeyEvent(mock2.event), true);
  assert.equal(engine.getActiveNodeId(), 'c-1');
});

test('TV V2 Focus Engine: mounts a valid initial focus target (nav-home preferred)', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerRow({ id: 'hero-row', order: 1 });

  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerNode({ id: 'nav-shows', rowId: 'nav-row', colIndex: 1 });
  engine.registerNode({ id: 'hero-play', rowId: 'hero-row', colIndex: 0 });

  assert.equal(engine.ensureInitialFocus('nav-home'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');
});

test('TV V2 Focus Engine: ArrowRight and ArrowLeft change focus via KeyboardEvent dispatch', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerNode({ id: 'nav-shows', rowId: 'nav-row', colIndex: 1 });
  engine.registerNode({ id: 'nav-movies', rowId: 'nav-row', colIndex: 2 });

  engine.setFocus('nav-home');

  // ArrowRight
  const rightMock = createMockKeyEvent({ key: 'ArrowRight' });
  assert.equal(engine.handleKeyEvent(rightMock.event), true);
  assert.equal(engine.getActiveNodeId(), 'nav-shows');
  assert.equal(rightMock.prevented, true);
  assert.equal(rightMock.stopped, true);

  // ArrowLeft
  const leftMock = createMockKeyEvent({ key: 'ArrowLeft' });
  assert.equal(engine.handleKeyEvent(leftMock.event), true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');
  assert.equal(leftMock.prevented, true);
});

test('TV V2 Focus Engine: ArrowDown moves to next row and ArrowUp returns appropriately', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerRow({ id: 'hero-row', order: 1 });
  engine.registerRow({ id: 'row-top-10', order: 2 });

  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerNode({ id: 'hero-play', rowId: 'hero-row', colIndex: 0 });
  engine.registerNode({ id: 'card-1', rowId: 'row-top-10', colIndex: 0 });

  engine.setFocus('nav-home');

  // Down to hero-row
  const down1 = createMockKeyEvent({ key: 'ArrowDown' });
  assert.equal(engine.handleKeyEvent(down1.event), true);
  assert.equal(engine.getActiveNodeId(), 'hero-play');
  assert.equal(down1.prevented, true);

  // Down to row-top-10
  const down2 = createMockKeyEvent({ key: 'ArrowDown' });
  assert.equal(engine.handleKeyEvent(down2.event), true);
  assert.equal(engine.getActiveNodeId(), 'card-1');

  // Up to hero-row
  const up1 = createMockKeyEvent({ key: 'ArrowUp' });
  assert.equal(engine.handleKeyEvent(up1.event), true);
  assert.equal(engine.getActiveNodeId(), 'hero-play');

  // Up to nav-row
  const up2 = createMockKeyEvent({ key: 'ArrowUp' });
  assert.equal(engine.handleKeyEvent(up2.event), true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');
});

test('TV V2 Focus Engine: Enter activates current focus via onSelect callback', () => {
  const engine = new TvFocusEngine();

  let selectedId = '';
  engine.registerRow({ id: 'hero-row', order: 1 });
  engine.registerNode({
    id: 'hero-play',
    rowId: 'hero-row',
    colIndex: 0,
    onSelect: () => {
      selectedId = 'hero-play';
    },
  });

  engine.setFocus('hero-play');

  const enterMock = createMockKeyEvent({ key: 'Enter' });
  assert.equal(engine.handleKeyEvent(enterMock.event), true);
  assert.equal(selectedId, 'hero-play');
  assert.equal(enterMock.prevented, true);
  assert.equal(enterMock.stopped, true);
});

test('TV V2 Focus Engine: Escape and Backspace invoke Back behavior and pop scope', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'home-row', order: 0 });
  engine.registerNode({ id: 'card-orig', rowId: 'home-row', colIndex: 0 });
  engine.setFocus('card-orig');

  // Push detail scope
  engine.pushScope('detail-scope');
  let detailClosed = false;
  engine.registerRow({ id: 'detail-row', order: 0 });
  engine.registerNode({
    id: 'detail-btn',
    rowId: 'detail-row',
    colIndex: 0,
    onBack: () => {
      detailClosed = true;
      return false; // let popScope run
    },
  });
  engine.setFocus('detail-btn');

  // Escape key
  const escMock = createMockKeyEvent({ key: 'Escape' });
  assert.equal(engine.handleKeyEvent(escMock.event), true);
  assert.equal(detailClosed, true);
  assert.equal(engine.getActiveNodeId(), 'card-orig');
  assert.equal(escMock.prevented, true);

  // Backspace key on root with fallback
  let fallbackHandled = false;
  engine.setOnBackFallback(() => {
    fallbackHandled = true;
    return true;
  });

  const backMock = createMockKeyEvent({ key: 'Backspace' });
  assert.equal(engine.handleKeyEvent(backMock.event), true);
  assert.equal(fallbackHandled, true);
  assert.equal(backMock.prevented, true);
});

test('TV V2 Focus Engine: macOS Chrome hardware keyCodes (37, 38, 39, 40, 13, 27, 8) parse correctly', () => {
  assert.equal(parseTvKeyEvent({ key: '', keyCode: 37 } as KeyboardEvent), 'left');
  assert.equal(parseTvKeyEvent({ key: '', keyCode: 38 } as KeyboardEvent), 'up');
  assert.equal(parseTvKeyEvent({ key: '', keyCode: 39 } as KeyboardEvent), 'right');
  assert.equal(parseTvKeyEvent({ key: '', keyCode: 40 } as KeyboardEvent), 'down');
  assert.equal(parseTvKeyEvent({ key: '', keyCode: 13 } as KeyboardEvent), 'select');
  assert.equal(parseTvKeyEvent({ key: '', keyCode: 27 } as KeyboardEvent), 'back');
  assert.equal(parseTvKeyEvent({ key: '', keyCode: 8 } as KeyboardEvent), 'back');

  // Modern keys
  assert.equal(parseTvKeyEvent({ key: 'ArrowUp' } as KeyboardEvent), 'up');
  assert.equal(parseTvKeyEvent({ key: 'ArrowDown' } as KeyboardEvent), 'down');
  assert.equal(parseTvKeyEvent({ key: 'ArrowLeft' } as KeyboardEvent), 'left');
  assert.equal(parseTvKeyEvent({ key: 'ArrowRight' } as KeyboardEvent), 'right');
  assert.equal(parseTvKeyEvent({ key: 'Enter' } as KeyboardEvent), 'select');
  assert.equal(parseTvKeyEvent({ key: 'Escape' } as KeyboardEvent), 'back');
  assert.equal(parseTvKeyEvent({ key: 'Backspace' } as KeyboardEvent), 'back');
});

test('TV V2 Focus Engine: customKeyHandler delegates keys during active player mode', () => {
  const engine = new TvFocusEngine();
  let playerKeyReceived = '';

  engine.setCustomKeyHandler((e) => {
    if (e.key === 'ArrowRight') {
      playerKeyReceived = 'seek_forward';
      return true;
    }
    return false;
  });

  const event = createMockKeyEvent({ key: 'ArrowRight' });
  const handled = engine.handleKeyEvent(event.event);

  assert.equal(handled, true);
  assert.equal(playerKeyReceived, 'seek_forward');

  // Cleanup handler
  engine.setCustomKeyHandler(null);
  assert.equal(engine.handleKeyEvent(event.event), false); // No nodes registered
});

test('TV V2 Focus Engine: navigateVertical skips empty or unpopulated rows', () => {
  const engine = new TvFocusEngine();

  // Register row 1 (nav)
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });

  // Register row 2 (empty row, e.g. loading or divider)
  engine.registerRow({ id: 'empty-row', order: 1 });

  // Register row 3 (hero)
  engine.registerRow({ id: 'hero-row', order: 2 });
  engine.registerNode({ id: 'hero-play', rowId: 'hero-row', colIndex: 0 });

  // Start on nav-home
  engine.setFocus('nav-home');
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // Down should skip empty-row and land directly on hero-play
  const movedDown = engine.navigate('down');
  assert.equal(movedDown, true);
  assert.equal(engine.getActiveNodeId(), 'hero-play');

  // Up should skip empty-row and land back on nav-home
  const movedUp = engine.navigate('up');
  assert.equal(movedUp, true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');
});

test('TV V2 Focus Engine: full graph navigation from Nav -> Hero -> Media Rows -> Footer and returns', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerNode({ id: 'nav-shows', rowId: 'nav-row', colIndex: 1 });

  engine.registerRow({ id: 'hero-row', order: 1 });
  engine.registerNode({ id: 'hero-play', rowId: 'hero-row', colIndex: 0 });
  engine.registerNode({ id: 'hero-info', rowId: 'hero-row', colIndex: 1 });

  engine.registerRow({ id: 'row-top-10', order: 2 });
  engine.registerNode({ id: 'card-top-1', rowId: 'row-top-10', colIndex: 0 });
  engine.registerNode({ id: 'card-top-2', rowId: 'row-top-10', colIndex: 1 });

  engine.registerRow({ id: 'row-trending', order: 3 });
  engine.registerNode({ id: 'card-trend-1', rowId: 'row-trending', colIndex: 0 });

  engine.registerRow({ id: 'footer-row', order: 1000 });
  engine.registerNode({ id: 'footer-back-to-top', rowId: 'footer-row', colIndex: 0 });
  engine.registerNode({ id: 'footer-telegram', rowId: 'footer-row', colIndex: 1 });

  // Initial focus
  engine.setFocus('nav-home');
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // Down -> Hero
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'hero-play');

  // Down -> Top 10
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'card-top-1');

  // Down -> Trending
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'card-trend-1');

  // Down -> Footer
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'footer-back-to-top');

  // Terminal down stays on footer
  assert.equal(engine.navigate('down'), false);
  assert.equal(engine.getActiveNodeId(), 'footer-back-to-top');

  // Up -> Trending
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'card-trend-1');

  // Up -> Top 10
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'card-top-1');

  // Up -> Hero
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'hero-play');

  // Up -> Nav
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');
});

test('TV V2 Top Nav: full D-pad horizontal navigation across all 5 header items', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerNode({ id: 'nav-shows', rowId: 'nav-row', colIndex: 1 });
  engine.registerNode({ id: 'nav-movies', rowId: 'nav-row', colIndex: 2 });
  engine.registerNode({ id: 'nav-my-list', rowId: 'nav-row', colIndex: 3 });
  engine.registerNode({ id: 'nav-search', rowId: 'nav-row', colIndex: 4 });

  engine.setFocus('nav-home');
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // Left at left edge stops at nav-home (no wrap)
  assert.equal(engine.navigate('left'), false);
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // Navigate Right across all items
  assert.equal(engine.navigate('right'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-shows');

  assert.equal(engine.navigate('right'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-movies');

  assert.equal(engine.navigate('right'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-my-list');

  assert.equal(engine.navigate('right'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-search');

  // Right at right edge stops at nav-search (no wrap)
  assert.equal(engine.navigate('right'), false);
  assert.equal(engine.getActiveNodeId(), 'nav-search');

  // UP from nav-search remains on nav-search
  assert.equal(engine.navigate('up'), false);
  assert.equal(engine.getActiveNodeId(), 'nav-search');

  // Navigate back Left to nav-home
  assert.equal(engine.navigate('left'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-my-list');
  assert.equal(engine.navigate('left'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-movies');
  assert.equal(engine.navigate('left'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-shows');
  assert.equal(engine.navigate('left'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // UP from nav-home remains on nav-home
  assert.equal(engine.navigate('up'), false);
  assert.equal(engine.getActiveNodeId(), 'nav-home');
});

test('TV V2 Smooth Hero Transition: geometric column matching between nav and hero controls', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerNode({ id: 'nav-shows', rowId: 'nav-row', colIndex: 1 });
  engine.registerNode({ id: 'nav-movies', rowId: 'nav-row', colIndex: 2 });
  engine.registerNode({ id: 'nav-my-list', rowId: 'nav-row', colIndex: 3 });
  engine.registerNode({ id: 'nav-search', rowId: 'nav-row', colIndex: 4 });

  engine.registerRow({ id: 'hero-row', order: 1 });
  engine.registerNode({ id: 'hero-play', rowId: 'hero-row', colIndex: 0 });
  engine.registerNode({ id: 'hero-details', rowId: 'hero-row', colIndex: 1 });
  engine.registerNode({ id: 'hero-list', rowId: 'hero-row', colIndex: 2 });

  // 1. From nav-home (col 0) Down -> hero-play (col 0)
  engine.setFocus('nav-home');
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'hero-play');

  // Up from hero-play (col 0) -> nav-home (col 0)
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // 2. From nav-shows (col 1) Down -> hero-details (col 1)
  engine.setFocus('nav-shows');
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'hero-details');

  // Up from hero-details (col 1) -> nav-shows (col 1)
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-shows');

  // 3. From nav-movies (col 2) Down -> hero-list (col 2)
  engine.setFocus('nav-movies');
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'hero-list');

  // Up from hero-list (col 2) -> nav-movies (col 2)
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-movies');

  // 4. From nav-my-list (col 3) Down -> hero-list (closest col 2)
  engine.setFocus('nav-my-list');
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'hero-list');

  // 5. From nav-search (col 4) Down -> hero-list (closest col 2)
  engine.setFocus('nav-search');
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'hero-list');
});

test('TV V2 Search Flow: D-pad navigation between input, results, and back restoration', () => {
  const engine = new TvFocusEngine();

  let searchClosed = false;

  // Header Nav
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-search', rowId: 'nav-row', colIndex: 4 });

  // Search Input Row
  engine.registerRow({ id: 'search-input-row', order: 1 });
  engine.registerNode({
    id: 'search-input',
    rowId: 'search-input-row',
    colIndex: 0,
    onBack: () => {
      searchClosed = true;
      engine.setFocus('nav-search');
      return true;
    },
  });

  // Search Results Row
  engine.registerRow({ id: 'search-row-0', order: 2 });
  engine.registerNode({
    id: 'search-result-0',
    rowId: 'search-row-0',
    colIndex: 0,
    onBack: () => {
      engine.setFocus('search-input');
      return true;
    },
  });
  engine.registerNode({
    id: 'search-result-1',
    rowId: 'search-row-0',
    colIndex: 1,
    onBack: () => {
      engine.setFocus('search-input');
      return true;
    },
  });

  // Open Search -> Focus search-input
  engine.setFocus('search-input');
  assert.equal(engine.getActiveNodeId(), 'search-input');

  // Down -> moves to first result (search-result-0)
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'search-result-0');

  // Right -> moves to next result (search-result-1)
  assert.equal(engine.navigate('right'), true);
  assert.equal(engine.getActiveNodeId(), 'search-result-1');

  // Back from search-result-1 returns focus to search-input
  assert.equal(engine.handleBack(), true);
  assert.equal(engine.getActiveNodeId(), 'search-input');

  // Back from search-input closes search and returns focus to nav-search
  assert.equal(engine.handleBack(), true);
  assert.equal(searchClosed, true);
  assert.equal(engine.getActiveNodeId(), 'nav-search');
});

test('TV V2 My List Empty State: Explore button returns focus to nav-home', () => {
  const engine = new TvFocusEngine();
  let explored = false;

  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerNode({ id: 'nav-my-list', rowId: 'nav-row', colIndex: 3 });

  engine.registerRow({ id: 'my-list-empty-row', order: 1 });
  engine.registerNode({
    id: 'my-list-explore-btn',
    rowId: 'my-list-empty-row',
    colIndex: 3,
    onSelect: () => {
      explored = true;
      engine.setFocus('nav-home');
    },
  });

  // Set focus on nav-my-list
  engine.setFocus('nav-my-list');

  // Down into empty state button
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'my-list-explore-btn');

  // Up returns to nav-my-list
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'nav-my-list');

  // Down again
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'my-list-explore-btn');

  // Activate explore
  assert.equal(engine.activateCurrentFocus(), true);
  assert.equal(explored, true);
  assert.equal(engine.getActiveNodeId(), 'nav-home');
});

test('TV V2 Focus Engine: pushScope preserves pendingFocusId and applies focus as soon as requested node registers', () => {
  const engine = new TvFocusEngine();

  engine.registerRow({ id: 'row-1', order: 1 });
  engine.registerNode({ id: 'card-1', rowId: 'row-1', colIndex: 0 });
  assert.equal(engine.getActiveNodeId(), 'card-1');

  // Push detail modal scope with initial node 'detail-action-play' before it is registered in DOM
  engine.pushScope('detail-scope', 'detail-action-play');
  assert.equal(engine.getScope(), 'detail-scope');

  // Now the detail modal component registers its row and nodes
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerNode({ id: 'detail-action-play', rowId: 'detail-actions-row', colIndex: 0 });
  engine.registerNode({ id: 'detail-action-list', rowId: 'detail-actions-row', colIndex: 1 });

  // Focus must land directly on detail-action-play without extra clicks
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  // Popping scope restores previous scope and card focus
  engine.popScope();
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'card-1');
});

test('TV V2 Focus Engine: UP from detail-actions-row does not escape to background nav', () => {
  const engine = new TvFocusEngine();

  // Background rows
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });
  engine.registerRow({ id: 'hero-row', order: 1 });
  engine.registerNode({ id: 'hero-play', rowId: 'hero-row', colIndex: 0 });

  // Open detail modal
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerNode({ id: 'detail-action-play', rowId: 'detail-actions-row', colIndex: 0 });

  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  // Attempting UP from detail-actions-row must NOT escape to background nav-row
  const upRes = engine.navigate('up');
  assert.equal(upRes, false);
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');
});

test('TV V2 Focus Engine: DOWN from detail-similar-row does not escape modal', () => {
  const engine = new TvFocusEngine();

  // Background rows
  engine.registerRow({ id: 'home-row-1', order: 10 });
  engine.registerNode({ id: 'card-1', rowId: 'home-row-1', colIndex: 0 });

  // Open detail modal
  engine.pushScope('detail-scope', 'detail-similar-1');
  engine.registerRow({ id: 'detail-similar-row', order: 4 });
  engine.registerNode({ id: 'detail-similar-1', rowId: 'detail-similar-row', colIndex: 0 });

  assert.equal(engine.getActiveNodeId(), 'detail-similar-1');

  // Attempting DOWN from bottom row must NOT escape to background home-row-1
  const downRes = engine.navigate('down');
  assert.equal(downRes, false);
  assert.equal(engine.getActiveNodeId(), 'detail-similar-1');
});

test('TV V2 Focus Engine: setFocus rejects background rows while in detail-scope', () => {
  const engine = new TvFocusEngine();

  // Background rows
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ id: 'nav-home', rowId: 'nav-row', colIndex: 0 });

  // Detail modal
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerNode({ id: 'detail-action-play', rowId: 'detail-actions-row', colIndex: 0 });

  // Programmatic setFocus to background node must be rejected
  const focusSuccess = engine.setFocus('nav-home');
  assert.equal(focusSuccess, false);
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');
});

test('TV V2 Focus Engine: vertical graph traverses actions -> seasons -> episodes -> similar and back', () => {
  const engine = new TvFocusEngine();

  // Detail modal rows
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerRow({ id: 'detail-seasons-row', order: 2 });
  engine.registerRow({ id: 'detail-episodes-row', order: 3 });
  engine.registerRow({ id: 'detail-similar-row', order: 4 });

  engine.registerNode({ id: 'detail-action-play', rowId: 'detail-actions-row', colIndex: 0 });
  engine.registerNode({ id: 'detail-season-1', rowId: 'detail-seasons-row', colIndex: 0 });
  engine.registerNode({ id: 'detail-episode-1', rowId: 'detail-episodes-row', colIndex: 0 });
  engine.registerNode({ id: 'detail-similar-1', rowId: 'detail-similar-row', colIndex: 0 });

  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  // Down -> seasons
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'detail-season-1');

  // Down -> episodes
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'detail-episode-1');

  // Down -> similar
  assert.equal(engine.navigate('down'), true);
  assert.equal(engine.getActiveNodeId(), 'detail-similar-1');

  // Bottom edge trapped
  assert.equal(engine.navigate('down'), false);
  assert.equal(engine.getActiveNodeId(), 'detail-similar-1');

  // Up -> episodes
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'detail-episode-1');

  // Up -> seasons
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'detail-season-1');

  // Up -> actions
  assert.equal(engine.navigate('up'), true);
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  // Top edge trapped
  assert.equal(engine.navigate('up'), false);
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');
});



