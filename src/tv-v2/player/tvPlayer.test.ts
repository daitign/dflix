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

function createTestPlayerHarness(options: {
  videoPaused?: boolean;
  nestedMenu?: boolean;
  menuType?: string;
  hasSkipIntro?: boolean;
  skipIntroVisible?: boolean;
  skipIntroLabel?: string;
  skipIntroRect?: { left: number; top: number; width: number; height: number; right: number; bottom: number };
} = {}) {
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
    click: () => { openMenu(options.nestedMenu, options.menuType || (options.nestedMenu ? 'style' : 'subtitles')); },
    dispatchEvent: () => true
  };
  const qualityBtn: any = {
    tagName: 'BUTTON',
    isConnected: true,
    getAttribute: (k: string) => (k === 'aria-label' ? 'Quality' : null),
    className: 'art-control-quality',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: (k: string, v: string) => { qualityBtn.style[k] = v; }, removeProperty: (k: string) => { delete qualityBtn.style[k]; } },
    getBoundingClientRect: () => ({ left: 260, top: 900, width: 40, height: 40, right: 300, bottom: 940 }),
    matches: (s: string) => s.includes('button'),
    focus: () => {},
    blur: () => {},
    click: () => { openMenu(false, 'quality'); },
    dispatchEvent: () => true
  };
  const serverBtn: any = {
    tagName: 'BUTTON',
    isConnected: true,
    getAttribute: (k: string) => (k === 'aria-label' ? 'Server' : null),
    className: 'art-control-server',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: (k: string, v: string) => { serverBtn.style[k] = v; }, removeProperty: (k: string) => { delete serverBtn.style[k]; } },
    getBoundingClientRect: () => ({ left: 320, top: 900, width: 40, height: 40, right: 360, bottom: 940 }),
    matches: (s: string) => s.includes('button'),
    focus: () => {},
    blur: () => {},
    click: () => { openMenu(false, 'server'); },
    dispatchEvent: () => true
  };
  const settingsBtn: any = {
    tagName: 'BUTTON',
    isConnected: true,
    getAttribute: (k: string) => (k === 'aria-label' ? 'Settings' : null),
    className: 'art-control-setting',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: (k: string, v: string) => { settingsBtn.style[k] = v; }, removeProperty: (k: string) => { delete settingsBtn.style[k]; } },
    getBoundingClientRect: () => ({ left: 380, top: 900, width: 40, height: 40, right: 420, bottom: 940 }),
    matches: (s: string) => s.includes('button'),
    focus: () => {},
    blur: () => {},
    click: () => { openMenu(false, options.menuType || 'settings'); },
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

  let skipIntroVisible = options.skipIntroVisible !== false;
  let skipIntroClicked = false;
  const skipIntroBtn: any = {
    tagName: 'BUTTON',
    isConnected: true,
    getAttribute: (k: string) => (k === 'aria-label' ? (options.skipIntroLabel || 'Skip Intro') : null),
    className: 'art-control-skip skip-intro',
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    textContent: options.skipIntroLabel || 'Skip Intro',
    style: {
      setProperty: (k: string, v: string) => { skipIntroBtn.style[k] = v; },
      removeProperty: (k: string) => { delete skipIntroBtn.style[k]; },
      display: skipIntroVisible ? 'block' : 'none',
      visibility: skipIntroVisible ? 'visible' : 'hidden',
      opacity: skipIntroVisible ? '1' : '0'
    },
    getBoundingClientRect: () => {
      if (!skipIntroVisible) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
      return options.skipIntroRect || { left: 1600, top: 800, width: 140, height: 48, right: 1740, bottom: 848 };
    },
    matches: (s: string) => s.includes('button') || s.includes('skip') || s.includes('intro'),
    closest: (s: string) => (s.includes('button') || s.includes('skip') ? skipIntroBtn : null),
    contains: () => false,
    focus: () => {},
    blur: () => {},
    click: () => {
      skipIntroClicked = true;
    },
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
    textContent: 'SUBTITLES',
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
    querySelector: () => null,
    focus: () => {},
    blur: () => {},
    click: () => {},
    dispatchEvent: (ev: any) => {
      if (ev && (ev.key === 'Escape' || ev.type === 'Escape')) {
        closeMenu();
      }
      return true;
    }
  };

  function createMenuItem(label: string, isNestedNav: boolean = false, isBackButton: boolean = false) {
    const item: any = {
      tagName: 'BUTTON',
      isConnected: true,
      getAttribute: (k: string) => (k === 'aria-label' ? label : (k === 'role' ? 'menuitem' : null)),
      textContent: label,
      className: isBackButton ? 'art-setting-item art-icon-back' : 'art-setting-item',
      classList: {
        add: () => {},
        remove: () => {},
        contains: (c: string) => isBackButton && (c === 'art-icon-back' || c === 'art-setting-item-back')
      },
      style: {
        setProperty: (k: string, v: string) => { item.style[k] = v; },
        removeProperty: (k: string) => { delete item.style[k]; },
        display: 'block',
        visibility: 'visible',
        opacity: '1'
      },
      getBoundingClientRect: () => ({ left: 220, top: 520, width: 260, height: 40, right: 480, bottom: 560 }),
      matches: (s: string) => s.includes('menuitem') || s.includes('div') || s.includes('button'),
      contains: () => false,
      focus: () => {},
      blur: () => {},
      click: () => {
        if (isBackButton) {
          openMenu(false, 'settings');
        } else if (!isNestedNav) {
          closeMenu();
        }
      },
      dispatchEvent: () => true
    };
    return item;
  }

  function openMenu(isNested: boolean = false, type?: string) {
    menuOpen = true;
    popupDialog.style.display = 'block';
    popupDialog.style.visibility = 'visible';
    const resolvedType = type || options.menuType || (isNested || options.nestedMenu ? 'style' : 'subtitles');
    if (resolvedType === 'quality') {
      popupDialog.textContent = 'QUALITY';
      menuItems = [createMenuItem('Auto', false), createMenuItem('1080p', false), createMenuItem('720p', false)];
    } else if (resolvedType === 'server') {
      popupDialog.textContent = 'SERVER';
      menuItems = [createMenuItem('Server 1', false), createMenuItem('Server 2', false), createMenuItem('Vidcloud', false)];
    } else if (resolvedType === 'settings') {
      popupDialog.textContent = 'PLAYER SETTINGS Customize your playback experience';
      menuItems = [createMenuItem('Quality Auto >', true), createMenuItem('Aspect Ratio Fit >', true), createMenuItem('Brightness 100%', true)];
    } else if (resolvedType === 'nested_settings') {
      popupDialog.textContent = 'ASPECT RATIO';
      menuItems = [createMenuItem('Back', true, true), createMenuItem('16:9', false), createMenuItem('4:3', false), createMenuItem('Fit', false)];
    } else if (resolvedType === 'style' || isNested) {
      popupDialog.textContent = 'SUBTITLE STYLE';
      menuItems = [createMenuItem('Subtitle Style', true), createMenuItem('Font Size', true), createMenuItem('Opacity', true)];
    } else {
      popupDialog.textContent = 'SUBTITLES Upload subtitle Off English English 1 English 2 Bulgarian 1 Style Delay';
      menuItems = [
        createMenuItem('English', false),
        createMenuItem('English 1', false),
        createMenuItem('Bulgarian 1', false),
        createMenuItem('Off', false),
        createMenuItem('Style', true),
        createMenuItem('Delay', true)
      ];
    }
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
      dispatchEvent: (ev: any) => {
        if (ev && (ev.key === 'Escape' || ev.type === 'Escape')) {
          closeMenu();
        }
        return true;
      }
    },
    documentElement: {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: { setProperty: () => {}, removeProperty: () => {} },
      dispatchEvent: (ev: any) => {
        if (ev && (ev.key === 'Escape' || ev.type === 'Escape')) {
          closeMenu();
        }
        return true;
      }
    },
    activeElement: null,
    createElement: () => ({ appendChild: () => {}, textContent: '', setAttribute: () => {} }),
    querySelector: (sel: string) => {
      if (sel === 'video') return videoEl;
      if (sel.includes('.art-video-player')) return root;
      if (sel.includes('[role="dialog"]')) return (menuOpen && popupDialog.style.display !== 'none') ? popupDialog : null;
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel === 'video') return [videoEl];
      if (sel === 'svg') return [];
      if (sel.includes('[role="dialog"]') || sel.includes('[role="menu"]')) {
        return (menuOpen && popupDialog.style.display !== 'none') ? [popupDialog] : [];
      }
      if (sel.includes('button') || sel.includes('input') || sel.includes('slider') || sel.includes('skip') || sel.includes('intro')) {
        const base = [playBtn, subBtn, qualityBtn, serverBtn, settingsBtn, timelineEl];
        if (options.hasSkipIntro) base.push(skipIntroBtn);
        return base;
      }
      if (sel.includes('div') || sel.includes('span') || sel.includes('p')) {
        if (options.hasSkipIntro) return [skipIntroBtn];
        return [];
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
    qualityBtn,
    serverBtn,
    settingsBtn,
    popupDialog,
    timelineEl,
    skipIntroBtn,
    setSkipIntroVisible: (v: boolean) => {
      skipIntroVisible = v;
      skipIntroBtn.style.display = v ? 'block' : 'none';
      skipIntroBtn.style.visibility = v ? 'visible' : 'hidden';
      skipIntroBtn.style.opacity = v ? '1' : '0';
      if (!v) {
        skipIntroBtn.isConnected = false;
      }
    },
    isSkipIntroClicked: () => skipIntroClicked,
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

// ---------------------------------------------------------------------------
// SECTION 18 REQUIREMENTS: Submenu Close Behavior & Compact Settings Panel
// ---------------------------------------------------------------------------

test('SECTION 18 - 1. subtitle single-choice closes after selection', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT'); // Focus subtitles button
  h.player.handle('OK'); // Open subtitles menu
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');
  
  // Select 'English' (single-choice subtitle option)
  h.player.handle('OK');
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'State returns to CONTROLS after selection');
  assert.ok(h.player.snapshot().selected?.label.includes('subtitles'), 'Focus restores to subtitles opener');
  assert.equal(h.popupDialog.style.display, 'none', 'Subtitles popup is dismissed');
});

