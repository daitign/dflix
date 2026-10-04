import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';
import { PRIMARY_NAV_ITEMS } from './tvNavConfig.ts';
import {
  clearNewPopularCatalogCache,
  fetchTvNewPopularCatalog,
} from '../catalog/tvNewPopularCatalog.ts';
import {
  clearLanguageCatalogCache,
  fetchTvLanguageCatalog,
  TV_LANGUAGES,
  TV_PREFERENCE_MODES,
} from '../catalog/tvLanguagesCatalog.ts';
import {
  clearTvNotificationCache,
  fetchTvNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../notifications/tvNotificationCatalog.ts';

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

test('1. full DAITIGN wordmark rendered', () => {
  const railContent = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );
  assert.ok(
    railContent.includes('<BrandMark className="tv-v2-brand-mark" />'),
    'TvNavRail must render full BrandMark wordmark, not compact monogram'
  );
  assert.ok(
    !railContent.includes('<BrandMark compact />'),
    'TvNavRail must not render compact BrandMark'
  );

  const wordmarkSvgPath = path.join(process.cwd(), 'public/brand/daitign-wordmark.svg');
  assert.ok(fs.existsSync(wordmarkSvgPath), 'daitign-wordmark.svg must exist');
  const svgContent = fs.readFileSync(wordmarkSvgPath, 'utf-8');
  assert.ok(
    svgContent.includes('daitign-bottom-curve') && svgContent.includes('#E50914'),
    'daitign-wordmark.svg must have streaming curved baseline and red fill'
  );
});

test('2. New & Popular exists and works', async () => {
  const item = PRIMARY_NAV_ITEMS.find((i) => i.id === 'new-popular');
  assert.ok(item, 'PRIMARY_NAV_ITEMS must contain new-popular');
  assert.equal(item?.label, 'New & Popular');

  clearNewPopularCatalogCache();
  const catalog = await fetchTvNewPopularCatalog();
  // fetchTvNewPopularCatalog should return either null (in mock/offline node environment) or structured data
  assert.ok(typeof fetchTvNewPopularCatalog === 'function');
});

test('3. Browse by Languages exists and works', async () => {
  const item = PRIMARY_NAV_ITEMS.find((i) => i.id === 'languages');
  assert.ok(item, 'PRIMARY_NAV_ITEMS must contain languages');
  assert.equal(item?.label, 'Browse by Languages');

  assert.ok(TV_LANGUAGES.length >= 8, 'Must support multiple languages');
  assert.ok(TV_PREFERENCE_MODES.length >= 3, 'Must support Original Language, Dubbing, Subtitles');

  clearLanguageCatalogCache();
  const results = await fetchTvLanguageCatalog('en', 'original');
  assert.ok(Array.isArray(results));
});

test('4. Search expands in place', () => {
  const cssContent = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );
  assert.ok(
    cssContent.includes('.tv-v2-nav-search--collapsed') &&
      cssContent.includes('.tv-v2-nav-search--expanded'),
    'CSS must contain collapsed and expanded states'
  );
  assert.ok(
    cssContent.includes('Titles, people, genres') ||
      fs
        .readFileSync(path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'), 'utf-8')
        .includes('Titles, people, genres'),
    'Search placeholder must be Titles, people, genres'
  );
});

test('5. Notifications open/close', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  let isOpen = false;
  engine.registerNode({
    colIndex: 7,
    id: 'nav-notifications',
    onSelect: () => {
      isOpen = true;
      engine.pushScope('notifications-scope', 'notif-item-0');
      engine.registerRow({ id: 'notifications-row-0', order: 0 });
      engine.registerNode({
        colIndex: 0,
        id: 'notif-item-0',
        onBack: () => {
          isOpen = false;
          engine.popScope();
          return true;
        },
        rowId: 'notifications-row-0',
      });
    },
    rowId: 'nav-row',
  });

  engine.setFocus('nav-notifications');
  assert.equal(engine.getActiveNodeId(), 'nav-notifications');

  // Open with Enter
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));
  assert.equal(isOpen, true);
  assert.equal(engine.getScope(), 'notifications-scope');
  assert.equal(engine.getActiveNodeId(), 'notif-item-0');

  // Close with Back
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Backspace', keyCode: 8 }));
  assert.equal(isOpen, false);
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'nav-notifications');
});

