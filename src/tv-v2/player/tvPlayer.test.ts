import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';
import { buildVidStuckUrl } from '../../lib/vidstuck/buildPlayerUrl.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playerScreenPath = path.resolve(__dirname, 'TvPlayerScreen.tsx');
const playerCssPath = path.resolve(__dirname, 'TvPlayer.css');
const playerOverlayPath = path.resolve(__dirname, 'TvPlayerOverlay.tsx');
const webPlayerPath = path.resolve(__dirname, '../../components/player/VidStuckPlayer.tsx');
const tvV1Path = path.resolve(__dirname, '../../lib/tv/spatialNavigation.ts');
const appPath = path.resolve(__dirname, '../../app/App.tsx');
const controllerPath = path.resolve(process.cwd(), 'android-tv/app/src/main/assets/tv-player-controller.js');

// ---------------------------------------------------------------------------
// SECTION 16 REQUIREMENTS: Original VidStuck TV V2 Player Test Suite
// ---------------------------------------------------------------------------

test('1. no DVAULT-created playback toolbar renders', () => {
  assert.ok(!fs.existsSync(playerOverlayPath), 'TvPlayerOverlay.tsx must be completely deleted');
  const screenContent = fs.readFileSync(playerScreenPath, 'utf8');
  assert.ok(!screenContent.includes('TvPlayerOverlay'), 'TvPlayerScreen must not import or render TvPlayerOverlay');
  assert.ok(!screenContent.includes('tv-v2-minibar'), 'TvPlayerScreen must not render custom minibar container');
  assert.ok(!screenContent.includes('role="toolbar"'), 'TvPlayerScreen must not render custom role="toolbar"');
});

test('2. no synthetic Pause/-10/+10/Episodes/Subtitles/Server buttons render', () => {
  const screenContent = fs.readFileSync(playerScreenPath, 'utf8');
  assert.ok(!screenContent.includes("id: 'play_pause'"), 'No synthetic play_pause button');
  assert.ok(!screenContent.includes("id: 'seek_back'"), 'No synthetic seek_back button');
  assert.ok(!screenContent.includes("id: 'seek_fwd'"), 'No synthetic seek_fwd button');
  assert.ok(!screenContent.includes("id: 'episodes'"), 'No synthetic episodes button');
  assert.ok(!screenContent.includes("id: 'subtitles'"), 'No synthetic subtitles button');
  assert.ok(!screenContent.includes("id: 'servers'"), 'No synthetic servers button');
});

test('3. player iframe receives tabIndex=0', () => {
  const screenContent = fs.readFileSync(playerScreenPath, 'utf8');
  assert.ok(screenContent.includes('tabIndex={0}'), 'Player iframe must have tabIndex={0} to own keyboard focus');
});

test('4. iframe is focused after onLoad', () => {
  const screenContent = fs.readFileSync(playerScreenPath, 'utf8');
  assert.ok(screenContent.includes('onLoad={handleIFrameLoad}'), 'Player iframe must attach handleIFrameLoad');
  assert.ok(screenContent.includes('frameRef.current.focus()'), 'handleIFrameLoad must focus the iframe');
});

test('5. outer spatial navigation is suspended during playback', () => {
  const engine = new TvFocusEngine();

  // Root shell setup with focused card
  engine.registerRow({ id: 'hero-row', order: 1 });
  engine.registerNode({ id: 'hero-play', rowId: 'hero-row', colIndex: 0 });
  engine.setFocus('hero-play');
  assert.equal(engine.getActiveNodeId(), 'hero-play');

  // Push player scope
  engine.pushScope('player-scope');

  // Player custom key handler suspends outer spatial navigation
  engine.setCustomKeyHandler((event) => {
    const key = event.key;
    if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter' || key === 'Tab') {
      return true; // Claim key for player without moving browse focus
    }
    return false;
  });

  const mockArrowEvent = {
    key: 'ArrowRight',
    keyCode: 39,
    which: 39,
    repeat: false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;

  const handled = engine.handleKeyEvent(mockArrowEvent);
  assert.equal(handled, true);
  // Outer browse node remains unchanged
  assert.equal(engine.getActiveNodeId(), 'hero-play');
});