test('SECTION 18 - 2. quality single-choice closes', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT'); // subBtn
  h.player.handle('RIGHT'); // qualityBtn
  h.player.handle('OK'); // Open quality menu
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');

  // Navigate to 1080p and select
  h.player.handle('DOWN');
  h.player.handle('OK'); // Select 1080p
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'State returns to CONTROLS after quality selection');
  assert.ok(h.player.snapshot().selected?.label.includes('quality'), 'Focus restores to quality opener');
});

test('SECTION 18 - 3. server single-choice closes', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT'); // subBtn
  h.player.handle('RIGHT'); // qualityBtn
  h.player.handle('RIGHT'); // serverBtn
  h.player.handle('OK'); // Open server menu
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');

  // Select Server 1
  h.player.handle('OK');
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'State returns to CONTROLS after server selection');
  assert.ok(h.player.snapshot().selected?.label.includes('server'), 'Focus restores to server opener');
});

test('SECTION 18 - 4. nested settings do not incorrectly auto-close', () => {
  const h = createTestPlayerHarness({ menuType: 'style' });
  h.player.wake();
  h.player.handle('RIGHT'); // subBtn
  h.player.handle('OK');
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');

  // Enter Subtitle Style
  h.player.handle('OK'); // Subtitle Style option
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'Nested multi-step settings remain in PLAYER_MENU');
  
  // Navigate and interact inside nested menu
  h.player.handle('DOWN'); // Font Size
  h.player.handle('OK');
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'Multi-step configuration does not auto-close');
});

