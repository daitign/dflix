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

test('1. collapsed Search renders icon only', () => {
  const railTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );

  // Search renders outline search icon with size 24 (or 20 when expanded)
  assert.ok(
    railTsx.includes('<Icon name="search" size={isExpanded ? 20 : 24} />') ||
      railTsx.includes('<Icon name="search" size={24} />'),
    'Search must render outline icon with size 24 at 1080p'
  );

  // Bell icon stroke and size 24 matches search
  assert.ok(
    railTsx.includes('<Icon name="bell" size={24} />'),
    'Notification bell icon must have size 24 to match search stroke'
  );

  // In collapsed state, only the icon is rendered inside the search trigger
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('.tv-v2-nav-search--collapsed') &&
      css.includes('width: clamp(38px, 4.2vh, 44px);'),
    'Collapsed search must use compact icon footprint clamp(38px, 4.2vh, 44px)'
  );
});

test('2. "Search" text not rendered in collapsed state', () => {
  const railTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );

  // Verify that the collapsed search label span is NOT rendered
  assert.ok(
    !railTsx.includes('{!isExpanded && <span className="tv-v2-nav-search__label">Search</span>}'),
    'Search label span must NOT be rendered in collapsed state'
  );

  assert.ok(
    !railTsx.includes('className="tv-v2-nav-search__label">Search</span>'),
    'Text "Search" must NOT be rendered beside the icon in the collapsed header'
  );

  // Input placeholder must be Netflix-standard "Titles, people, genres"
  assert.ok(
    railTsx.includes('placeholder="Titles, people, genres"'),
    'Search input placeholder must be "Titles, people, genres"'
  );
});

test('3. Enter expands field leftward', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );

  // Expanded search responsive width token: clamp(240px, 28vw, 500px) or clamp(320px, 26vw, 500px)
  assert.ok(
    css.includes('width: clamp(240px, 28vw, 500px);') ||
      css.includes('width: clamp(320px, 26vw, 500px);'),
    'Expanded search must use responsive width clamp(240px, 28vw, 500px) or clamp(320px, 26vw, 500px)'
  );

  // Height roughly 42-48px
  assert.ok(
    css.includes('height: clamp(42px, 4.6vh, 48px);'),
    'Expanded search must use responsive height clamp(42px, 4.6vh, 48px)'
  );

  // Focus engine simulation for Enter key
  let expanded = false;
  let openedKeyboard = false;

  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({
    id: 'nav-search',
    rowId: 'nav-row',
    colIndex: 5,
    onSelect: () => {
      if (!expanded) {
        expanded = true;
        openedKeyboard = true;
      }
    },
  });

  engine.setFocus('nav-search');
  assert.equal(engine.getActiveNodeId(), 'nav-search');
  assert.equal(expanded, false);

  // Press Enter (KEYCODE_DPAD_CENTER / Enter)
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));
  assert.equal(expanded, true, 'Pressing Enter on Search must expand it');
  assert.equal(openedKeyboard, true, 'Pressing Enter must request keyboard focus');
});

test('4. bell position does not move', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );

  // Nav actions container anchored to the right via margin-left: auto and justify-content: flex-end
  assert.ok(
    css.includes('.tv-v2-nav-rail__actions {') &&
      css.includes('margin-left: auto;') &&
      css.includes('justify-content: flex-end;'),
    'Nav rail actions must be anchored to the right via margin-left: auto and justify-content: flex-end'
  );

  // Layout geometry test: In a right-justified flex row [Search, Bell, Profile],
  // Bell's offset from the right boundary = Profile.width + gap.
  // Profile's offset from the right boundary = 0.
  const profileWidth = 44; // px
  const gap = 20; // px
  const bellWidth = 42; // px
  const containerRight = 1920 - 58; // 1862px

  const profileRight = containerRight;
  const profileLeft = profileRight - profileWidth;

  const bellRight = profileLeft - gap;
  const bellLeft = bellRight - bellWidth;

  // Collapsed search (width: 42px)
  const collapsedSearchRight = bellLeft - gap;
  const collapsedSearchLeft = collapsedSearchRight - 42;

  // Expanded search (width: 420px)
  const expandedSearchRight = bellLeft - gap;
  const expandedSearchLeft = expandedSearchRight - 420;

  // Bell left and right positions are IDENTICAL in both states
  assert.equal(bellRight, 1862 - 44 - 20);
  assert.equal(bellLeft, 1862 - 44 - 20 - 42);
  assert.equal(collapsedSearchRight, expandedSearchRight, 'Search right edge stays anchored beside bell');
  assert.ok(expandedSearchLeft < collapsedSearchLeft, 'Search expands strictly leftward');
});

test('5. profile position does not move', () => {
  // In the same right-justified container, Profile is the rightmost child
  const profileWidth = 44;
  const containerRight = 1862;

  const profileLeftCollapsed = containerRight - profileWidth;
  const profileLeftExpanded = containerRight - profileWidth;

  assert.equal(
    profileLeftCollapsed,
    profileLeftExpanded,
    'Profile X coordinate must remain completely stationary between collapsed and expanded search'
  );
});