test('6. browse page does not consume Arrow keys while player owns focus', () => {
  const engine = new TvFocusEngine();
  engine.pushScope('player-scope');

  let prevented = false;
  let stopped = false;

  engine.setCustomKeyHandler((event) => {
    const key = event.key;
    if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter' || key === 'Tab') {
      // Return true to suspend spatial nav, but DO NOT preventDefault so browser delivers to iframe!
      return true;
    }
    return false;
  });

  const mockArrowEvent = {
    key: 'ArrowLeft',
    keyCode: 37,
    which: 37,
    repeat: false,
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  } as unknown as KeyboardEvent;

  const handled = engine.handleKeyEvent(mockArrowEvent);
  assert.equal(handled, true);
  // Must NOT preventDefault so the browser gives the key to the active iframe
  assert.equal(prevented, false);
  assert.equal(stopped, false);
});

test('7. Back restores original TV focus', () => {
  const engine = new TvFocusEngine();

  // User launched player from 'detail-action-play'
  engine.registerRow({ id: 'detail-row', order: 1 });
  engine.registerNode({ id: 'detail-action-play', rowId: 'detail-row', colIndex: 0 });
  engine.setFocus('detail-action-play');
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');

  engine.pushScope('player-scope');

  let exited = false;
  engine.setCustomKeyHandler((event) => {
    const key = event.key;
    const keyCode = event.keyCode;
    if (key === 'Escape' || key === 'Backspace' || key === 'Back' || keyCode === 4 || keyCode === 27) {
      event.preventDefault();
      exited = true;
      engine.popScope();
      return true;
    }
    return false;
  });

  const mockBackEvent = {
    key: 'Escape',
    keyCode: 27,
    which: 27,
    repeat: false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;

  const handled = engine.handleKeyEvent(mockBackEvent);
  assert.equal(handled, true);
  assert.equal(exited, true);
  assert.equal(engine.getScope(), 'root');
  assert.equal(engine.getActiveNodeId(), 'detail-action-play');
});

test('8. player remains 100vw x 100vh', () => {
  const cssContent = fs.readFileSync(playerCssPath, 'utf8');
  assert.ok(cssContent.includes('position: fixed;'));
  assert.ok(cssContent.includes('inset: 0;'));
  assert.ok(cssContent.includes('width: 100vw;'));
  assert.ok(cssContent.includes('height: 100vh;'));
  assert.ok(cssContent.includes('margin: 0;'));
  assert.ok(cssContent.includes('padding: 0;'));
  assert.ok(cssContent.includes('.tv-v2-fullscreen-player__iframe'));
});

test('9. no unsupported fake postMessage control protocol remains', () => {
  const screenContent = fs.readFileSync(playerScreenPath, 'utf8');
  assert.ok(!screenContent.includes("action: 'play_pause'"), 'No fake play_pause postMessage');
  assert.ok(!screenContent.includes("action: 'seek'"), 'No fake seek postMessage');
  assert.ok(!screenContent.includes("action: 'togglePlay'"), 'No fake togglePlay postMessage');
  assert.ok(!screenContent.includes("tv-key"), 'No fake tv-key postMessage');
});

test('10. TV V1 and normal web remain unchanged', () => {
  assert.ok(fs.existsSync(tvV1Path), 'TV V1 spatialNavigation must remain intact');
  const webPlayerContent = fs.readFileSync(webPlayerPath, 'utf8');
  assert.ok(!webPlayerContent.includes('tv-v2'), 'Web player does not import tv-v2');

  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.ok(appContent.includes("if (isTvV2Route())"));
  assert.ok(appContent.includes("<TvV2App />"));
  assert.ok(appContent.includes("<LegacyApp />"));
});

test('Android hardware KEYCODE_BACK (keyCode 4) and KEYCODE_DPAD_CENTER (keyCode 23) parse correctly', () => {
  const engine = new TvFocusEngine();
  engine.registerRow({ id: 'home-row', order: 1 });
  engine.registerNode({ id: 'card-123', rowId: 'home-row', colIndex: 0 });
  engine.setFocus('card-123');

  engine.pushScope('player-scope');

  let exited = false;
  engine.setCustomKeyHandler((event) => {
    if (event.keyCode === 4) {
      event.preventDefault();
      exited = true;
      engine.popScope();
      return true;
    }
    return false;
  });

  const mockBackEvent = {
    key: 'Back',
    keyCode: 4,
    which: 4,
    repeat: false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;

  const handled = engine.handleKeyEvent(mockBackEvent);
  assert.equal(handled, true);
  assert.equal(exited, true);
  assert.equal(engine.getActiveNodeId(), 'card-123');
});

test('VidStuck URL builder produces valid query parameters for movies and TV shows', () => {
  const movieUrl = buildVidStuckUrl({ tmdbId: 550, type: 'movie' });
  assert.ok(movieUrl.includes('https://vidstuck.xyz/embed/movie/550'));
  assert.ok(movieUrl.includes('branding=DAITIGN'));
  assert.ok(movieUrl.includes('color=e50914'));
  assert.ok(movieUrl.includes('overlay=true'));

  const tvUrl = buildVidStuckUrl({ episode: 2, season: 1, tmdbId: 1399, type: 'tv' });
  assert.ok(tvUrl.includes('https://vidstuck.xyz/embed/tv/1399/1/2'));
  assert.ok(tvUrl.includes('nextEpisode=true'));
  assert.ok(tvUrl.includes('episodeSelector=true'));
  assert.ok(tvUrl.includes('autoplayNextEpisode=true'));
});

test('TV V2 Play delegates to AndroidTVBridge.startTvPlayer without iframe fallback', () => {
  const tvV2AppPath = path.resolve(__dirname, '../shell/TvV2App.tsx');
  const v2AppContent = fs.readFileSync(tvV2AppPath, 'utf8');
  assert.ok(v2AppContent.includes('window.AndroidTVBridge?.startTvPlayer'));
  assert.ok(v2AppContent.includes('window.AndroidTVBridge.startTvPlayer(vidstuckUrl, JSON.stringify(route))'));

  const playerScreenContent = fs.readFileSync(playerScreenPath, 'utf8');
  assert.ok(playerScreenContent.includes('window.AndroidTVBridge?.startTvPlayer'));
  assert.ok(playerScreenContent.includes('return null;'));
});

// ---------------------------------------------------------------------------
// SECTION 20: TV V2 PLAYER — SAFE 5-SECOND INACTIVITY AUTO-HIDE TESTS
// ---------------------------------------------------------------------------

function createTestPlayerHarness(options: { videoPaused?: boolean; nestedMenu?: boolean } = {}) {
  const timers = new Map<number, { fn: () => void; triggerAt: number }>();
  let nextTimerId = 1;
  let currentTime = 0;

  function fakeSetTimeout(fn: () => void, ms: number) {
    const id = nextTimerId++;
    timers.set(id, { fn, triggerAt: currentTime + ms });
    return id;
  }
  function fakeClearTimeout(id: number) {
    timers.delete(id);
  }
  function fakeSetInterval() {
    return nextTimerId++;
  }
  function fakeClearInterval() {}

  function advanceTime(ms: number) {
    const targetTime = currentTime + ms;
    while (true) {
      let earliest: { id: number; fn: () => void; triggerAt: number } | null = null;
      for (const [id, timer] of timers.entries()) {
        if (timer.triggerAt <= targetTime) {
          if (!earliest || timer.triggerAt < earliest.triggerAt) {
            earliest = { id, ...timer };
          }
        }
      }
      if (!earliest) {
        currentTime = targetTime;
        break;
      }
      currentTime = earliest.triggerAt;
      timers.delete(earliest.id);
      earliest.fn();
    }
  }

  const root = {
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: () => {}, removeProperty: () => {} }
  };
  const videoEl = {
    tagName: 'VIDEO',
    isConnected: true,
    paused: options.videoPaused || false,
    ended: false,
    duration: 100,
    currentTime: 10,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080 }),
    play: () => { videoEl.paused = false; return Promise.resolve(); },
    pause: () => { videoEl.paused = true; },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    style: {}
  };
  const playBtn: any = {
    tagName: 'BUTTON',
    isConnected: true,
    getAttribute: (k: string) => (k === 'aria-label' ? 'Play / Pause' : null),
    className: 'art-control-play',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: (k: string, v: string) => { playBtn.style[k] = v; }, removeProperty: (k: string) => { delete playBtn.style[k]; } },
    getBoundingClientRect: () => ({ left: 100, top: 900, width: 40, height: 40, right: 140, bottom: 940 }),
    matches: (s: string) => s.includes('button'),
    focus: () => {},
    blur: () => {},
    click: () => {},
    dispatchEvent: () => true
  };
  const subBtn: any = {
    tagName: 'BUTTON',
    isConnected: true,
    getAttribute: (k: string) => (k === 'aria-label' ? 'Subtitles' : null),
    className: 'art-control-subtitle',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: (k: string, v: string) => { subBtn.style[k] = v; }, removeProperty: (k: string) => { delete subBtn.style[k]; } },
    getBoundingClientRect: () => ({ left: 200, top: 900, width: 40, height: 40, right: 240, bottom: 940 }),
    matches: (s: string) => s.includes('button'),
    focus: () => {},
    blur: () => {},
    click: () => { openMenu(options.nestedMenu); },
    dispatchEvent: () => true
  };
  const timelineEl: any = {
    tagName: 'INPUT',
    isConnected: true,
    getAttribute: (k: string) => (k === 'type' ? 'range' : (k === 'role' ? 'slider' : null)),
    className: 'art-progress',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: (k: string, v: string) => { timelineEl.style[k] = v; }, removeProperty: (k: string) => { delete timelineEl.style[k]; } },
    getBoundingClientRect: () => ({ left: 100, top: 850, width: 800, height: 10, right: 900, bottom: 860 }),
    matches: (s: string) => s.includes('range') || s.includes('slider'),
    focus: () => {},
    blur: () => {},
    click: () => {},
    dispatchEvent: () => true
  };

  let menuOpen = false;
  let menuItems: any[] = [];
  const popupDialog: any = {
    tagName: 'DIV',
    isConnected: true,
    getAttribute: (k: string) => (k === 'role' ? 'dialog' : null),
    className: 'art-settings',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {
      setProperty: (k: string, v: string) => { popupDialog.style[k] = v; },
      removeProperty: (k: string) => { delete popupDialog.style[k]; },
      display: 'block',
      visibility: 'visible',
      opacity: '1'
    },
    getBoundingClientRect: () => ({ left: 200, top: 500, width: 300, height: 400, right: 500, bottom: 900 }),
    matches: (s: string) => s.includes('dialog'),
    contains: (child: any) => menuItems.includes(child),
    querySelectorAll: () => menuItems,
    focus: () => {},
    blur: () => {},
    click: () => {},
    dispatchEvent: () => true
  };

  function createMenuItem(label: string, isNestedNav: boolean = false) {
    const item: any = {
      tagName: 'DIV',
      isConnected: true,
      getAttribute: (k: string) => (k === 'role' ? 'menuitem' : (k === 'aria-label' ? label : null)),
      textContent: label,
      className: 'art-setting-item',
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {
        setProperty: (k: string, v: string) => { item.style[k] = v; },
        removeProperty: (k: string) => { delete item.style[k]; },
        display: 'block',
        visibility: 'visible',
        opacity: '1'
      },
      getBoundingClientRect: () => ({ left: 220, top: 520, width: 260, height: 40, right: 480, bottom: 560 }),
      matches: (s: string) => s.includes('menuitem') || s.includes('div'),
      contains: () => false,
      focus: () => {},
      blur: () => {},
      click: () => {
        if (!isNestedNav) {
          closeMenu();
        }
      },
      dispatchEvent: () => true
    };
    return item;
  }

  function openMenu(isNested: boolean = false) {
    menuOpen = true;
    popupDialog.style.display = 'block';
    popupDialog.style.visibility = 'visible';
    menuItems = isNested
      ? [createMenuItem('Subtitle Style', true), createMenuItem('Font Size', true)]
      : [createMenuItem('English', false), createMenuItem('Spanish', false), createMenuItem('Off', false)];
  }

  function closeMenu() {
    menuOpen = false;
    popupDialog.style.display = 'none';
    popupDialog.style.visibility = 'hidden';
    menuItems = [];
  }

  const documentMock = {
    head: { appendChild: () => {} },
    body: {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: { setProperty: () => {}, removeProperty: () => {} },
      dispatchEvent: () => true
    },
    documentElement: {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: { setProperty: () => {}, removeProperty: () => {} },
      dispatchEvent: () => true
    },
    activeElement: null,
    createElement: () => ({ appendChild: () => {}, textContent: '', setAttribute: () => {} }),
    querySelector: (sel: string) => {
      if (sel === 'video') return videoEl;
      if (sel.includes('.art-video-player')) return root;
      if (sel.includes('[role="dialog"]')) return menuOpen ? popupDialog : null;
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel === 'video') return [videoEl];
      if (sel === 'svg') return [];
      if (sel.includes('[role="dialog"]') || sel.includes('[role="menu"]')) {
        return menuOpen ? [popupDialog] : [];
      }
      if (sel.includes('button') || sel.includes('input') || sel.includes('slider')) {
        return [playBtn, subBtn, timelineEl];
      }
      return [];
    }
  };

  const windowMock: any = {
    location: { search: '' },
    innerWidth: 1920,
    innerHeight: 1080,
    document: documentMock,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    setInterval: fakeSetInterval,
    clearInterval: fakeClearInterval,
    requestAnimationFrame: (cb: () => void) => { cb(); return 1; },
    getComputedStyle: (el: any) => ({
      display: (el && el.style && el.style.display) || 'block',
      visibility: (el && el.style && el.style.visibility) || 'visible',
      opacity: (el && el.style && el.style.opacity) || '1',
      position: 'fixed',
      cursor: 'pointer'
    }),
    KeyboardEvent: class {},
    MouseEvent: class {},
    PointerEvent: class {},
    MutationObserver: class { observe() {} disconnect() {} },
    URLSearchParams: URLSearchParams,
    AndroidTVBridge: { setPlayerState: (st: string) => { windowMock.lastBridgeState = st; } }
  };

  const code = fs.readFileSync(controllerPath, 'utf8');
  const ctx = vm.createContext({
    window: windowMock,
    document: documentMock,
    innerWidth: 1920,
    innerHeight: 1080,
    getComputedStyle: windowMock.getComputedStyle,
    KeyboardEvent: windowMock.KeyboardEvent,
    MouseEvent: windowMock.MouseEvent,
    PointerEvent: windowMock.PointerEvent,
    MutationObserver: windowMock.MutationObserver,
    URLSearchParams: URLSearchParams,
    console: console,
    Date: Date,
    Math: Math,
    Array: Array
  });

  vm.runInContext(code, ctx);
  return {
    player: windowMock.DAITIGN_TV_PLAYER,
    windowMock,
    videoEl,
    playBtn,
    subBtn,
    timelineEl,
    advanceTime,
    openMenu,
    closeMenu
  };
}