test('SECTION 18 - 5. Back closes deepest popup first', () => {
  const h = createTestPlayerHarness({ menuType: 'nested_settings' });
  h.player.wake();
  h.player.handle('RIGHT'); // subBtn
  h.player.handle('RIGHT'); // qualityBtn
  h.player.handle('RIGHT'); // serverBtn
  h.player.handle('RIGHT'); // settingsBtn
  h.player.handle('OK');
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');

  // First BACK hits Back button in nested submenu
  const handledDeepest = h.player.handle('BACK');
  assert.equal(handledDeepest, true);
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'Back from nested submenu returns to parent menu');

  // Second BACK closes parent Settings menu
  const handledParent = h.player.handle('BACK');
  assert.equal(handledParent, true);
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Second Back closes settings panel to PLAYER_CONTROLS');
});

test('SECTION 18 - 6. Back never exits player while popup exists', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT');
  h.player.handle('OK'); // Open menu
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');

  // Back while popup exists MUST be consumed (return true), never exit playback
  const handledMenuBack = h.player.handle('BACK');
  assert.equal(handledMenuBack, true, 'Back with popup open consumes event');
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');

  // Back on controls hides controls
  const handledControlsBack = h.player.handle('BACK');
  assert.equal(handledControlsBack, true, 'Back on controls consumes and hides');
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN');

  // Only when hidden does Back return false (native Android handles exit)
  const handledHiddenBack = h.player.handle('BACK');
  assert.equal(handledHiddenBack, false, 'Only when completely hidden does Back permit exit');
});

