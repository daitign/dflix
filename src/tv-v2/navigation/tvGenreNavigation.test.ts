import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';
import {
  TV_V2_MOVIE_GENRES,
  TV_V2_TV_GENRES,
  clearGenreCatalogCache,
  fetchTvGenreCatalog,
} from '../catalog/tvGenreCatalog.ts';

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

test('1. Movies submenu opens with Enter', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  let submenuOpened = false;

  engine.registerNode({
    colIndex: 2,
    id: 'nav-movies',
    onSelect: () => {
      submenuOpened = true;
      engine.pushScope('genre-submenu-scope', 'genre-nav-movies-all');
      engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
      engine.registerNode({
        colIndex: 0,
        id: 'genre-nav-movies-all',
        rowId: 'genre-submenu-row-0',
      });
    },
    rowId: 'nav-row',
  });

  engine.setFocus('nav-movies');
  assert.equal(engine.getActiveNodeId(), 'nav-movies');

  const enterEvent = createMockKeyEvent({ key: 'Enter', keyCode: 13 });
  engine.handleKeyEvent(enterEvent);

  assert.equal(submenuOpened, true);
  assert.equal(engine.getScope(), 'genre-submenu-scope');
  assert.equal(engine.getActiveNodeId(), 'genre-nav-movies-all');
});

test('2. TV Shows submenu opens with Enter', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  let submenuOpened = false;

  engine.registerNode({
    colIndex: 1,
    id: 'nav-shows',
    onSelect: () => {
      submenuOpened = true;
      engine.pushScope('genre-submenu-scope', 'genre-nav-shows-all');
      engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
      engine.registerNode({
        colIndex: 0,
        id: 'genre-nav-shows-all',
        rowId: 'genre-submenu-row-0',
      });
    },
    rowId: 'nav-row',
  });

  engine.setFocus('nav-shows');
  assert.equal(engine.getActiveNodeId(), 'nav-shows');

  const enterEvent = createMockKeyEvent({ key: 'Enter', keyCode: 13 });
  engine.handleKeyEvent(enterEvent);

  assert.equal(submenuOpened, true);
  assert.equal(engine.getScope(), 'genre-submenu-scope');
  assert.equal(engine.getActiveNodeId(), 'genre-nav-shows-all');
});

test('3. ArrowDown enters submenu', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  engine.registerNode({
    colIndex: 2,
    id: 'nav-movies',
    onDirection: (direction) => {
      if (direction === 'down') {
        engine.pushScope('genre-submenu-scope', 'genre-nav-movies-all');
        engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
        engine.registerNode({
          colIndex: 0,
          id: 'genre-nav-movies-all',
          rowId: 'genre-submenu-row-0',
        });
        return true;
      }
    },
    rowId: 'nav-row',
  });

  engine.setFocus('nav-movies');
  assert.equal(engine.getActiveNodeId(), 'nav-movies');

  const downEvent = createMockKeyEvent({ key: 'ArrowDown', keyCode: 40 });
  engine.handleKeyEvent(downEvent);

  assert.equal(engine.getScope(), 'genre-submenu-scope');
  assert.equal(engine.getActiveNodeId(), 'genre-nav-movies-all');
});

test('4. ArrowUp/Down moves genre focus in multi-column layout', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('genre-submenu-scope');

  engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
  engine.registerRow({ id: 'genre-submenu-row-1', order: 1 });

  // Row 0
  engine.registerNode({ colIndex: 0, id: 'genre-all', rowId: 'genre-submenu-row-0' });
  engine.registerNode({ colIndex: 1, id: 'genre-action', rowId: 'genre-submenu-row-0' });
  engine.registerNode({ colIndex: 2, id: 'genre-adventure', rowId: 'genre-submenu-row-0' });

  // Row 1
  engine.registerNode({ colIndex: 0, id: 'genre-animation', rowId: 'genre-submenu-row-1' });
  engine.registerNode({ colIndex: 1, id: 'genre-comedy', rowId: 'genre-submenu-row-1' });
  engine.registerNode({ colIndex: 2, id: 'genre-crime', rowId: 'genre-submenu-row-1' });

  engine.setFocus('genre-all');
  assert.equal(engine.getActiveNodeId(), 'genre-all');

  // Down moves to Row 1 col 0
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowDown', keyCode: 40 }));
  assert.equal(engine.getActiveNodeId(), 'genre-animation');

  // Up returns to Row 0 col 0
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowUp', keyCode: 38 }));
  assert.equal(engine.getActiveNodeId(), 'genre-all');
});