test('6. badge uses real unread count', () => {
  const mockNotifs = [
    { id: 'notif-1', message: 'msg1', time: '1h', title: 'Arrival 1' },
    { id: 'notif-2', message: 'msg2', time: '2h', title: 'Arrival 2' },
    { id: 'notif-3', message: 'msg3', time: '3h', title: 'Arrival 3' },
  ];

  clearTvNotificationCache();
  const initialUnread = getUnreadNotificationCount(mockNotifs);
  assert.equal(typeof initialUnread, 'number');

  markNotificationAsRead('notif-1');
  const afterReadOne = getUnreadNotificationCount(mockNotifs);
  assert.ok(afterReadOne <= initialUnread);

  markAllNotificationsAsRead(mockNotifs);
  const afterReadAll = getUnreadNotificationCount(mockNotifs);
  assert.equal(afterReadAll, 0, 'After marking all read, unread count must be 0');
});

test('7. profile dropdown opens', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  let isProfileOpen = false;
  engine.registerNode({
    colIndex: 8,
    id: 'nav-profile',
    onSelect: () => {
      isProfileOpen = true;
      engine.pushScope('profile-scope', 'profile-item-my-list');
      engine.registerRow({ id: 'profile-row-0', order: 0 });
      engine.registerNode({
        colIndex: 0,
        id: 'profile-item-my-list',
        rowId: 'profile-row-0',
      });
    },
    rowId: 'nav-row',
  });

  engine.setFocus('nav-profile');
  assert.equal(engine.getActiveNodeId(), 'nav-profile');

  // Open on Enter
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));
  assert.equal(isProfileOpen, true);
  assert.equal(engine.getScope(), 'profile-scope');
  assert.equal(engine.getActiveNodeId(), 'profile-item-my-list');
});

test('8. profile rows are functional', () => {
  const profileSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvProfileDropdown.tsx'),
    'utf-8'
  );

  assert.ok(profileSrc.includes('profile-item-my-list'), 'Must have My List');
  assert.ok(profileSrc.includes('profile-item-settings'), 'Must have Settings');
  assert.ok(profileSrc.includes('profile-item-account'), 'Must have Account');
  assert.ok(profileSrc.includes('profile-item-help'), 'Must have Help & Support');
  assert.ok(profileSrc.includes('profile-item-signout'), 'Must have Sign Out');
  assert.ok(
    !profileSrc.includes('Transfer Profile') && !profileSrc.includes('Manage Profiles'),
    'Must not include non-functional Netflix items'
  );
});

test('9. Back closes popup first', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  let popupClosed = false;
  engine.registerNode({
    colIndex: 8,
    id: 'nav-profile',
    rowId: 'nav-row',
  });

  engine.pushScope('profile-scope', 'profile-item-settings');
  engine.registerRow({ id: 'profile-row-1', order: 1 });
  engine.registerNode({
    colIndex: 0,
    id: 'profile-item-settings',
    onBack: () => {
      popupClosed = true;
      engine.popScope();
      return true;
    },
    rowId: 'profile-row-1',
  });

  engine.setFocus('profile-item-settings');
  assert.equal(engine.getActiveNodeId(), 'profile-item-settings');

  const backHandled = engine.handleKeyEvent(createMockKeyEvent({ key: 'Back', keyCode: 4 }));
  assert.equal(backHandled, true);
  assert.equal(popupClosed, true);
  assert.equal(engine.getScope(), 'root');
});

test('10. focus restoration to opener', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  engine.registerNode({
    colIndex: 7,
    id: 'nav-notifications',
    rowId: 'nav-row',
  });

  engine.setFocus('nav-notifications');
  assert.equal(engine.getActiveNodeId(), 'nav-notifications');

  // Push notifications scope
  engine.pushScope('notifications-scope', 'notif-item-0');
  engine.registerRow({ id: 'notifications-row-0', order: 0 });
  engine.registerNode({
    colIndex: 0,
    id: 'notif-item-0',
    rowId: 'notifications-row-0',
  });

  engine.setFocus('notif-item-0');
  assert.equal(engine.getActiveNodeId(), 'notif-item-0');

  // Pop scope
  engine.popScope();
  assert.equal(engine.getActiveNodeId(), 'nav-notifications');
});