test('1. controls remain visible during activity', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  for (let i = 0; i < 10; i++) {
    h.advanceTime(1000);
    h.player.handle('RIGHT');
    assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Must remain visible during activity');
  }
});

test('2. timer resets on every D-pad input', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.advanceTime(4000); // 4 seconds of idle
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  h.player.handle('LEFT'); // D-pad key arrives -> resets idle countdown
  h.advanceTime(3000); // Total 7s since wake, but 3s since key
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Timer must have reset on D-pad input');
  h.advanceTime(2500); // 5.5s since key -> now hides
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN', 'Should hide after 5s true inactivity');
});

test('3. 5s inactivity hides controls', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  h.advanceTime(4900);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Must still be visible before 5000ms');
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN', 'Must hide after 5000ms inactivity');
});

test('4. stale timer cannot hide after new activity', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.advanceTime(4800);
  h.player.activity(); // New activity right before 5s
  h.advanceTime(400); // Cross original 5000ms timestamp
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Stale generation timer must not hide controls');
  h.advanceTime(4700);
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN', 'New timer should hide at 5000ms after new activity');
});

test('5. menu blocks auto-hide', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT'); // Select subtitle button
  h.player.handle('OK'); // Open subtitle menu
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');
  h.advanceTime(20000); // Leave menu open for 20 seconds
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'Menu must stay visible indefinitely');
});

