import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTVBack, initTVMode, isTVMode, registerTVBackHandler } from './tvDetection.ts';

test('1. TV detection: returns false by default in standard node/browser environment without TV signals', () => {
  assert.equal(isTVMode(), false);
});

test('2. TV Back Button: handlers evaluate in LIFO order and return status', () => {
  const actions: string[] = [];

  const unregisterFirst = registerTVBackHandler(() => {
    actions.push('first');
    return true;
  });

  const unregisterSecond = registerTVBackHandler(() => {
    actions.push('second');
    return true; // handled by second (higher priority / LIFO)
  });

  const handled = executeTVBack();
  assert.equal(handled, true);
  assert.deepEqual(actions, ['second']);

  // Unregister second handler
  unregisterSecond();
  actions.length = 0;

  const handledFirst = executeTVBack();
  assert.equal(handledFirst, true);
  assert.deepEqual(actions, ['first']);

  // Unregister first handler
  unregisterFirst();
  actions.length = 0;

  const handledNone = executeTVBack();
  assert.equal(handledNone, false);
  assert.deepEqual(actions, []);
});

test('3. TV Back Button: falls back to next handler when topmost handler returns false', () => {
  const actions: string[] = [];

  const unregisterBottom = registerTVBackHandler(() => {
    actions.push('bottom');
    return true;
  });

  const unregisterTop = registerTVBackHandler(() => {
    actions.push('top-not-handled');
    return false; // not handled
  });

  const handled = executeTVBack();
  assert.equal(handled, true);
  assert.deepEqual(actions, ['top-not-handled', 'bottom']);

  unregisterTop();
  unregisterBottom();
});

import {
  TV_FOCUSABLE_SELECTOR,
  isFocusCandidate,
  findClosestInRow,
} from './spatialNavigation.ts';
import fs from 'node:fs';
import path from 'node:path';

test('4. TV Spatial Navigation: TV_FOCUSABLE_SELECTOR enforces strict data-tv-focusable attribute', () => {
  assert.ok(TV_FOCUSABLE_SELECTOR.includes('[data-tv-focusable="true"]'));
  assert.ok(TV_FOCUSABLE_SELECTOR.includes(':not([disabled])'));
  assert.ok(TV_FOCUSABLE_SELECTOR.includes(':not([aria-hidden="true"])'));
});

test('5. TV Spatial Navigation: isFocusCandidate excludes headings, containers, tracks, and badges', () => {
  const createMockElement = (tagName: string, attributes: Record<string, string> = {}, classList: string[] = []) => {
    return {
      tagName: tagName.toUpperCase(),
      getAttribute: (attr: string) => attributes[attr] ?? null,
      matches: (selector: string) => {
        const classes = selector.split(',').map((s) => s.trim().replace(/^\./, ''));
        return classList.some((c) => classes.includes(c));
      },
    } as unknown as HTMLElement;
  };

  // Section headings must NEVER be focus candidates
  assert.equal(isFocusCandidate(createMockElement('H2', {}, ['section-header__title'])), false);
  assert.equal(isFocusCandidate(createMockElement('H1')), false);
  assert.equal(isFocusCandidate(createMockElement('H3')), false);
  assert.equal(isFocusCandidate(createMockElement('DIV', { role: 'heading' })), false);
  assert.equal(isFocusCandidate(createMockElement('SPAN', {}, ['section-header__title'])), false);
  assert.equal(isFocusCandidate(createMockElement('HEADER', {}, ['section-header'])), false);

  // Row and carousel containers must NEVER be focus candidates
  assert.equal(isFocusCandidate(createMockElement('SECTION', {}, ['media-row'])), false);
  assert.equal(isFocusCandidate(createMockElement('DIV', {}, ['carousel-shell'])), false);
  assert.equal(isFocusCandidate(createMockElement('DIV', {}, ['carousel-shell__track'])), false);
  assert.equal(isFocusCandidate(createMockElement('DIV', {}, ['carousel-shell__item'])), false);

  // Informational badges must NEVER be focus candidates
  assert.equal(isFocusCandidate(createMockElement('DIV', {}, ['netflix-badge'])), false);

  // Valid media cards and buttons ARE allowed focus candidates
  assert.equal(isFocusCandidate(createMockElement('BUTTON', { 'data-tv-focusable': 'true' }, ['media-card__surface'])), true);
  assert.equal(isFocusCandidate(createMockElement('BUTTON', { 'data-tv-focusable': 'true' }, ['hero-banner__play-button'])), true);
  assert.equal(isFocusCandidate(createMockElement('A', { 'data-tv-focusable': 'true' }, ['top-navigation__link'])), true);
});

test('6. TV Spatial Navigation: findClosestInRow selects candidate with closest horizontal center', () => {
  const mockCard = (centerX: number) => {
    return {
      getBoundingClientRect: () => ({
        left: centerX - 100,
        right: centerX + 100,
        top: 200,
        bottom: 400,
        width: 200,
        height: 200,
      }),
    } as HTMLElement;
  };

  const card1 = mockCard(100);
  const card2 = mockCard(320);
  const card3 = mockCard(540);
  const candidates = [card1, card2, card3];

  // From x = 300, card2 (x = 320) is closest
  assert.equal(findClosestInRow(candidates, 300), card2);

  // From x = 110, card1 (x = 100) is closest
  assert.equal(findClosestInRow(candidates, 110), card1);

  // From x = 500, card3 (x = 540) is closest
  assert.equal(findClosestInRow(candidates, 500), card3);
});