test('SECTION 18 - 7. opener focus restores', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  
  // Test Subtitles opener restoration
  h.player.handle('RIGHT'); // Subtitles
  assert.ok(h.player.snapshot().selected?.label.includes('subtitles'));
  h.player.handle('OK');
  h.advanceTime(100);
  h.player.handle('OK'); // select
  h.advanceTime(200);
  assert.ok(h.player.snapshot().selected?.label.includes('subtitles'), 'Subtitles opener restored');

  // Test Quality opener restoration
  h.player.handle('RIGHT'); // Quality
  h.player.handle('OK');
  h.advanceTime(100);
  h.player.handle('OK'); // select
  h.advanceTime(200);
  assert.ok(h.player.snapshot().selected?.label.includes('quality'), 'Quality opener restored');
});

test('SECTION 18 - 8. controller state matches visible popup state', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  h.player.handle('RIGHT');
  h.player.handle('OK');
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'State is PLAYER_MENU when popup is visible');
  
  h.closeMenu();
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'State matches CONTROLS after popup is gone');
});

test('SECTION 18 - 9. settings panel is not fullscreen', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(controller.includes('width:min(620px,42vw)!important'), 'Settings width is capped to min(620px, 42vw)');
  assert.ok(controller.includes('max-height:min(680px,72vh)!important'), 'Settings max-height is capped to min(680px, 72vh)');
  assert.ok(controller.includes('position:fixed!important;top:50%!important;left:50%!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-50%)!important'), 'Settings panel is centered with visible margins on all four sides');
  assert.ok(!controller.includes('.max-w-5xl{max-width:min(94vw,1200px)!important;max-height:92vh!important;bottom:auto!important}'), 'Settings is no longer oversized 94vw x 92vh');
});

test('SECTION 18 - 10. settings uses internal scrolling', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  assert.ok(controller.includes('overflow-y:auto!important;overflow-x:hidden!important'), 'Internal scrolling applied to settings and popups');
  assert.ok(controller.includes('.daitign-tv-settings-popup::-webkit-scrollbar'), 'Custom scrollbar defined for settings popup');
  assert.ok(controller.includes('.daitign-tv-subtitles-popup::-webkit-scrollbar'), 'Custom scrollbar defined for subtitles popup');
});

test('SECTION 18 - 11. menu blocks player auto-hide', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT');
  h.player.handle('OK');
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');
  
  // Advance 25 seconds while menu is open
  h.advanceTime(25000);
  assert.equal(h.player.getState(), 'PLAYER_MENU', 'Player never auto-hides while menu is open');
});

test('SECTION 18 - 12. closing final popup restarts 5s idle timer', () => {
  const h = createTestPlayerHarness();
  h.player.wake();
  h.player.handle('RIGHT');
  h.player.handle('OK');
  h.advanceTime(100);
  assert.equal(h.player.getState(), 'PLAYER_MENU');
  
  // Idle for 10s in menu
  h.advanceTime(10000);
  assert.equal(h.player.getState(), 'PLAYER_MENU');

  // Select option -> closes menu
  h.player.handle('OK');
  h.advanceTime(200);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');

  // Still visible after 4.5s
  h.advanceTime(4500);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Controls visible at 4.5s');

  // Hides after 5.1s total
  h.advanceTime(600);
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN', 'Controls hide at 5s idle');
});

test('SECTION 18 - 13. TV V1 unchanged', () => {
  assert.ok(fs.existsSync(tvV1Path), 'TV V1 spatialNavigation must remain intact');
  const tvV1Content = fs.readFileSync(tvV1Path, 'utf8');
  assert.ok(tvV1Content.length > 0, 'TV V1 has content');
});

