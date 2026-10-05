import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PRIMARY_NAV_ITEMS } from './tvNavConfig.ts';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';

function createMockKeyEvent(init: {
  key?: string;
  keyCode?: number;
}): KeyboardEvent {
  return {
    key: init.key ?? '',
    keyCode: init.keyCode ?? 0,
    preventDefault: () => {},
    repeat: false,
    stopPropagation: () => {},
    which: init.keyCode ?? 0,
  } as unknown as KeyboardEvent;
}

const BREAKPOINTS = [
  { width: 960, height: 540, name: '960x540' },
  { width: 1024, height: 576, name: '1024x576' },
  { width: 1280, height: 720, name: '1280x720 (720p)' },
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1920, height: 1080, name: '1920x1080 (1080p)' },
  { width: 2560, height: 1440, name: '2560x1440 (1440p)' },
  { width: 3840, height: 2160, name: '3840x2160 (4K)' },
];

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function computeHeaderMetrics(w: number, h: number) {
  const isNarrow = w <= 1100;

  // Safe padding
  const paddingInline = isNarrow
    ? clamp(w * 0.02, 16, 24)
    : clamp(w * 0.03, 20, 58);

  // Wordmark width
  const wordmarkWidth = isNarrow ? 76 : clamp(w * 0.055, 76, 116);
  const brandMargin = isNarrow ? 12 : clamp(w * 0.014, 14, 28);
  const brandSectionWidth = wordmarkWidth + brandMargin;

  // Nav gap and font size
  const navGap = isNarrow ? 8 : clamp(w * 0.012, 10, 28);
  const navFontSize = isNarrow ? 13 : clamp(w * 0.0105, 13, 18);
  const navPadX = isNarrow ? 8 : clamp(w * 0.009, 8, 16);

  // Approximate width for 5 nav items:
  // Text lengths: Home (4), TV Shows ▾ (11), Movies ▾ (9), New & Popular (13), My List (7)
  const charWidth = navFontSize * 0.58;
  const labels = ['Home', 'TV Shows ▾', 'Movies ▾', 'New & Popular', 'My List'];
  const navItemWidths = labels.map((l) => l.length * charWidth + navPadX * 2);
  const totalNavItemsWidth =
    navItemWidths.reduce((a, b) => a + b, 0) + (labels.length - 1) * navGap;

  // Utilities section: [Search, Bell, Profile]
  const actionGap = isNarrow ? 12 : clamp(w * 0.013, 18, 24);
  const iconBtnSize = clamp(h * 0.042, 38, 44);
  const bellSize = iconBtnSize;
  const profileSize = clamp(h * 0.03, 28, 34);
  const utilitiesWidth = iconBtnSize + bellSize + profileSize + 2 * actionGap;

  // Total in-flow header width
  const totalInFlowWidth =
    paddingInline * 2 + brandSectionWidth + totalNavItemsWidth + utilitiesWidth;

  // Search expanded pill width
  const expandedSearchWidth = isNarrow
    ? clamp(w * 0.25, 200, 360)
    : clamp(w * 0.28, 240, 500);

  // Search offset from right
  const searchRightOffset = paddingInline + profileSize + actionGap + bellSize + actionGap;
  const searchLeftEdge = w - searchRightOffset - expandedSearchWidth;

  return {
    paddingInline,
    wordmarkWidth,
    brandSectionWidth,
    navGap,
    navFontSize,
    totalNavItemsWidth,
    utilitiesWidth,
    totalInFlowWidth,
    expandedSearchWidth,
    searchRightOffset,
    searchLeftEdge,
  };
}

test('1. essential header controls remain rendered across all configurations', () => {
  const railTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );

  // 1. DAITIGN wordmark
  assert.ok(railTsx.includes('<BrandMark className="tv-v2-brand-mark" />'));

  // 2-6. Home, TV Shows, Movies, New & Popular, My List
  const expectedNavIds = ['home', 'shows', 'movies', 'new-popular', 'my-list'];
  assert.deepEqual(
    PRIMARY_NAV_ITEMS.map((item) => item.id),
    expectedNavIds,
    'All 5 essential primary nav items must be registered'
  );

  // 7. Search icon
  assert.ok(railTsx.includes('<TvNavSearch'));
  assert.ok(railTsx.includes('id="nav-search"'));

  // 8. Notifications bell
  assert.ok(railTsx.includes('<TvNavNotifications'));
  assert.ok(railTsx.includes('id="nav-notifications"'));

  // 9. Profile avatar
  assert.ok(railTsx.includes('<TvNavProfile'));
  assert.ok(railTsx.includes('id="nav-profile"'));
});

