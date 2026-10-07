import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  TEMPORARY_WEB_MAINTENANCE,
  RESUME_AT,
  isMaintenanceActive,
  isTvBypass,
} from './maintenanceConfig.ts';
import { renderMaintenance } from './renderMaintenance.ts';

test('1. Central configuration switch and auto-expiry logic', () => {
  // Config exists and is set to true for emergency maintenance
  assert.equal(typeof TEMPORARY_WEB_MAINTENANCE, 'boolean');
  assert.equal(TEMPORARY_WEB_MAINTENANCE, true, 'TEMPORARY_WEB_MAINTENANCE must be true');
  assert.equal(RESUME_AT, '2026-10-15T00:00:00+08:00', 'RESUME_AT must be October 15, 2026 00:00:00+08:00');

  // Verify timestamp is correctly parsed
  const resumeTimestamp = new Date(RESUME_AT).getTime();
  assert.ok(Number.isFinite(resumeTimestamp));

  // Current time in October 2026 before October 15 (e.g. October 7, 2026) -> Active
  const oct7Ms = new Date('2026-10-07T12:00:00+08:00').getTime();
  assert.equal(isMaintenanceActive(oct7Ms), true, 'Maintenance must be active on Oct 7, 2026');

  // 1 millisecond before Oct 15 -> Active
  assert.equal(isMaintenanceActive(resumeTimestamp - 1), true, 'Maintenance must be active right before Oct 15');

  // Exactly Oct 15 00:00:00+08:00 -> Inactive (Auto-expired)
  assert.equal(isMaintenanceActive(resumeTimestamp), false, 'Maintenance must auto-expire on Oct 15');

  // After Oct 15 -> Inactive
  const oct16Ms = new Date('2026-10-16T00:00:00+08:00').getTime();
  assert.equal(isMaintenanceActive(oct16Ms), false, 'Maintenance must be inactive after Oct 15');
});

test('2. TV bypass: ?tv=1 and ?tv=2 bypass maintenance', () => {
  const originalWindow = globalThis.window;

  // Simulate ?tv=1
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '?tv=1', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  };
  assert.equal(isTvBypass(), true, '?tv=1 must bypass maintenance');

  // Simulate ?tv=2
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '?tv=2', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  };
  assert.equal(isTvBypass(), true, '?tv=2 must bypass maintenance');

  // Simulate ?tv=v2
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '?tv=v2', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0' },
  };
  assert.equal(isTvBypass(), true, '?tv=v2 must bypass maintenance');

  // Simulate /tv-v2 path
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '', pathname: '/tv-v2/browse' },
    navigator: { userAgent: 'Mozilla/5.0' },
  };
  assert.equal(isTvBypass(), true, '/tv-v2 route must bypass maintenance');

  (globalThis as unknown as { window: unknown }).window = originalWindow;
});

test('3. TV bypass: Android TV and Fire TV bypass maintenance', () => {
  const originalWindow = globalThis.window;

  // Simulate Android TV user agent
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0 DAITIGN-TV/3.1 AndroidTV' },
  };
  assert.equal(isTvBypass(), true, 'DAITIGN-TV User Agent must bypass maintenance');

  // Simulate Fire TV user agent
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM) DAITIGN-FIRE-TV' },
  };
  assert.equal(isTvBypass(), true, 'Fire TV User Agent must bypass maintenance');

  // Simulate AndroidTVBridge injection
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0' },
    AndroidTVBridge: { isTV: () => true },
  };
  assert.equal(isTvBypass(), true, 'AndroidTVBridge must bypass maintenance');

  // Simulate DAITIGN_TV global
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0' },
    DAITIGN_TV: { isTV: true },
  };
  assert.equal(isTvBypass(), true, 'DAITIGN_TV global must bypass maintenance');

  // Simulate normal web visitor (Desktop Chrome) -> MUST NOT BYPASS!
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
  };
  assert.equal(isTvBypass(), false, 'Normal Desktop Chrome must NOT bypass maintenance');

  // Simulate normal mobile visitor (iPhone Safari) -> MUST NOT BYPASS!
  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '', pathname: '/' },
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' },
  };
  assert.equal(isTvBypass(), false, 'Normal Mobile Safari must NOT bypass maintenance');

  (globalThis as unknown as { window: unknown }).window = originalWindow;
});