test('6. nested menu blocks auto-hide', () => {
  const h = createTestPlayerHarness({ nestedMenu: true });
  h.player.wake();
  h.player.handle('RIGHT');
  h.player.handle('OK');
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');
  h.player.handle('OK'); // Activate 'Subtitle Style' (nested navigation)
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'Nested menu remains in PLAYER_MENU');
  h.advanceTime(20000); // 20s idle
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'Nested menu must never auto-hide');
});

test('7. timeline interaction blocks auto-hide', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('UP'); // Focus timeline slider
  assert.equal(h.player.getState(), 'PLAYER_TIMELINE');
  h.advanceTime(15000); // 15 seconds on timeline
  assert.equal(h.player.getState(), 'PLAYER_TIMELINE', 'Timeline interaction blocks auto-hide');
  h.player.handle('DOWN'); // Navigate away to controls
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  h.advanceTime(5500); // Idle in controls
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN', 'Controls auto-hide after timeline interaction ends');
});

test('8. option selection begins fresh idle period', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT');
  h.player.handle('OK');
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');
  h.advanceTime(10000); // 10s idle in menu -> still open
  assert.equal(h.player.getState(), 'PLAYER_MENU');
  h.player.handle('OK'); // Select 'English'
  h.advanceTime(200); // Allow popup dismiss & finishMenuClose
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Returns to CONTROLS after single-choice selection');
  h.advanceTime(4500); // 4.5s idle
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Still visible during 4.5s idle');
  h.advanceTime(600); // Reaches 5.1s idle total
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN', 'Hides after 5s idle following selection');
});

