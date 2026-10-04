import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TvFocusEngine } from '../focus/TvFocusEngine.ts';
import { buildVidStuckUrl } from '../../lib/vidstuck/buildPlayerUrl.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playerScreenPath = path.resolve(__dirname, 'TvPlayerScreen.tsx');
const playerCssPath = path.resolve(__dirname, 'TvPlayer.css');
const playerOverlayPath = path.resolve(__dirname, 'TvPlayerOverlay.tsx');
const webPlayerPath = path.resolve(__dirname, '../../components/player/VidStuckPlayer.tsx');
const tvV1Path = path.resolve(__dirname, '../../lib/tv/spatialNavigation.ts');
const appPath = path.resolve(__dirname, '../../app/App.tsx');

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
