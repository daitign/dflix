import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TvPreviewManager } from './TvPreviewManager.ts';

test('TV V2 Preview Manager: sound is ON by default and toggles cleanly', () => {
  const manager = new TvPreviewManager();
  assert.equal(manager.getIsMuted(), false); // Sound ON by default

  manager.toggleMute();
  assert.equal(manager.getIsMuted(), true);

  manager.toggleMute();
  assert.equal(manager.getIsMuted(), false);
});

test('TV V2 Preview Manager: enforces Single Active Preview invariant', async () => {
  const manager = new TvPreviewManager();

  // Request preview 1 with 0ms delay
  manager.requestPreview('hero-trailer', { delayMs: 0 });
  assert.equal(manager.getActivePreviewId(), 'hero-trailer');

  // Request preview 2
  manager.requestPreview('card-trailer-2', { delayMs: 0 });
  assert.equal(manager.getActivePreviewId(), 'card-trailer-2');
  assert.equal(manager.isPreviewActive('hero-trailer'), false);
  assert.equal(manager.isPreviewActive('card-trailer-2'), true);

  // Stop active
  manager.stopActive();
  assert.equal(manager.getActivePreviewId(), null);
});

test('TV V2 Preview Manager: fast focus movement cancels pending preview before video loads', async () => {
  const manager = new TvPreviewManager();

  // Request with 100ms delay
  manager.requestPreview('card-quick-pass-1', { delayMs: 100 });
  assert.equal(manager.getActivePreviewId(), null); // Not active yet

  // User quickly moves away at 20ms
  manager.cancelPending();

  // Wait 120ms to verify it never fired
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(manager.getActivePreviewId(), null);
});

test('TV V2 Preview Manager: settled delay triggers preview only after duration', async () => {
  const manager = new TvPreviewManager();

  // Request preview with 80ms delay
  manager.requestPreview('card-settle-test', { delayMs: 80 });
  assert.equal(manager.getActivePreviewId(), null);

  // Still null at 40ms
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(manager.getActivePreviewId(), null);

  // Active at 100ms
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(manager.getActivePreviewId(), 'card-settle-test');

  manager.stop('card-settle-test');
  assert.equal(manager.getActivePreviewId(), null);
});

test('TV V2 Preview Manager: rapid card fly-over only activates the final resting card', async () => {
  const manager = new TvPreviewManager();

  // Rapidly fly over card-1, card-2, card-3
  manager.requestPreview('card-fly-1', { delayMs: 60 });
  await new Promise((resolve) => setTimeout(resolve, 20));

  manager.requestPreview('card-fly-2', { delayMs: 60 });
  await new Promise((resolve) => setTimeout(resolve, 20));

  manager.requestPreview('card-fly-3', { delayMs: 60 });

  // Neither fly-1 nor fly-2 should ever have become active
  assert.equal(manager.isPreviewActive('card-fly-1'), false);
  assert.equal(manager.isPreviewActive('card-fly-2'), false);

  // Wait for fly-3 to settle
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(manager.isPreviewActive('card-fly-1'), false);
  assert.equal(manager.isPreviewActive('card-fly-2'), false);
  assert.equal(manager.isPreviewActive('card-fly-3'), true);
  assert.equal(manager.getActivePreviewId(), 'card-fly-3');

  manager.stopActive();
});

test('TV V2 Preview Manager: registers baseline hero, pauses during card/detail preview, and resumes hero after stop', async () => {
  const manager = new TvPreviewManager();

  // Register baseline Hero
  manager.registerHero('hero-main', { delayMs: 20 });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(manager.getActivePreviewId(), 'hero-main');
  assert.equal(manager.isPreviewActive('hero-main'), true);

  // User focuses a movie card
  manager.requestPreview('card-preview-1', { delayMs: 20 });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(manager.getActivePreviewId(), 'card-preview-1');
  assert.equal(manager.isPreviewActive('hero-main'), false);

  // User blurs the card; card preview stops with short resume delay for test
  manager.stop('card-preview-1');
  assert.equal(manager.getActivePreviewId(), null);

  // Hero automatically resumes after delay
  manager.resumeHero(40);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(manager.getActivePreviewId(), 'hero-main');
  assert.equal(manager.isPreviewActive('hero-main'), true);

  // Clean unregister hero
  manager.unregisterHero('hero-main');
  assert.equal(manager.getActivePreviewId(), null);
});

test('TV V2 Preview Manager: hero starts immediately on registration when idle', () => {
  const manager = new TvPreviewManager();
  // Register hero without delayMs option
  manager.registerHero('hero-home');
  // Must become active immediately (0ms delay) so TV screen is not left blank
  assert.equal(manager.getActivePreviewId(), 'hero-home');
  assert.equal(manager.isPreviewActive('hero-home'), true);
  manager.unregisterHero('hero-home');
});

test('TV V2 Preview Manager: tracks user interaction state correctly for audio unlock', () => {
  const manager = new TvPreviewManager();
  assert.equal(manager.getHasUserInteracted(), false);

  manager.setHasUserInteracted(true);
  assert.equal(manager.getHasUserInteracted(), true);
});

