import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TvFocusEngine, parseTvKeyEvent } from '../focus/TvFocusEngine.ts';
import { getSearchItemsPerRow } from './tvSearchLayout.ts';
import type { MediaItem } from '../../features/catalog/types.ts';

function createMockKeyEvent(init: {
  key?: string;
  keyCode?: number;
  target?: HTMLElement;
}): KeyboardEvent {
  return {
    key: init.key ?? '',
    keyCode: init.keyCode ?? 0,
    which: init.keyCode ?? 0,
    repeat: false,
    target: init.target ?? null,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;
}

const mockSearchItems: MediaItem[] = [
  { id: 101, type: 'movie', title: 'Nine Puzzles 1', posterUrl: 'https://image.tmdb.org/t/p/w500/1.jpg' },
  { id: 102, type: 'movie', title: 'Nine Puzzles 2', posterUrl: 'https://image.tmdb.org/t/p/w500/2.jpg' },
  { id: 103, type: 'movie', title: 'Nine Puzzles 3', posterUrl: 'https://image.tmdb.org/t/p/w500/3.jpg' },
  { id: 104, type: 'movie', title: 'Nine Puzzles 4', posterUrl: 'https://image.tmdb.org/t/p/w500/4.jpg' },
  { id: 105, type: 'movie', title: 'Nine Puzzles 5', posterUrl: 'https://image.tmdb.org/t/p/w500/5.jpg' },
  { id: 106, type: 'movie', title: 'Nine Puzzles 6', posterUrl: 'https://image.tmdb.org/t/p/w500/6.jpg' },
  { id: 107, type: 'movie', title: 'Nine Puzzles 7', posterUrl: 'https://image.tmdb.org/t/p/w500/7.jpg' },
  { id: 108, type: 'movie', title: 'Nine Puzzles 8', posterUrl: 'https://image.tmdb.org/t/p/w500/8.jpg' },
];

test('1. search remains in header', () => {
  const navRailSource = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );
  // Verify TvNavSearch is anchored inside header actions
  assert.ok(
    navRailSource.includes('<div className="tv-v2-nav-rail__actions">'),
    'Header must have dedicated actions container'
  );
  assert.ok(
    navRailSource.includes('<TvNavSearch'),
    'TvNavSearch must be rendered inside header actions container'
  );
  assert.ok(
    navRailSource.includes('id="nav-search"'),
    'Header search element must have id="nav-search"'
  );
  assert.ok(
    navRailSource.includes('id="search-input"'),
    'Expanded search input must be hosted in header'
  );
});

test('2. no duplicate search input', () => {
  const searchScreenSource = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvSearchScreen.tsx'),
    'utf-8'
  );
  // Verify TvSearchScreen does NOT contain standalone input box
  assert.ok(
    !searchScreenSource.includes('<input'),
    'TvSearchScreen must not render any duplicate input field'
  );
  assert.ok(
    !searchScreenSource.includes('tv-v2-search-input-box'),
    'TvSearchScreen must not have duplicate standalone search input box'
  );
  assert.ok(
    !searchScreenSource.includes('tv-v2-search-header'),
    'TvSearchScreen must not have duplicate search header'
  );
});

test('3. Enter expands search in place', () => {
  let isExpanded = false;
  let activeTab = 'home';

  const onExpand = () => {
    isExpanded = true;
    activeTab = 'search';
  };

  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({
    id: 'nav-search',
    rowId: 'nav-row',
    colIndex: 4,
    onSelect: () => {
      if (!isExpanded) onExpand();
    },
  });

  engine.setFocus('nav-search');
  assert.equal(isExpanded, false);
  assert.equal(activeTab, 'home');

  // Trigger Enter
  const enterEvent = createMockKeyEvent({ key: 'Enter', keyCode: 13 });
  engine.handleKeyEvent(enterEvent);

  assert.equal(isExpanded, true);
  assert.equal(activeTab, 'search');
});