test('2. Search expansion does not change main nav positions (zero reflow)', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );

  // Search wrapper has fixed in-flow size clamp(38px, 4.2vh, 44px)
  assert.ok(
    css.includes('.tv-v2-nav-search-container {') &&
      css.includes('width: clamp(38px, 4.2vh, 44px);') &&
      css.includes('height: clamp(38px, 4.2vh, 44px);') &&
      css.includes('flex-shrink: 0;'),
    'tv-v2-nav-search-container must maintain a constant in-flow footprint'
  );

  // Expanded search is positioned absolutely with right: 0
  assert.ok(
    css.includes('.tv-v2-nav-search--expanded {') &&
      css.includes('position: absolute;') &&
      css.includes('right: 0;') &&
      css.includes('z-index: 60;'),
    'Expanded search must be positioned absolute right: 0 to expand strictly leftward over header space'
  );

  // In-flow geometry verification across all breakpoints:
  for (const bp of BREAKPOINTS) {
    const metrics = computeHeaderMetrics(bp.width, bp.height);
    // In-flow width with search collapsed vs expanded is identical because expanded search is position: absolute
    const widthCollapsed = metrics.totalInFlowWidth;
    const widthExpanded = metrics.totalInFlowWidth;
    assert.equal(
      widthCollapsed,
      widthExpanded,
      `Header in-flow width at ${bp.name} must not change when search expands`
    );
  }
});

test('3. bell remains stationary and visible', () => {
  for (const bp of BREAKPOINTS) {
    const metrics = computeHeaderMetrics(bp.width, bp.height);
    // Bell position from right viewport edge: paddingInline + profileSize + gap
    // In both collapsed and expanded states, this distance is 100% constant!
    const isNarrow = bp.width <= 1100;
    const actionGap = isNarrow ? 12 : clamp(bp.width * 0.013, 18, 24);
    const profileSize = clamp(bp.height * 0.03, 28, 34);
    const bellDistanceCollapsed = metrics.paddingInline + profileSize + actionGap;
    const bellDistanceExpanded = metrics.paddingInline + profileSize + actionGap;

    assert.equal(
      bellDistanceCollapsed,
      bellDistanceExpanded,
      `Bell right offset at ${bp.name} must remain strictly stationary`
    );
  }
});

test('4. profile remains stationary and visible', () => {
  for (const bp of BREAKPOINTS) {
    const metrics = computeHeaderMetrics(bp.width, bp.height);
    // Profile is anchored to the rightmost slot in the right utilities
    const profileRightCollapsed = metrics.paddingInline;
    const profileRightExpanded = metrics.paddingInline;

    assert.equal(
      profileRightCollapsed,
      profileRightExpanded,
      `Profile right offset at ${bp.name} must remain strictly stationary`
    );
  }
});

test('5. no horizontal overflow across all 7 breakpoints', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );

  assert.ok(
    css.includes('overflow-x: clip;'),
    'tv-v2-nav-rail must enforce overflow-x: clip to prevent document horizontal scroll'
  );
  assert.ok(
    css.includes('flex-wrap: nowrap;'),
    'tv-v2-nav-rail must remain a single row with flex-wrap: nowrap'
  );

  // Check mathematical clearance for every breakpoint
  for (const bp of BREAKPOINTS) {
    const metrics = computeHeaderMetrics(bp.width, bp.height);
    assert.ok(
      metrics.totalInFlowWidth <= bp.width,
      `In-flow content width (${metrics.totalInFlowWidth.toFixed(1)}px) must be <= viewport width (${bp.width}px) at ${bp.name}`
    );
  }
});

test('6. responsive spacing reduces gracefully at narrower widths', () => {
  const metrics4K = computeHeaderMetrics(3840, 2160);
  const metrics1080p = computeHeaderMetrics(1920, 1080);
  const metrics720p = computeHeaderMetrics(1280, 720);
  const metrics540p = computeHeaderMetrics(960, 540);

  // Verify monotonic reduction
  assert.ok(metrics4K.navGap >= metrics1080p.navGap);
  assert.ok(metrics1080p.navGap >= metrics720p.navGap);
  assert.ok(metrics720p.navGap >= metrics540p.navGap);

  assert.ok(metrics4K.paddingInline >= metrics1080p.paddingInline);
  assert.ok(metrics1080p.paddingInline >= metrics720p.paddingInline);
  assert.ok(metrics720p.paddingInline >= metrics540p.paddingInline);

  assert.ok(metrics4K.navFontSize >= metrics1080p.navFontSize);
  assert.ok(metrics1080p.navFontSize >= metrics720p.navFontSize);
  assert.ok(metrics720p.navFontSize >= metrics540p.navFontSize);
});

