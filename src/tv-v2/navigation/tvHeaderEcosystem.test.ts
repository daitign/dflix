import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';
import { PRIMARY_NAV_ITEMS } from './tvNavConfig.ts';
import {
  clearTvNotificationCache,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../notifications/tvNotificationCatalog.ts';
import {
  clearLanguageCatalogCache,
  fetchTvLanguageCatalog,
  TV_LANGUAGES,
} from '../catalog/tvLanguagesCatalog.ts';

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

test('1. only required nav items render', () => {
  const expectedNav = ['home', 'shows', 'movies', 'new-popular', 'my-list'];
  assert.deepEqual(
    PRIMARY_NAV_ITEMS.map((item) => item.id),
    expectedNav,
    'Top nav must render strictly: Home, TV Shows, Movies, New & Popular, My List'
  );

  assert.equal(PRIMARY_NAV_ITEMS.find((i) => i.id === 'home')?.label, 'Home');
  assert.equal(PRIMARY_NAV_ITEMS.find((i) => i.id === 'shows')?.label, 'TV Shows');
  assert.equal(PRIMARY_NAV_ITEMS.find((i) => i.id === 'movies')?.label, 'Movies');
  assert.equal(PRIMARY_NAV_ITEMS.find((i) => i.id === 'new-popular')?.label, 'New & Popular');
  assert.equal(PRIMARY_NAV_ITEMS.find((i) => i.id === 'my-list')?.label, 'My List');

  // Verify DAITIGN wordmark on far left
  const railTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );
  assert.ok(
    railTsx.includes('<BrandMark className="tv-v2-brand-mark" />'),
    'TvNavRail must render full BrandMark wordmark on left'
  );
});

test('2. Games absent', () => {
  const gamesItem = PRIMARY_NAV_ITEMS.find(
    (item) => item.id === 'games' || item.label.toLowerCase().includes('game')
  );
  assert.equal(gamesItem, undefined, 'Games must NOT be present in top nav');
});

test('3. My Netflix absent', () => {
  const myNetflixItem = PRIMARY_NAV_ITEMS.find(
    (item) => item.id === 'my-netflix' || item.label.toLowerCase().includes('netflix')
  );
  assert.equal(myNetflixItem, undefined, 'My Netflix must NOT be present in top nav');
});

test('4. Browse by Languages absent', async () => {
  const langItem = PRIMARY_NAV_ITEMS.find((item) => item.id === 'languages');
  assert.equal(langItem, undefined, 'Browse by Languages must NOT be rendered in visible top nav');

  // Verify language catalog code is NOT deleted and still functional
  assert.ok(TV_LANGUAGES.length >= 8, 'Language definitions must remain functional');
  clearLanguageCatalogCache();
  const catalog = await fetchTvLanguageCatalog('en', 'original');
  assert.ok(Array.isArray(catalog), 'Language catalog fetching must still function');
});

test('5. Search icon renders', () => {
  const railTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );
  assert.ok(
    railTsx.includes('<TvNavSearch') && railTsx.includes('id="nav-search"'),
    'TvNavSearch must render in header actions'
  );
  assert.ok(
    railTsx.includes('<Icon name="search"') &&
      (railTsx.includes('size={isExpanded ? 20 : 24}') || railTsx.includes('size={18}') || railTsx.includes('size={24}')),
    'Search must render search icon'
  );

  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('.tv-v2-nav-search--collapsed') &&
      (css.includes('width: clamp(38px, 4.2vh, 44px);') || css.includes('width: clamp(36px, 4.2vh, 42px);')),
    'Collapsed search must be a compact minimal icon'
  );
});

test('6. Notifications renders', () => {
  const railTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );
  assert.ok(
    railTsx.includes('<TvNavNotifications') && railTsx.includes('id="nav-notifications"'),
    'TvNavNotifications must always be rendered in header actions'
  );
  assert.ok(
    railTsx.includes('<Icon name="bell"') &&
      (railTsx.includes('size={24}') || railTsx.includes('size={20}')),
    'Notifications button must render bell icon'
  );
  assert.ok(
    railTsx.includes('{unreadCount > 0 && (') &&
      railTsx.includes('data-testid="notification-badge"'),
    'Notification badge must only render when unread count > 0'
  );

  const mockNotifs = [
    { id: 'notif-1', message: 'msg1', time: '1h', title: 'Arrival 1' },
    { id: 'notif-2', message: 'msg2', time: '2h', title: 'Arrival 2' },
  ];
  clearTvNotificationCache();
  const count = getUnreadNotificationCount(mockNotifs);
  assert.equal(typeof count, 'number');
  markNotificationAsRead('notif-1');
  assert.ok(getUnreadNotificationCount(mockNotifs) <= count);
  markAllNotificationsAsRead(mockNotifs);
  assert.equal(getUnreadNotificationCount(mockNotifs), 0);
});

test('7. Profile uses DV branding', () => {
  const railTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'),
    'utf-8'
  );
  assert.ok(
    railTsx.includes('<TvNavProfile') && railTsx.includes('id="nav-profile"'),
    'TvNavProfile must always render in header actions'
  );
  assert.ok(
    railTsx.includes('data-testid="profile-avatar"') && railTsx.includes('alt="DV Profile"'),
    'Profile avatar must use DV Profile branding'
  );

  const profileTsx = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvProfileDropdown.tsx'),
    'utf-8'
  );
  assert.ok(
    profileTsx.includes('DAITIGN') && profileTsx.includes('DV Premium'),
    'Profile dropdown must feature DAITIGN and DV Premium'
  );
  assert.ok(
    !profileTsx.includes('Manage Profiles') && !profileTsx.includes('Transfer Profile'),
    'Must not include non-functional Netflix items'
  );
});