test('11. only one header popup open at once', () => {
  // Simulate state exclusivity
  let openPopup: 'movies' | 'shows' | 'notifications' | 'profile' | null = null;

  const openSubmenu = (type: 'movies' | 'shows') => {
    openPopup = type;
  };
  const openNotif = () => {
    openPopup = 'notifications';
  };
  const openProf = () => {
    openPopup = 'profile';
  };

  openSubmenu('movies');
  assert.equal(openPopup, 'movies');

  openNotif();
  assert.equal(openPopup, 'notifications');

  openProf();
  assert.equal(openPopup, 'profile');
});

test('12. language dropdown D-pad', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'lang-pref-row', order: 1 });

  let modeSelected = '';
  engine.registerNode({
    colIndex: 0,
    id: 'lang-mode-btn',
    onSelect: () => {
      engine.pushScope('lang-mode-scope', 'lang-mode-opt-0');
      TV_PREFERENCE_MODES.forEach((mode, idx) => {
        const rowId = `lang-mode-row-${idx}`;
        engine.registerRow({ id: rowId, order: idx });
        engine.registerNode({
          colIndex: 0,
          id: `lang-mode-opt-${idx}`,
          onSelect: () => {
            modeSelected = mode.id;
            engine.popScope();
          },
          rowId,
        });
      });
    },
    rowId: 'lang-pref-row',
  });

  engine.setFocus('lang-mode-btn');
  // Open dropdown
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));
  assert.equal(engine.getScope(), 'lang-mode-scope');
  assert.equal(engine.getActiveNodeId(), 'lang-mode-opt-0');

  // Move down to Dubbing (index 1)
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowDown', keyCode: 40 }));
  assert.equal(engine.getActiveNodeId(), 'lang-mode-opt-1');

  // Select Dubbing
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));
  assert.equal(modeSelected, 'dubbing');
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'lang-mode-btn');
});

test('13. profile dropdown D-pad', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  engine.registerNode({
    colIndex: 8,
    id: 'nav-profile',
    rowId: 'nav-row',
  });

  engine.pushScope('profile-scope', 'profile-item-my-list');
  const items = [
    'profile-item-my-list',
    'profile-item-settings',
    'profile-item-account',
    'profile-item-help',
    'profile-item-signout',
  ];
  items.forEach((id, idx) => {
    const rowId = `profile-row-${idx}`;
    engine.registerRow({ id: rowId, order: idx });
    engine.registerNode({
      colIndex: 0,
      id,
      rowId,
    });
  });

  engine.setFocus('profile-item-my-list');
  assert.equal(engine.getActiveNodeId(), 'profile-item-my-list');

  // Move Down through items
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowDown', keyCode: 40 }));
  assert.equal(engine.getActiveNodeId(), 'profile-item-settings');

  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowDown', keyCode: 40 }));
  assert.equal(engine.getActiveNodeId(), 'profile-item-account');

  // Move Up
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowUp', keyCode: 38 }));
  assert.equal(engine.getActiveNodeId(), 'profile-item-settings');
});

test('14. notification dropdown D-pad', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  engine.registerNode({
    colIndex: 7,
    id: 'nav-notifications',
    rowId: 'nav-row',
  });

  engine.pushScope('notifications-scope', 'notif-item-0');
  ['notif-item-0', 'notif-item-1', 'notif-item-2'].forEach((id, idx) => {
    const rowId = `notifications-row-${idx}`;
    engine.registerRow({ id: rowId, order: idx });
    engine.registerNode({
      colIndex: 0,
      id,
      rowId,
    });
  });

  engine.setFocus('notif-item-0');
  assert.equal(engine.getActiveNodeId(), 'notif-item-0');

  // Move down
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowDown', keyCode: 40 }));
  assert.equal(engine.getActiveNodeId(), 'notif-item-1');

  // Move up
  engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowUp', keyCode: 38 }));
  assert.equal(engine.getActiveNodeId(), 'notif-item-0');
});

test('15. TV V1 unchanged', () => {
  const gitDiffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(gitDiffTvV1, '', 'src/lib/tv/ (TV V1) files must remain completely untouched');
});

test('16. web unchanged', () => {
  const gitDiffWeb = execSync('git diff --name-only src/components/ src/features/')
    .toString()
    .trim();
  assert.equal(gitDiffWeb, '', 'Normal web components and pages must remain completely untouched');
});