test('4. Standalone maintenance shell renders required text without external assets', () => {
  const dummyEl = {
    innerHTML: '',
  };
  const dummyDoc = {
    title: '',
  };
  const originalDoc = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = dummyDoc;

  renderMaintenance(dummyEl as unknown as HTMLElement);

  const rendered = dummyEl.innerHTML;
  assert.ok(dummyDoc.title.includes('DAITIGN'), 'Document title must reflect DAITIGN');

  // Required text verifications
  assert.ok(rendered.includes('DAITIGN'), 'Must contain DAITIGN brand');
  assert.ok(rendered.includes('Streaming Is Temporarily Paused'), 'Must contain title');
  assert.ok(rendered.includes("We've experienced an unusually high number of viewers and daily requests."), 'Must contain reason line 1');
  assert.ok(rendered.includes("We're expanding capacity so DAITIGN Stream can return more reliably."), 'Must contain reason line 2');
  assert.ok(rendered.includes('Back Live'), 'Must contain Back Live');
  assert.ok(rendered.includes('October 15, 2026'), 'Must contain October 15, 2026');
  assert.ok(rendered.includes('Help Support the Upgrade'), 'Must contain support heading');
  assert.ok(rendered.includes('Contact on Telegram'), 'Must contain Telegram button text');
  assert.ok(rendered.includes('https://t.me/stxngn'), 'Must link to https://t.me/stxngn');
  assert.ok(rendered.includes('@stxngn'), 'Must contain handle @stxngn');

  // Zero external fonts, zero external CDN images, zero video tags
  assert.ok(!rendered.includes('<video'), 'Must NOT contain <video> tags');
  assert.ok(!rendered.includes('<img'), 'Must NOT contain <img> tags');
  assert.ok(!rendered.includes('fonts.googleapis.com'), 'Must NOT fetch external fonts');
  assert.ok(!rendered.includes('fonts.gstatic.com'), 'Must NOT fetch external fonts');

  (globalThis as unknown as { document: unknown }).document = originalDoc;
});

test('5. Architecture: entry interception before React/bootstrap chunk', () => {
  const mainCode = fs.readFileSync(path.resolve('src/main.tsx'), 'utf-8');
  assert.ok(
    mainCode.includes('if (isMaintenanceActive() && !isTvBypass())'),
    'main.tsx must check isMaintenanceActive() && !isTvBypass() at the entry level'
  );
  assert.ok(
    mainCode.includes('renderMaintenance('),
    'main.tsx must call renderMaintenance on maintenance branch'
  );
  assert.ok(
    mainCode.includes("import('./bootstrap')"),
    "main.tsx must dynamically import './bootstrap' only on bypass/active branch"
  );
  assert.ok(
    !mainCode.includes("import { App } from './app/App'"),
    'main.tsx must NOT statically import App to enable code splitting'
  );
  assert.ok(
    !mainCode.includes("import './styles/index.css'"),
    'main.tsx must NOT statically import heavy index.css in the entry chunk'
  );
});

test('6. Dist build output: index.html entry payload is tiny (< 10 KB)', () => {
  const distHtmlPath = path.resolve('dist/index.html');
  if (fs.existsSync(distHtmlPath)) {
    const distHtml = fs.readFileSync(distHtmlPath, 'utf-8');
    // Does NOT link bootstrap-*.css in index.html
    assert.ok(!distHtml.includes('bootstrap-'), 'dist/index.html must not directly link heavy bootstrap chunk');
    // Finds entry script
    const match = distHtml.match(/src="\/assets\/(index-[^"]+\.js)"/);
    assert.ok(match, 'Must find index-*.js in dist/index.html');

    const entryJsPath = path.resolve('dist/assets', match[1]);
    assert.ok(fs.existsSync(entryJsPath), 'Entry JS chunk must exist');
    const entrySize = fs.statSync(entryJsPath).size;
    assert.ok(
      entrySize < 12000,
      `Entry JS chunk must be extremely small (< 12KB uncompressed), got ${entrySize} bytes`
    );
  }
});

test('7. Immutability constraints: TV V1, normal web components, and player controller untouched', () => {
  const diffTvV1 = execSync('git diff --name-only src/lib/tv/').toString().trim();
  assert.equal(diffTvV1, '', 'src/lib/tv/ (TV V1) files must remain completely untouched');

  const diffWeb = execSync('git diff --name-only src/components/ src/features/').toString().trim();
  assert.equal(diffWeb, '', 'src/components/ and src/features/ must remain completely untouched');

  const diffPlayer = execSync('git diff --name-only android-tv/app/src/main/assets/tv-player-controller.js')
    .toString()
    .trim();
  assert.equal(diffPlayer, '', 'tv-player-controller.js must remain untouched');
});