test('9. hidden controls reappear on D-pad', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.advanceTime(5500);
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN');
  const handled = h.player.handle('DOWN');
  assert.equal(handled, true);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Hidden controls reappear immediately on D-pad');
});

test('10. remembered focus restores', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT'); // Focus subtitle button
  assert.ok(h.player.snapshot().selected?.label.includes('subtitles'));
  h.advanceTime(5500); // Controls hide
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN');
  h.player.handle('DOWN'); // D-pad wakes controls
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  assert.ok(h.player.snapshot().lastFocused?.label.includes('subtitles'), 'Remembered focus restored to subtitles');
});

test('11. held/repeated D-pad prevents hide', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  for (let i = 0; i < 60; i++) {
    h.advanceTime(100);
    h.player.activity(); // Hardware repeat event every 100ms
  }
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Holding D-pad continuously prevents auto-hide');
});

test('12. Back behavior unchanged', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  const handledControlsBack = h.player.handle('BACK');
  assert.equal(handledControlsBack, true, 'Back when CONTROLS consumes and hides');
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN');
  const handledHiddenBack = h.player.handle('BACK');
  assert.equal(handledHiddenBack, false, 'Back when HIDDEN returns false so Android exits player');
});

test('13. TV V1 unchanged', () => {
  assert.ok(fs.existsSync(tvV1Path), 'TV V1 spatialNavigation must remain intact');
  const controller = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(controller.includes('PLAYER_CONTROLS_IDLE_MS = 5000'));
  assert.ok(controller.includes('CONTROLS_IDLE_MS = 6000'));
});

test('14. web player unchanged', () => {
  const webPlayerContent = fs.readFileSync(webPlayerPath, 'utf8');
  assert.ok(!webPlayerContent.includes('DAITIGN_TV_PLAYER'), 'Web player does not import TV controller');
  assert.ok(!webPlayerContent.includes('tv-v2'), 'Web player does not import tv-v2');
});