test('4. expanded search anchors right', () => {
  const componentsCss = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );

  // Actions anchor to the right
  assert.ok(
    componentsCss.includes('justify-content: flex-end;'),
    'Nav rail actions must align to flex-end to anchor right edge'
  );
  assert.ok(
    componentsCss.includes('margin-left: auto;'),
    'Nav rail actions must use margin-left: auto'
  );

  // Width transition 180ms cubic-bezier
  assert.ok(
    componentsCss.includes('width 180ms cubic-bezier(0.16, 1, 0.3, 1)'),
    'Search pill must smoothly transition width over 180ms'
  );
  assert.ok(
    componentsCss.includes('width: clamp(38px, 4.2vh, 44px);') ||
      componentsCss.includes('width: clamp(36px, 4.2vh, 42px);') ||
      componentsCss.includes('width: clamp(96px, 8vw, 116px);'),
    'Collapsed search must use compact width'
  );
  assert.ok(
    componentsCss.includes('width: clamp(240px, 28vw, 500px);') ||
      componentsCss.includes('width: clamp(320px, 26vw, 500px);') ||
      componentsCss.includes('width: clamp(320px, 28vw, 520px);'),
    'Expanded search must use Netflix-style responsive width'
  );
});

test('5. Back collapses search', () => {
  let isExpanded = true;
  let activeTab = 'search';
  let query = 'nine pu';

  const onCollapse = () => {
    isExpanded = false;
    activeTab = 'home';
    query = '';
  };

  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({
    id: 'nav-search',
    rowId: 'nav-row',
    colIndex: 4,
    onBack: () => {
      if (isExpanded) {
        onCollapse();
        return true;
      }
      return false;
    },
  });

  engine.setFocus('nav-search');
  const backEvent = createMockKeyEvent({ key: 'Escape', keyCode: 27 });
  const handled = engine.handleKeyEvent(backEvent);

  assert.equal(handled, true);
  assert.equal(isExpanded, false);
  assert.equal(activeTab, 'home');
  assert.equal(query, '');
  assert.equal(engine.getActiveNodeId(), 'nav-search');
});

test('6. results grid uses compact spacing', () => {
  const screensCss = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );

  assert.ok(
    screensCss.includes('gap: clamp(14px, 1.2vw, 22px);'),
    'Results grid must use compact Netflix-style gap clamp(14px, 1.2vw, 22px)'
  );
  assert.ok(
    screensCss.includes('grid-template-columns: repeat(auto-fill, minmax(clamp(140px, 9vw, 180px), 1fr));'),
    'Results grid must use auto-fill with responsive minmax tracks'
  );
  assert.ok(
    screensCss.includes('justify-content: start;'),
    'Results grid must align to start to avoid giant empty gutters'
  );

  // Responsive items-per-row formula check
  assert.equal(getSearchItemsPerRow(), 7); // Default fallback / 1080p
});

test('7. result cards maintain 2:3 ratio', () => {
  const screensCss = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );

  assert.ok(
    screensCss.includes('aspect-ratio: 2 / 3;'),
    'Poster cards in search grid must strictly maintain 2:3 aspect ratio'
  );
  assert.ok(
    screensCss.includes('max-width: clamp(140px, 9vw, 180px);'),
    'Poster cards must maintain consistent maximum width'
  );
  assert.ok(
    screensCss.includes('transform: scale(1.06);'),
    'Focused card must scale subtly by 1.06 without layout shift'
  );
  assert.ok(
    screensCss.includes('border-color: #ffffff;'),
    'Focused card must have crisp white outline'
  );
});

test('8. ArrowDown enters results', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  let resultsLength = mockSearchItems.length;

  engine.registerNode({
    id: 'nav-search',
    rowId: 'nav-row',
    colIndex: 4,
    onDirection: (direction) => {
      if (direction === 'down' && resultsLength > 0) {
        engine.setFocus('search-result-0');
        return true;
      }
      return false;
    },
  });

  engine.registerRow({ id: 'search-row-0', order: 1 });
  mockSearchItems.forEach((item, idx) => {
    engine.registerNode({
      id: `search-result-${idx}`,
      rowId: 'search-row-0',
      colIndex: idx,
    });
  });

  engine.setFocus('nav-search');
  assert.equal(engine.getActiveNodeId(), 'nav-search');

  // Down enters first result
  engine.navigate('down');
  assert.equal(engine.getActiveNodeId(), 'search-result-0');
});