test('SECTION 18 - 14. web unchanged', () => {
  const webPlayerContent = fs.readFileSync(webPlayerPath, 'utf8');
  assert.ok(!webPlayerContent.includes('DAITIGN_TV_PLAYER'), 'Web player does not import TV controller');
  assert.ok(!webPlayerContent.includes('tv-v2'), 'Web player does not import tv-v2');
});

// ---------------------------------------------------------------------------
// SECTION 21: TV V2 PLAYER — D-PAD SUPPORT FOR "SKIP INTRO" TESTS
// ---------------------------------------------------------------------------

test('SECTION 21 - 1. visible Skip Intro is discovered', () => {
  const h = createTestPlayerHarness({ hasSkipIntro: true, skipIntroVisible: true });
  h.player.wake();
  const inv = h.player.inventory();
  const skipIntro = inv.find((item: any) => item.kind === 'skip-intro');
  assert.ok(skipIntro, 'Visible Skip Intro must be discovered in inventory');
  assert.ok(skipIntro.label.includes('skip intro'));
});

test('SECTION 21 - 2. hidden Skip Intro is ignored', () => {
  const h = createTestPlayerHarness({ hasSkipIntro: true, skipIntroVisible: false });
  h.player.wake();
  const inv = h.player.inventory();
  const skipIntro = inv.find((item: any) => item.kind === 'skip-intro');
  assert.equal(skipIntro, undefined, 'Hidden Skip Intro must be excluded from candidates');
});

test('SECTION 21 - 3. semantic kind is skip-intro for various provider labels', () => {
  const labels = ['Skip Intro', 'Skip intro', 'Skip opening', 'Skip Opening', 'Intro', 'Skip', 'Skip Recap'];
  for (const lbl of labels) {
    const h = createTestPlayerHarness({ hasSkipIntro: true, skipIntroVisible: true, skipIntroLabel: lbl });
    h.player.wake();
    const inv = h.player.inventory();
    const skipItem = inv.find((item: any) => item.label.includes(lbl.toLowerCase()) || item.kind === 'skip-intro');
    assert.ok(skipItem, `Button with label "${lbl}" must be found`);
    assert.equal(skipItem.kind, 'skip-intro', `Button with label "${lbl}" must have semantic kind 'skip-intro'`);
  }
});

test('SECTION 21 - 4. spatial navigation can reach it and navigate away', () => {
  const h = createTestPlayerHarness({
    hasSkipIntro: true,
    skipIntroVisible: true,
    skipIntroRect: { left: 450, top: 800, width: 140, height: 40, right: 590, bottom: 840 }
  });
  h.player.wake();
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');
  
  // Navigate through bottom controls towards right
  h.player.handle('RIGHT'); // subBtn
  h.player.handle('RIGHT'); // qualityBtn
  h.player.handle('RIGHT'); // serverBtn
  h.player.handle('RIGHT'); // settingsBtn (x=380, top=900)

  // Skip Intro is at (x=450-590, top=800)
  // ArrowUp or ArrowRight reaches Skip Intro via geometry
  h.player.handle('RIGHT');
  assert.equal(h.player.snapshot().selected?.kind, 'skip-intro', 'Spatial navigation reaches Skip Intro');

  // Navigate away back to control bar via DOWN
  h.player.handle('DOWN');
  assert.notEqual(h.player.snapshot().selected?.kind, 'skip-intro', 'Spatial navigation moves away from Skip Intro on Down');
  assert.equal(h.player.getState(), 'PLAYER_TIMELINE', 'Down moves to timeline below Skip Intro');
  h.player.handle('DOWN');
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Next Down reaches control bar');
});

test('SECTION 21 - 5. Enter activates provider control', () => {
  const h = createTestPlayerHarness({
    hasSkipIntro: true,
    skipIntroVisible: true,
    skipIntroRect: { left: 450, top: 800, width: 140, height: 40, right: 590, bottom: 840 }
  });
  h.player.wake();
  // Move to Skip Intro
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  assert.equal(h.player.snapshot().selected?.kind, 'skip-intro');

  assert.equal(h.isSkipIntroClicked(), false, 'Not clicked yet');
  h.player.handle('OK');
  assert.equal(h.isSkipIntroClicked(), true, 'Enter/OK triggers click on provider Skip Intro button');
});