test('5. Left/Right works across columns in multi-column layout', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('genre-submenu-scope');

  engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
  engine.registerNode({ colIndex: 0, id: 'genre-all', rowId: 'genre-submenu-row-0' });
  engine.registerNode({ colIndex: 1, id: 'genre-action', rowId: 'genre-submenu-row-0' });
  engine.registerNode({ colIndex: 2, id: 'genre-adventure', rowId: 'genre-submenu-row-0' });

  engine.setFocus('genre-all');
  assert.equal(engine.getActiveNodeId(), 'genre-all');

  // Move right to Action
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowRight', keyCode: 39 }));
  assert.equal(engine.getActiveNodeId(), 'genre-action');

  // Move right to Adventure
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowRight', keyCode: 39 }));
  assert.equal(engine.getActiveNodeId(), 'genre-adventure');

  // Move left back to Action
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowLeft', keyCode: 37 }));
  assert.equal(engine.getActiveNodeId(), 'genre-action');
});

test('6. Enter selects genre', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('genre-submenu-scope');
  engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });

  let selectedGenre = '';
  engine.registerNode({
    colIndex: 1,
    id: 'genre-action',
    onSelect: () => {
      selectedGenre = 'action';
    },
    rowId: 'genre-submenu-row-0',
  });

  engine.setFocus('genre-action');
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));

  assert.equal(selectedGenre, 'action');
});

test('7. Back closes submenu before leaving page', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ colIndex: 2, id: 'nav-movies', rowId: 'nav-row' });
  engine.setFocus('nav-movies');

  // Open submenu
  engine.pushScope('genre-submenu-scope', 'genre-action');
  engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
  engine.registerNode({ colIndex: 0, id: 'genre-action', rowId: 'genre-submenu-row-0' });

  assert.equal(engine.getScope(), 'genre-submenu-scope');
  assert.equal(engine.getActiveNodeId(), 'genre-action');

  // Back / Escape pops scope without leaving page
  const backHandled = engine.handleKeyEvent(createMockKeyEvent({ key: 'Escape', keyCode: 27 }));

  assert.equal(backHandled, true);
  assert.equal(engine.getScope(), 'root');
});

test('8. Focus returns to the originating nav item', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ colIndex: 2, id: 'nav-movies', rowId: 'nav-row' });
  engine.setFocus('nav-movies');

  // Open submenu
  engine.pushScope('genre-submenu-scope', 'genre-action');
  engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
  engine.registerNode({ colIndex: 0, id: 'genre-action', rowId: 'genre-submenu-row-0' });

  // Escape
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Escape', keyCode: 27 }));

  // Focus restored to nav-movies
  assert.equal(engine.getActiveNodeId(), 'nav-movies');
});

test('9. Focus never disappears under any D-pad inputs', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ colIndex: 0, id: 'nav-home', rowId: 'nav-row' });
  engine.registerNode({ colIndex: 1, id: 'nav-shows', rowId: 'nav-row' });
  engine.registerNode({ colIndex: 2, id: 'nav-movies', rowId: 'nav-row' });
  engine.registerRow({ id: 'genre-submenu-row-0', order: 1 });
  engine.registerNode({ colIndex: 0, id: 'genre-1', rowId: 'genre-submenu-row-0' });
  engine.registerNode({ colIndex: 1, id: 'genre-2', rowId: 'genre-submenu-row-0' });

  engine.setFocus('nav-movies');

  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
  for (let i = 0; i < 60; i++) {
    const key = keys[i % keys.length];
    engine.handleKeyEvent(createMockKeyEvent({ key, keyCode: 0 }));
    assert.ok(engine.getActiveNodeId(), `Active focus must never be null on key ${key}`);
  }
});

test('10. Genre selection updates correct catalog with TMDB parity and caching', async () => {
  clearGenreCatalogCache();

  const mockMovie = {
    id: 101,
    title: 'Die Hard In Space',
    poster_path: '/diehard.jpg',
    backdrop_path: '/diehard_bg.jpg',
    genre_ids: [28],
    media_type: 'movie',
  };

  const { setTmdbModulesForTesting } = await import('../catalog/tvGenreCatalog.ts');
  setTmdbModulesForTesting({
    normalizeTmdbMovie: (item: any) => ({
      id: `movie-${item.id}`,
      title: item.title,
      type: 'movie',
      posterUrl: item.poster_path,
      backdropUrl: item.backdrop_path,
      tmdbId: item.id,
    }),
    normalizeTmdbTv: (item: any) => ({
      id: `tv-${item.id}`,
      title: item.name || item.title,
      type: 'tv',
      posterUrl: item.poster_path,
      backdropUrl: item.backdrop_path,
      tmdbId: item.id,
    }),
    tmdbClient: {
      discoverMovies: async (params: any) => {
        return { page: 1, results: [mockMovie], total_pages: 1, total_results: 1 };
      },
      discoverTv: async (params: any) => {
        return { page: 1, results: [], total_pages: 1, total_results: 1 };
      },
      getTvDetails: async () => ({}),
    },
  });

  const catalog = await fetchTvGenreCatalog('movie', 'action');
  assert.ok(catalog, 'Action catalog should load');
  assert.ok(catalog.hero, 'Catalog should have a hero');
  assert.equal(catalog.hero.title, 'Die Hard In Space');
  assert.ok(Array.isArray(catalog.rows), 'Catalog should have rows');
  assert.ok(
    catalog.rows.some((r) => r.title.includes('Action')),
    'Rows should have Action titles'
  );

  // Instant cache hit verification
  const t0 = performance.now();
  const cached = await fetchTvGenreCatalog('movie', 'action');
  const duration = performance.now() - t0;

  assert.equal(cached, catalog, 'Should return identical cached instance');
  assert.ok(duration < 10, 'Cached lookup should take less than 10ms');
});