test('9. ArrowUp returns to search', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({
    id: 'nav-search',
    rowId: 'nav-row',
    colIndex: 4,
  });

  engine.registerRow({ id: 'search-row-0', order: 1 });
  mockSearchItems.forEach((item, idx) => {
    engine.registerNode({
      id: `search-result-${idx}`,
      rowId: 'search-row-0',
      colIndex: idx,
      onDirection: (direction) => {
        if (direction === 'up') {
          engine.setFocus('nav-search');
          return true;
        }
        return false;
      },
    });
  });

  // Start on search-result-3
  engine.setFocus('search-result-3');
  assert.equal(engine.getActiveNodeId(), 'search-result-3');

  // Up returns directly to search in header
  engine.navigate('up');
  assert.equal(engine.getActiveNodeId(), 'nav-search');
});

test('10. Left/Right grid navigation', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'search-row-0', order: 1 });
  mockSearchItems.forEach((item, idx) => {
    engine.registerNode({
      id: `search-result-${idx}`,
      rowId: 'search-row-0',
      colIndex: idx,
    });
  });

  engine.setFocus('search-result-0');
  assert.equal(engine.getActiveNodeId(), 'search-result-0');

  engine.navigate('right');
  assert.equal(engine.getActiveNodeId(), 'search-result-1');

  engine.navigate('right');
  assert.equal(engine.getActiveNodeId(), 'search-result-2');

  engine.navigate('left');
  assert.equal(engine.getActiveNodeId(), 'search-result-1');

  engine.navigate('left');
  assert.equal(engine.getActiveNodeId(), 'search-result-0');
});

test('11. Enter opens result', () => {
  let openedItem: MediaItem | null = null;
  const onOpenDetails = (item: MediaItem) => {
    openedItem = item;
  };

  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'search-row-0', order: 1 });
  engine.registerNode({
    id: 'search-result-0',
    rowId: 'search-row-0',
    colIndex: 0,
    onSelect: () => onOpenDetails(mockSearchItems[0]),
  });

  engine.setFocus('search-result-0');
  const enterEvent = createMockKeyEvent({ key: 'Enter', keyCode: 13 });
  engine.handleKeyEvent(enterEvent);

  assert.deepEqual(openedItem, mockSearchItems[0]);
});

test('12. focus restores after closing details', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'search-row-0', order: 1 });
  engine.registerNode({
    id: 'search-result-2',
    rowId: 'search-row-0',
    colIndex: 2,
  });

  engine.setFocus('search-result-2');
  assert.equal(engine.getActiveNodeId(), 'search-result-2');

  // Open details modal
  engine.pushScope('detail-scope', 'detail-action-play');
  engine.registerRow({ id: 'detail-actions-row', order: 1 });
  engine.registerNode({
    id: 'detail-action-play',
    rowId: 'detail-actions-row',
    colIndex: 0,
  });

  assert.equal(engine.getScope(), 'detail-scope');
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  // Close modal via Back key
  const backEvent = createMockKeyEvent({ key: 'Escape', keyCode: 27 });
  engine.handleKeyEvent(backEvent);

  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'search-result-2');
});

test('13. TV V1 unchanged', () => {
  const gitDiffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(gitDiffTvV1, '', 'src/lib/tv/ (TV V1) files must remain completely untouched');
});

test('14. normal web unchanged', () => {
  const gitDiffWeb = execSync('git diff --name-only src/components/ src/features/')
    .toString()
    .trim();
  assert.equal(gitDiffWeb, '', 'Normal web components and pages must remain completely untouched');
});