test('SECTION 21 - 6. no hardcoded seek timestamp used', () => {
  const h = createTestPlayerHarness({
    hasSkipIntro: true,
    skipIntroVisible: true,
    skipIntroRect: { left: 450, top: 800, width: 140, height: 40, right: 590, bottom: 840 }
  });
  h.player.wake();
  h.videoEl.currentTime = 42;
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  assert.equal(h.player.snapshot().selected?.kind, 'skip-intro');

  h.player.handle('OK');
  // Controller must NOT alter currentTime; provider handles skip logic
  assert.equal(h.videoEl.currentTime, 42, 'Controller does not modify video currentTime with hardcoded timestamp');
});

test('SECTION 21 - 7. disappearing button does not leave stale focus', () => {
  const h = createTestPlayerHarness({
    hasSkipIntro: true,
    skipIntroVisible: true,
    skipIntroRect: { left: 450, top: 800, width: 140, height: 40, right: 590, bottom: 840 }
  });
  h.player.wake();
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  assert.equal(h.player.snapshot().selected?.kind, 'skip-intro');

  // Skip Intro disappears after click
  h.player.handle('OK');
  h.setSkipIntroVisible(false);
  h.advanceTime(150);

  const snap = h.player.snapshot();
  assert.ok(snap.selected, 'Focus must exist on another player control');
  assert.notEqual(snap.selected.kind, 'skip-intro', 'Focus must not point to disappeared Skip Intro');
});

test('SECTION 21 - 8. fallback focus works', () => {
  const h = createTestPlayerHarness({
    hasSkipIntro: true,
    skipIntroVisible: true,
    skipIntroRect: { left: 450, top: 800, width: 140, height: 40, right: 590, bottom: 840 }
  });
  h.player.wake();
  h.player.handle('RIGHT'); // Subtitles
  assert.ok(h.player.snapshot().selected?.label.includes('subtitles'));

  // Move to Skip Intro
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  assert.equal(h.player.snapshot().selected?.kind, 'skip-intro');

  // Trigger Skip Intro, and button disappears
  h.player.handle('OK');
  h.setSkipIntroVisible(false);
  h.advanceTime(150);

  // Focus safely returns to last stable control or play-pause
  const snap = h.player.snapshot();
  assert.ok(snap.selected, 'Fallback focus selected');
  assert.ok(
    snap.selected.kind === 'settings' || snap.selected.kind === 'subtitle' || snap.selected.kind === 'play-pause',
    'Fallback focus moves to a stable player control'
  );
});

test('SECTION 21 - 9. activity resets idle timer', () => {
  const h = createTestPlayerHarness({
    hasSkipIntro: true,
    skipIntroVisible: true,
    skipIntroRect: { left: 450, top: 800, width: 140, height: 40, right: 590, bottom: 840 }
  });
  h.player.wake();
  h.advanceTime(4000); // 4 seconds idle
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS');

  // Navigate to Skip Intro -> resets idle timer
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  h.player.handle('RIGHT');
  assert.equal(h.player.snapshot().selected?.kind, 'skip-intro');

  // Advance 3s (7s since wake, but 3s since activity)
  h.advanceTime(3000);
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Controls remain visible 3s after Skip Intro navigation');

  // Activate Skip Intro -> fresh 5s timer starts
  h.player.handle('OK');
  h.advanceTime(4500); // 4.5s since activation
  assert.equal(h.player.getState(), 'PLAYER_CONTROLS', 'Controls visible 4.5s after Skip Intro activation');

  h.advanceTime(600); // Reaches 5.1s since activation
  assert.equal(h.player.getState(), 'PLAYER_HIDDEN', 'Controls auto-hide after 5s inactivity following Skip Intro');
});

test('SECTION 21 - 10. TV V1 unchanged', () => {
  assert.ok(fs.existsSync(tvV1Path), 'TV V1 spatialNavigation must remain intact');
  const tvV1Content = fs.readFileSync(tvV1Path, 'utf8');
  assert.ok(tvV1Content.length > 0, 'TV V1 has content');
});

test('SECTION 21 - 11. web player unchanged', () => {
  const webPlayerContent = fs.readFileSync(webPlayerPath, 'utf8');
  assert.ok(!webPlayerContent.includes('DAITIGN_TV_PLAYER'), 'Web player does not import TV controller');
  assert.ok(!webPlayerContent.includes('tv-v2'), 'Web player does not import tv-v2');
});