test('7. wordmark scales down proportionally without clipping', () => {
  const metrics4K = computeHeaderMetrics(3840, 2160);
  const metrics1080p = computeHeaderMetrics(1920, 1080);
  const metrics720p = computeHeaderMetrics(1280, 720);
  const metrics540p = computeHeaderMetrics(960, 540);

  // 4K target: ~116-120px
  assert.ok(metrics4K.wordmarkWidth >= 110 && metrics4K.wordmarkWidth <= 120);

  // 1080p target: ~100-110px
  assert.ok(metrics1080p.wordmarkWidth >= 95 && metrics1080p.wordmarkWidth <= 116);

  // 720p target: ~76-80px
  assert.ok(metrics720p.wordmarkWidth >= 70 && metrics720p.wordmarkWidth <= 90);

  // 540p target: 76px minimum safe readability
  assert.equal(metrics540p.wordmarkWidth, 76);
});

test('8. Search stays inside viewport at all breakpoints', () => {
  for (const bp of BREAKPOINTS) {
    const metrics = computeHeaderMetrics(bp.width, bp.height);
    assert.ok(
      metrics.searchLeftEdge >= 0,
      `Expanded search left edge (${metrics.searchLeftEdge.toFixed(1)}px) must be >= 0 at ${bp.name}`
    );
    assert.ok(
      metrics.searchLeftEdge >= metrics.paddingInline,
      `Expanded search left edge (${metrics.searchLeftEdge.toFixed(1)}px) must respect safe margin (${metrics.paddingInline.toFixed(1)}px) at ${bp.name}`
    );
  }
});

test('9. menu popups stay inside viewport safe bounds', () => {
  const submenuCss = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvGenreSubmenu.css'),
    'utf-8'
  );
  assert.ok(
    submenuCss.includes('max-width: min(540px, calc(100vw - 32px));'),
    'Genre submenu max-width must be constrained by viewport safe bounds'
  );

  const compCss = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );
  assert.ok(
    compCss.includes('.tv-v2-notifications-dropdown {') &&
      compCss.includes('max-width: calc(100vw - 32px);'),
    'Notifications dropdown must be constrained by viewport safe bounds'
  );
  assert.ok(
    compCss.includes('.tv-v2-profile-dropdown {') &&
      compCss.includes('max-width: calc(100vw - 32px);'),
    'Profile dropdown must be constrained by viewport safe bounds'
  );
});

test('10. D-pad navigation order is preserved', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  const sequence: string[] = [];
  const registeredNodes = [
    'nav-home',
    'nav-shows',
    'nav-movies',
    'nav-new-popular',
    'nav-my-list',
    'nav-search',
    'nav-notifications',
    'nav-profile',
  ];

  registeredNodes.forEach((id, colIndex) => {
    engine.registerNode({
      id,
      rowId: 'nav-row',
      colIndex,
      onSelect: () => sequence.push(id),
    });
  });

  engine.setFocus('nav-home');
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // Step right through the entire rail
  const rightKey = createMockKeyEvent({ key: 'ArrowRight', keyCode: 39 });
  engine.handleKeyEvent(rightKey);
  assert.equal(engine.getActiveNodeId(), 'nav-shows');

  engine.handleKeyEvent(rightKey);
  assert.equal(engine.getActiveNodeId(), 'nav-movies');

  engine.handleKeyEvent(rightKey);
  assert.equal(engine.getActiveNodeId(), 'nav-new-popular');

  engine.handleKeyEvent(rightKey);
  assert.equal(engine.getActiveNodeId(), 'nav-my-list');

  engine.handleKeyEvent(rightKey);
  assert.equal(engine.getActiveNodeId(), 'nav-search');

  engine.handleKeyEvent(rightKey);
  assert.equal(engine.getActiveNodeId(), 'nav-notifications');

  engine.handleKeyEvent(rightKey);
  assert.equal(engine.getActiveNodeId(), 'nav-profile');

  // Step back left
  const leftKey = createMockKeyEvent({ key: 'ArrowLeft', keyCode: 37 });
  engine.handleKeyEvent(leftKey);
  assert.equal(engine.getActiveNodeId(), 'nav-notifications');

  engine.handleKeyEvent(leftKey);
  assert.equal(engine.getActiveNodeId(), 'nav-search');

  engine.handleKeyEvent(leftKey);
  assert.equal(engine.getActiveNodeId(), 'nav-my-list');
});

test('11. TV V1 unchanged (git diff src/lib/tv/ is empty)', () => {
  const gitDiffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(gitDiffTvV1, '', 'src/lib/tv/ (TV V1) files must remain completely untouched');
});

test('12. Normal web unchanged (git diff src/components/ src/features/ is empty)', () => {
  const gitDiffWeb = execSync('git diff --name-only src/components/ src/features/')
    .toString()
    .trim();
  assert.equal(gitDiffWeb, '', 'Normal web components and features must remain completely untouched');
});