test('TV V2 Preview Manager: card focus takes preview ownership from baseline hero and returns it on blur', async () => {
  const manager = new TvPreviewManager();

  // Baseline hero active
  manager.registerHero('hero-featured');
  assert.equal(manager.getActivePreviewId(), 'hero-featured');

  // Focused card requests preview
  manager.requestPreview('card-focus-1', { delayMs: 10 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(manager.getActivePreviewId(), 'card-focus-1');
  assert.equal(manager.isPreviewActive('hero-featured'), false);

  // Card loses focus
  manager.stop('card-focus-1');
  assert.equal(manager.getActivePreviewId(), null);

  // Hero resumes
  manager.resumeHero(10);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(manager.getActivePreviewId(), 'hero-featured');
  assert.equal(manager.isPreviewActive('hero-featured'), true);

  manager.unregisterHero('hero-featured');
});

test('TV V2 Details Hero Preview: maintains full edge-to-edge cover and 16:9 ratio', () => {
  const previewCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/tv-v2/previews/TvPreviewPlayer.css'),
    'utf-8'
  );
  const screensCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );

  // Must ensure preview video covers hero container preserving 16:9 aspect ratio
  assert.ok(previewCss.includes('.tv-v2-preview-frame--detail'));
  assert.ok(previewCss.includes('.tv-v2-preview-video--detail'));
  assert.ok(previewCss.includes('aspect-ratio: 16 / 9'));
  assert.ok(previewCss.includes('min-width: 100%'));
  assert.ok(previewCss.includes('min-height: 100%'));
  assert.ok(previewCss.includes('transform: translate(-50%, -50%) scale(1.02)'));

  // Hero container defines responsive height variable and unconstrained preview
  assert.ok(screensCss.includes('--tv-detail-hero-height: clamp(200px, 36vh, 320px)'));
  assert.ok(screensCss.includes('.tv-v2-detail__hero-preview'));
  assert.ok(screensCss.includes('max-width: none'));
});

test('TV V2 Details Modal: More Like This cards use responsive clamp tokens and hidden scrollbar', () => {
  const screensCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/tv-v2/screens/TvScreens.css'),
    'utf-8'
  );

  // Horizontal scroll container with hidden scrollbar and proper edge padding
  assert.ok(screensCss.includes('.tv-v2-detail__similar-list'));
  assert.ok(screensCss.includes('overflow-x: auto'));
  assert.ok(screensCss.includes('overflow-y: hidden'));
  assert.ok(screensCss.includes('scrollbar-width: none'));
  assert.ok(screensCss.includes('.tv-v2-detail__similar-list::-webkit-scrollbar'));

  // Cards use clamp tokens and 2:3 aspect ratio
  assert.ok(screensCss.includes('clamp(8rem, 10vw, 11.5rem)'));
  assert.ok(screensCss.includes('aspect-ratio: 2 / 3'));
  assert.ok(screensCss.includes('border-radius: 6px'));
});

test('TV V2 Player Controller: single-choice submenus auto-close while protecting nested multi-step settings', () => {
  const controller = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/assets/tv-player-controller.js'),
    'utf-8'
  );

  // Checks languages, resolutions, and single-choice terms
  assert.ok(controller.includes('singleChoiceMenu'));
  assert.ok(controller.includes('english|filipino|tagalog|español|spanish'));
  assert.ok(controller.includes('1080p?|720p?|480p?|360p?|16:9|4:3|cover|contain'));

  // Strictly protects nested settings from auto-close
  assert.ok(controller.includes('isSubmenuNavigation'));
  assert.ok(controller.includes('style|delay|speed|audio|font|color|custom|subtitle style|subtitle delay|settings'));

  // Dismisses popup and restores focus to opener in CONTROLS state
  assert.ok(controller.includes('dismissPopup(popupBefore)'));
  assert.ok(controller.includes('finishMenuClose()'));
});

test('TV V2 Focused Card Preview: delivers full-bleed cover sizing with provider letterbox overscan and native video support', () => {
  const previewCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/tv-v2/previews/TvPreviewPlayer.css'),
    'utf-8'
  );
  const componentsCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/tv-v2/components/TvComponents.css'),
    'utf-8'
  );
  const playerTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/tv-v2/previews/TvPreviewPlayer.tsx'),
    'utf-8'
  );

  // 1. Full-bleed card preview frame and overscan video container
  assert.ok(previewCss.includes('.tv-v2-preview-frame--card'));
  assert.ok(previewCss.includes('.tv-v2-preview-video--card'));
  assert.ok(previewCss.includes('transform: translate(-50%, -50%) scale(1.28)'));
  assert.ok(previewCss.includes('transform-origin: center center'));
  assert.ok(previewCss.includes('aspect-ratio: 16 / 9'));

  // 2. Native video cover rules
  assert.ok(previewCss.includes('object-fit: cover'));
  assert.ok(previewCss.includes('object-position: center center'));

  // 3. Card layer structure: surface mask -> video (z:2) -> scrim (z:3) -> info (z:4)
  assert.ok(componentsCss.includes('.tv-v2-card__surface'));
  assert.ok(componentsCss.includes('.tv-v2-card__video-layer'));
  assert.ok(componentsCss.includes('z-index: 2'));
  assert.ok(componentsCss.includes('.tv-v2-card__scrim'));
  assert.ok(componentsCss.includes('z-index: 3'));
  assert.ok(componentsCss.includes('.tv-v2-card__info'));
  assert.ok(componentsCss.includes('z-index: 4'));

  // 4. TSX discriminator assigns card preview classes
  assert.ok(playerTsx.includes("isCard ? 'tv-v2-preview-frame--card' : ''"));
  assert.ok(playerTsx.includes("isCard ? 'tv-v2-preview-video--card' : ''"));
});