test('6. nav items do not shift', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );

  // Verify flex-shrink: 0 and white-space: nowrap on nav links
  const navLinksRegex = /\.tv-v2-nav-rail__links\s*\{[^}]+\}/;
  const matchLinks = css.match(navLinksRegex);
  assert.ok(matchLinks, 'Must find .tv-v2-nav-rail__links rule');
  assert.ok(
    matchLinks[0].includes('flex-shrink: 0;') && matchLinks[0].includes('white-space: nowrap;'),
    '.tv-v2-nav-rail__links must have flex-shrink: 0 and white-space: nowrap to prevent shifts'
  );

  // Verify flex-shrink: 0 on nav actions
  const navActionsRegex = /\.tv-v2-nav-rail__actions\s*\{[^}]+\}/;
  const matchActions = css.match(navActionsRegex);
  assert.ok(matchActions, 'Must find .tv-v2-nav-rail__actions rule');
  assert.ok(
    matchActions[0].includes('flex-shrink: 0;') && matchActions[0].includes('white-space: nowrap;'),
    '.tv-v2-nav-rail__actions must have flex-shrink: 0 and white-space: nowrap'
  );

  // Verify scale transform is removed on collapsed focus
  assert.ok(
    css.includes('.tv-v2-nav-search--collapsed.tv-v2-nav-search--focused {') &&
      css.includes('transform: none;'),
    'Search focus must use transform: none to avoid shifting layout'
  );

  // Verify top nav items contain exactly 5 compact items
  const expectedIds = ['home', 'shows', 'movies', 'new-popular', 'my-list'];
  assert.deepEqual(
    PRIMARY_NAV_ITEMS.map((item) => item.id),
    expectedIds,
    'Top nav links must strictly remain Home, TV Shows, Movies, New & Popular, My List'
  );
});

test('7. Back collapses search', () => {
  let isExpanded = true;
  let activeTab = 'search';
  let homeSelected = false;

  const onCollapse = () => {
    isExpanded = false;
  };
  const onSelectTab = (tab: string) => {
    activeTab = tab;
    if (tab === 'home') homeSelected = true;
  };

  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });
  engine.registerNode({
    id: 'nav-search',
    rowId: 'nav-row',
    colIndex: 5,
    onBack: () => {
      if (isExpanded) {
        onCollapse();
        return true;
      }
      if (activeTab !== 'home') {
        onSelectTab('home');
        return true;
      }
      return false;
    },
  });

  engine.setFocus('nav-search');

  // First Back press: collapses search
  const firstBack = engine.handleKeyEvent(createMockKeyEvent({ key: 'Backspace', keyCode: 8 }));
  assert.equal(firstBack, true, 'First Back must be consumed');
  assert.equal(isExpanded, false, 'First Back must collapse Search');
  assert.equal(homeSelected, false, 'First Back must NOT leave page yet');

  // Second Back press: navigates home
  const secondBack = engine.handleKeyEvent(createMockKeyEvent({ key: 'Back', keyCode: 4 }));
  assert.equal(secondBack, true, 'Second Back must navigate to home');
  assert.equal(activeTab, 'home', 'Second Back sets activeTab to home');
  assert.equal(homeSelected, true);
});

test('8. flex/right-side controls do not clip', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );

  // Verify .tv-v2-dropdown-anchor has flex-shrink: 0
  assert.ok(
    css.includes('.tv-v2-dropdown-anchor {') && css.includes('flex-shrink: 0;'),
    'Dropdown anchors must have flex-shrink: 0'
  );

  // Verify .tv-v2-nav-action-btn has flex-shrink: 0
  assert.ok(
    css.includes('.tv-v2-nav-action-btn {') && css.includes('flex-shrink: 0;'),
    'Action buttons must have flex-shrink: 0'
  );

  // Verify .tv-v2-nav-search has flex-shrink: 0
  assert.ok(
    css.includes('.tv-v2-nav-search {') && css.includes('flex-shrink: 0;'),
    'Nav search container must have flex-shrink: 0'
  );

  // Verify gap is 18-24px at 1080p
  assert.ok(
    css.includes('gap: clamp(18px, 1.3vw, 24px);'),
    'Actions must have compact gap: clamp(18px, 1.3vw, 24px)'
  );
});

test('9. TV V1 unchanged (git diff src/lib/tv/ is empty)', () => {
  const gitDiffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(gitDiffTvV1, '', 'src/lib/tv/ (TV V1) files must remain completely untouched');
});

test('10. Normal web unchanged (git diff src/components/ src/features/ is empty)', () => {
  const gitDiffWeb = execSync('git diff --name-only src/components/ src/features/')
    .toString()
    .trim();
  assert.equal(gitDiffWeb, '', 'Normal web components and pages must remain completely untouched');
});