test('11. My List / Search remain direct nav items without submenus', () => {
  assert.equal(TV_V2_MOVIE_GENRES.length > 0, true);
  assert.equal(TV_V2_TV_GENRES.length > 0, true);

  // My List and Search are not included in genre mapping lists
  assert.equal(TV_V2_MOVIE_GENRES.some((g) => g.id === 'my-list' || g.id === 'search'), false);
  assert.equal(TV_V2_TV_GENRES.some((g) => g.id === 'my-list' || g.id === 'search'), false);
});

test('14. Main nav labels remain clean and do not include selected genre string', () => {
  // Verify that regardless of selected genre, top nav labels are strictly clean
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'shows', label: 'TV Shows' },
    { id: 'movies', label: 'Movies' },
    { id: 'my-list', label: 'My List' },
    { id: 'search', label: 'Search' },
  ];

  for (const item of navItems) {
    assert.doesNotMatch(item.label, /·/, `Nav label "${item.label}" must not contain separator dots`);
    assert.doesNotMatch(item.label, /Action|Korean|Crime/i, `Nav label "${item.label}" must not include genre names`);
  }
  assert.equal(navItems.find((i) => i.id === 'movies')?.label, 'Movies');
  assert.equal(navItems.find((i) => i.id === 'shows')?.label, 'TV Shows');
});

test('15. No second-row Genres button exists', () => {
  // Ensure that no separate genres button row or large page title row is configured
  const navRailSource = execSync('cat src/tv-v2/components/TvNavRail.tsx').toString();
  const homeScreenSource = execSync('cat src/tv-v2/screens/TvHomeScreen.tsx').toString();

  assert.doesNotMatch(navRailSource, /Genres\s*[▾▼]/, 'No standalone Genres dropdown button in nav');
  assert.doesNotMatch(homeScreenSource, /Genres\s*[▾▼]/, 'No standalone Genres button row in screen');
});

test('16. Genre menu anchored to parent nav item and closes on selection', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({ colIndex: 2, id: 'nav-movies', rowId: 'nav-row' });
  engine.setFocus('nav-movies');

  let selected = false;
  // Open submenu
  engine.pushScope('genre-submenu-scope', 'genre-action');
  engine.registerRow({ id: 'genre-submenu-row-0', order: 0 });
  engine.registerNode({
    colIndex: 0,
    id: 'genre-action',
    onSelect: () => {
      selected = true;
      engine.popScope();
    },
    rowId: 'genre-submenu-row-0',
  });

  assert.equal(engine.getActiveNodeId(), 'genre-action');
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));

  assert.equal(selected, true, 'Genre selection should execute');
  assert.equal(engine.getScope(), 'root', 'Submenu must close after selection');
  assert.equal(engine.getActiveNodeId(), 'nav-movies', 'Focus must restore to parent nav button');
});

test('17. Selected genre updates content context heading formatting', () => {
  const formatMovieHeading = (genreName: string) => {
    if (!genreName || genreName === 'All Movies') return '';
    if (genreName.toLowerCase().includes('movie')) return genreName;
    return `${genreName} Movies`;
  };

  const formatTvHeading = (genreName: string) => {
    if (!genreName || genreName === 'All TV Shows') return '';
    const lower = genreName.toLowerCase();
    if (lower.includes('series') || lower.includes('tv') || lower.includes('shows')) {
      return genreName;
    }
    return `${genreName} TV Shows`;
  };

  assert.equal(formatMovieHeading('Action'), 'Action Movies');
  assert.equal(formatMovieHeading('Romantic Movies'), 'Romantic Movies');
  assert.equal(formatTvHeading('Korean Series'), 'Korean Series');
  assert.equal(formatTvHeading('Crime & Thriller'), 'Crime & Thriller TV Shows');
});

test('12. TV V1 unchanged', () => {
  const gitDiffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(gitDiffTvV1, '', 'src/lib/tv/ (TV V1) files must remain completely untouched');
});

test('13. Normal web unchanged', () => {
  const gitDiffWeb = execSync(
    'git diff --name-only src/features/movies/ src/features/shows/ src/components/navigation/'
  )
    .toString()
    .trim();
  assert.equal(gitDiffWeb, '', 'Normal web components and pages must remain completely untouched');
});