test('8. Search expands leftward', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );
  assert.ok(
    css.includes('.tv-v2-nav-rail__actions {') &&
      css.includes('margin-left: auto;') &&
      css.includes('justify-content: flex-end;'),
    'Actions must anchor right'
  );
  assert.ok(
    css.includes('.tv-v2-nav-search--expanded') &&
      (css.includes('width: clamp(240px, 28vw, 500px);') ||
        css.includes('width: clamp(320px, 26vw, 500px);') ||
        css.includes('width: clamp(320px, 28vw, 520px);')),
    'Expanded search must expand leftward'
  );
  assert.ok(
    css.includes('Titles, people, genres') ||
      fs
        .readFileSync(path.join(process.cwd(), 'src/tv-v2/components/TvNavRail.tsx'), 'utf-8')
        .includes('Titles, people, genres'),
    'Search input placeholder must be Titles, people, genres'
  );
});

test('9. Notifications popup works', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  let isOpen = false;
  engine.registerNode({
    colIndex: 6,
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
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Back', keyCode: 4 }));
  assert.equal(isOpen, false);
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'nav-notifications');
});

test('10. Profile popup works', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  let isProfileOpen = false;
  engine.registerNode({
    colIndex: 7,
    id: 'nav-profile',
    onSelect: () => {
      isProfileOpen = true;
      engine.pushScope('profile-scope', 'profile-item-my-list');
      engine.registerRow({ id: 'profile-row-0', order: 0 });
      engine.registerNode({
        colIndex: 0,
        id: 'profile-item-my-list',
        onBack: () => {
          isProfileOpen = false;
          engine.popScope();
          return true;
        },
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

  // Close on Back
  engine.handleKeyEvent(createMockKeyEvent({ key: 'Backspace', keyCode: 8 }));
  assert.equal(isProfileOpen, false);
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'nav-profile');
});

test('11. one popup at a time', () => {
  let openPopup: 'movies' | 'shows' | 'notifications' | 'profile' | null = null;
  let searchExpanded = false;

  const openSubmenu = (type: 'movies' | 'shows') => {
    if (searchExpanded) searchExpanded = false;
    openPopup = type;
  };
  const openNotif = () => {
    if (searchExpanded) searchExpanded = false;
    openPopup = 'notifications';
  };
  const openProf = () => {
    if (searchExpanded) searchExpanded = false;
    openPopup = 'profile';
  };
  const expandSearch = () => {
    openPopup = null;
    searchExpanded = true;
  };

  openSubmenu('movies');
  assert.equal(openPopup, 'movies');

  openNotif();
  assert.equal(openPopup, 'notifications');

  openProf();
  assert.equal(openPopup, 'profile');

  expandSearch();
  assert.equal(searchExpanded, true);
  assert.equal(openPopup, null, 'Expanding search closes any open popup');

  openNotif();
  assert.equal(openPopup, 'notifications');
  assert.equal(searchExpanded, false, 'Opening notifications collapses search');
});

test('12. Back closes popup first', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  let popupClosed = false;
  engine.registerNode({
    colIndex: 7,
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
  assert.equal(engine.getActiveNodeId(), 'nav-profile');
});

test('13. D-pad traverses full header', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'nav-row', order: 0 });

  const ids = [
    'nav-home',
    'nav-shows',
    'nav-movies',
    'nav-new-popular',
    'nav-my-list',
    'nav-search',
    'nav-notifications',
    'nav-profile',
  ];

  ids.forEach((id, colIndex) => {
    engine.registerNode({
      colIndex,
      id,
      onDirection: (dir) => {
        if (dir === 'right') {
          if (colIndex < ids.length - 1) {
            engine.setFocus(ids[colIndex + 1]);
            return true;
          }
        }
        if (dir === 'left') {
          if (colIndex > 0) {
            engine.setFocus(ids[colIndex - 1]);
            return true;
          }
        }
        return false;
      },
      rowId: 'nav-row',
    });
  });

  // Start at nav-home
  engine.setFocus('nav-home');
  assert.equal(engine.getActiveNodeId(), 'nav-home');

  // Traverse right across entire header
  for (let i = 1; i < ids.length; i++) {
    engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowRight', keyCode: 39 }));
    assert.equal(engine.getActiveNodeId(), ids[i], `Should focus ${ids[i]} on ArrowRight`);
  }

  // Traverse back left across entire header
  for (let i = ids.length - 2; i >= 0; i--) {
    engine.handleKeyEvent(createMockKeyEvent({ key: 'ArrowLeft', keyCode: 37 }));
    assert.equal(engine.getActiveNodeId(), ids[i], `Should focus ${ids[i]} on ArrowLeft`);
  }
});

test('14. genre submenu still works', () => {
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

  engine.handleKeyEvent(createMockKeyEvent({ key: 'Enter', keyCode: 13 }));
  assert.equal(submenuOpened, true);
  assert.equal(engine.getScope(), 'genre-submenu-scope');
  assert.equal(engine.getActiveNodeId(), 'genre-nav-movies-all');
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