test('7. Component audit: Carousel track never receives focus (tabIndex=-1)', () => {
  const carouselFile = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/CarouselShell.tsx'),
    'utf-8'
  );
  assert.ok(!carouselFile.includes('tabIndex={0}'), 'CarouselShell track must not have tabIndex={0}');
  assert.ok(carouselFile.includes('tabIndex={-1}'), 'CarouselShell track must have tabIndex={-1}');
});

test('8. Component audit: StatusBadge never receives focus stops', () => {
  const badgeFile = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/home/components/StatusBadge.tsx'),
    'utf-8'
  );
  assert.ok(!badgeFile.includes('tabIndex={0}'), 'StatusBadge must not have tabIndex={0}');
  assert.ok(!badgeFile.includes('role="button"'), 'StatusBadge must not have role="button"');
});

test('9. Component audit: Media cards and interactive controls are tagged with data-tv-focusable', () => {
  const mediaCard = fs.readFileSync(path.resolve(process.cwd(), 'src/features/home/components/MediaCard.tsx'), 'utf-8');
  assert.ok(mediaCard.includes('data-tv-focusable="true"'));

  const rankedCard = fs.readFileSync(path.resolve(process.cwd(), 'src/features/home/components/RankedMediaCard.tsx'), 'utf-8');
  assert.ok(rankedCard.includes('data-tv-focusable="true"'));

  const continueCard = fs.readFileSync(path.resolve(process.cwd(), 'src/features/home/components/ContinueWatchingCard.tsx'), 'utf-8');
  assert.ok(continueCard.includes('data-tv-focusable="true"'));

  const heroBanner = fs.readFileSync(path.resolve(process.cwd(), 'src/features/home/components/HeroBanner.tsx'), 'utf-8');
  assert.ok(heroBanner.includes('data-tv-focusable="true"'));

  const navShell = fs.readFileSync(path.resolve(process.cwd(), 'src/components/navigation/NavigationShell.tsx'), 'utf-8');
  assert.ok(navShell.includes('data-tv-focusable="true"'));

  const detailsHero = fs.readFileSync(path.resolve(process.cwd(), 'src/features/details-modal/components/DetailsHero.tsx'), 'utf-8');
  assert.ok(detailsHero.includes('data-tv-focusable="true"'));
});

test('10. TV player uses the four-state native model and keeps the browse WebView alive', () => {
  const activity = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/java/com/daitign/stream/MainActivity.kt'),
    'utf-8',
  );
  for (const state of ['PLAYER_HIDDEN', 'PLAYER_CONTROLS', 'PLAYER_TIMELINE', 'PLAYER_MENU']) {
    assert.ok(activity.includes(state));
  }
  assert.ok(activity.includes('browseWebView?.visibility = View.INVISIBLE'));
  assert.ok(activity.includes('player.loadUrl(uri.toString())'));
  assert.ok(!activity.includes('injectTvPlayerFocusController'));
});

test('11. VIDSTUCK adapter discovers semantic controls without a DAITIGN toolbar', () => {
  const controller = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/assets/tv-player-controller.js'),
    'utf-8',
  );
  for (const control of ['play-pause', 'next', 'volume', 'timeline', 'fit', 'subtitle', 'quality', 'server', 'settings', 'fullscreen']) {
    assert.ok(controller.includes(`'${control}'`));
  }
  assert.ok(controller.includes("[role=\"slider\"]"));
  assert.ok(!controller.includes('toolbar'));
});

test('12. TV layout remains isolated and defines the three responsive density bands', () => {
  const styles = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/tv.css'), 'utf-8');
  assert.ok(styles.includes('html.daitign-tv'));
  assert.ok(styles.includes('@media (max-width: 1400px)'));
  assert.ok(styles.includes('@media (min-width: 3000px)'));
  assert.ok(styles.includes('54vh'));
});

test('13. Android TV startup cannot remain on a silent black splash', () => {
  const activity = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/java/com/daitign/stream/MainActivity.kt'),
    'utf-8',
  );
  assert.ok(activity.includes('https://daiflix.vercel.app/?tv=1'));
  assert.ok(activity.includes('LOAD_TIMEOUT_MS = 9_000L'));
  assert.ok(activity.includes('showStartupFailure()'));
  assert.ok(activity.includes('onPageStarted'));
  assert.ok(activity.includes('onPageFinished'));
  assert.ok(activity.includes('onReceivedError'));
  assert.ok(activity.includes('onReceivedHttpError'));
  assert.ok(activity.includes('onReceivedSslError'));
  assert.ok(activity.includes('handler?.cancel()'));
  assert.ok(activity.includes('errorView.bringToFront()'));
  assert.ok(activity.includes('playerWebView = player'));
  assert.ok(activity.indexOf('playerWebView = player') > activity.indexOf('fun startTvPlayer'));
});
