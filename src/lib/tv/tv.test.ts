import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTVBack, getTVPlatform, initTVMode, isTVMode, registerTVBackHandler } from './tvDetection.ts';

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

test('6b. TV Spatial Navigation: expanded preview anchors retain focus and vertical column memory', () => {
  const spatial = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/tv/spatialNavigation.ts'),
    'utf-8'
  );

  assert.ok(spatial.includes('isExpandedActiveAnchor'));
  assert.ok(spatial.includes("closest('[data-tv-preview-expanded=\"true\"]')"));
  assert.ok(spatial.includes('preservePreferredXDuringFocus = preserveX'));
  assert.ok(spatial.includes('!preservePreferredXDuringFocus'));
  assert.ok(spatial.includes('lastFocusedByRow'));
  assert.ok(spatial.includes('nextRow.elements.includes(remembered)'));
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

test('10. Android TV uses the proven programmatic root without a diagnostic startup overlay', () => {
  const activity = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/java/com/daitign/stream/MainActivity.kt'),
    'utf-8',
  );
  assert.ok(activity.includes('createNativeRoot()'));
  assert.ok(activity.includes('setContentView(rootContainer)'));
  assert.ok(activity.includes('createBrowseWebView()'));
  assert.ok(activity.includes('startTvPlayer'));
  assert.ok(activity.includes('playerWebView'));
  assert.ok(!activity.includes('DAITIGN TV STARTING'));
  assert.ok(!activity.includes('DAITIGN LOCAL WEBVIEW OK'));
  assert.ok(!activity.includes('splashOverlay'));
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
  assert.ok(controller.includes("var MENU = 'PLAYER_MENU'"));
  assert.ok(controller.includes('discoverMenuItems'));
  assert.ok(controller.includes('[role="menuitem"],[role="option"],button'));
  assert.ok(controller.includes('moveMenu(direction)'));
  assert.ok(controller.includes('activateMenuItem'));
  assert.ok(controller.includes('pointerFallback'));
  assert.ok(controller.includes('closeMenu()'));
  assert.ok(controller.includes('singleChoiceMenu'));
  assert.ok(controller.includes('single-choice option activated; closing popup'));
  assert.ok(controller.includes('CONTROLS_IDLE_MS = 3200'));
  assert.ok(controller.includes('scheduleControlsIdle'));
  assert.ok(controller.includes('popup remains open; Back will retry close'));
  assert.ok(controller.includes('finishMenuClose'));
  assert.ok(controller.includes("dispatchKey(popupBefore, 'Escape')"));
  assert.ok(controller.includes("if (state === MENU) { closeMenu(); return true; }"));
  assert.ok(controller.includes('background:rgba(255,255,255,.19)'));
  assert.ok(controller.includes('box-shadow:none'));
  assert.ok(controller.includes('transform:none'));
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
  assert.ok(activity.includes('STARTUP_TIMEOUT_MS = 10_000L'));
  assert.ok(activity.includes('showBrowseFailure'));
  assert.ok(activity.includes('retryButton'));
  assert.ok(activity.includes('DAITIGN STARTUP ERROR'));
  assert.ok(activity.includes('onPageStarted'));
  assert.ok(activity.includes('onPageFinished'));
  assert.ok(activity.includes('onReceivedError'));
  assert.ok(activity.includes('onReceivedHttpError'));
  assert.ok(activity.includes('onReceivedSslError'));
  assert.ok(activity.includes('handler?.cancel()'));
  assert.ok(!activity.includes('splashOverlay'));
});

test('14. Android TV player owns D-pad input and loads VIDSTUCK without a synthetic test screen', () => {
  const activity = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/java/com/daitign/stream/MainActivity.kt'),
    'utf-8',
  );
  assert.ok(activity.includes('override fun dispatchKeyEvent'));
  for (const key of ['KEYCODE_DPAD_CENTER', 'KEYCODE_ENTER', 'KEYCODE_NUMPAD_ENTER', 'KEYCODE_DPAD_LEFT', 'KEYCODE_DPAD_RIGHT', 'KEYCODE_DPAD_UP', 'KEYCODE_DPAD_DOWN', 'KEYCODE_BACK']) {
    assert.ok(activity.includes(key));
  }
  assert.ok(activity.includes('player.isFocusable = true'));
  assert.ok(activity.includes('player.isFocusableInTouchMode = true'));
  assert.ok(activity.includes('player.requestFocus()'));
  assert.ok(activity.includes('wakePlayerControls'));
  assert.ok(activity.includes('loadPendingVidstuck()'));
  assert.ok(activity.includes('[BROWSE KEY PASS-THROUGH]'));
  assert.ok(activity.includes('return super.dispatchKeyEvent(event)'));
  assert.ok(!activity.includes("handleRemoteKey('OK')"));
  assert.ok(activity.includes('handleMediaUnlock'));
  assert.ok(activity.includes('[PREVIEW WEBVIEW]'));
  assert.ok(activity.includes('The previous async'));
  assert.ok(!activity.includes('runSyntheticPlayerTest'));
  assert.ok(!activity.includes('PLAYER_TEST_URL'));
  assert.ok(!activity.includes('loadDataWithBaseURL'));
});

test('15. One Android TV APK detects Fire TV and isolates media keys to playback', () => {
  const activity = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/java/com/daitign/stream/MainActivity.kt'),
    'utf-8',
  );
  const bridge = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/java/com/daitign/stream/WebAppInterface.kt'),
    'utf-8',
  );
  const controller = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/assets/tv-player-controller.js'),
    'utf-8',
  );
  const manifest = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/src/main/AndroidManifest.xml'),
    'utf-8',
  );
  const gradle = fs.readFileSync(
    path.resolve(process.cwd(), 'android-tv/app/build.gradle.kts'),
    'utf-8',
  );

  assert.ok(activity.includes('enum class TvPlatform'));
  assert.ok(activity.includes('amazon.hardware.fire_tv'));
  assert.ok(activity.includes('manufacturer.equals("Amazon"'));
  assert.ok(activity.includes('model.startsWith("AFT"'));
  assert.ok(activity.includes('DAITIGN-FIRE-TV/1.0'));
  assert.ok(bridge.includes('getPlatform'));
  for (const key of [
    'KEYCODE_BUTTON_SELECT',
    'KEYCODE_MEDIA_PLAY_PAUSE',
    'KEYCODE_MEDIA_REWIND',
    'KEYCODE_MEDIA_FAST_FORWARD',
  ]) assert.ok(activity.includes(key));
  assert.ok(activity.includes('[BROWSE MEDIA KEY IGNORED]'));
  assert.ok(controller.includes("key === 'PLAY_PAUSE'"));
  assert.ok(controller.includes("key === 'SEEK_BACKWARD'"));
  assert.ok(controller.includes('suspend: suspendPlayback'));
  assert.ok(activity.includes("daitign:tv-app-visibility"));
  assert.ok(activity.includes('val browseVisible = visible && playerWebView == null'));
  assert.ok(activity.includes('browseWebView?.onPause()'));
  assert.ok(manifest.includes('android.intent.category.LAUNCHER'));
  assert.ok(manifest.includes('android.intent.category.LEANBACK_LAUNCHER'));
  assert.ok(manifest.includes('android.permission.INTERNET'));
  assert.ok(manifest.includes('android:hardwareAccelerated="true"'));
  assert.ok(!gradle.includes('com.google.android.gms'));
  assert.ok(!gradle.includes('play-services'));
});

test('15b. Web TV platform detection defaults safely outside the native bridge', () => {
  assert.equal(getTVPlatform(), 'ANDROID_TV');
});

test('16. Browse menu is a trapped TV focus scope with Back restoration', () => {
  const navigation = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/navigation/NavigationShell.tsx'),
    'utf-8',
  );
  const spatial = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/tv/spatialNavigation.ts'),
    'utf-8',
  );
  assert.ok(navigation.includes('data-tv-focus-scope="menu"'));
  assert.ok(navigation.includes('registerTVBackHandler(closeMenu)'));
  assert.ok(navigation.includes("querySelector<HTMLElement>('[data-tv-focusable=\"true\"]')"));
  assert.ok(navigation.includes('daitign:tv-menu-activate'));
  assert.ok(navigation.includes('data-tv-route={item.href}'));
  assert.ok(navigation.includes('focusFirstTVPageControl'));
  assert.ok(spatial.includes('[data-tv-focus-scope="menu"]'));
  assert.ok(spatial.includes('activateTVFocusedElement'));
  assert.ok(spatial.includes('Always invoke the element\'s genuine React/anchor click handler first'));
  assert.ok(spatial.includes('active.click()'));
  assert.ok(spatial.includes('handleMediaUnlock'));
  assert.ok(spatial.includes("handleRemoteKey: (key) => key === 'OK'"));
  assert.ok(spatial.includes("direction === 'left'"));
});

test('17. TV preview expands in-row and reserves space for regular and Top 10 cards', () => {
  const provider = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/hover-preview/HoverPreviewProvider.tsx'),
    'utf-8',
  );
  assert.ok(provider.includes("setAttribute('data-tv-preview-expanded', 'true')"));
  assert.ok(provider.includes('if (isTv)'));
  assert.ok(provider.includes('Desktop mouse hover keeps its deliberate 520ms intent delay'));
  assert.ok(provider.includes("if (!isTVMode() && lastPointerTypeRef.current !== '') return"));
  assert.ok(!provider.includes('window.setTimeout(activate, 575)'));
  assert.ok(provider.includes('activePreview.referenceElement'));
  assert.ok(provider.includes("scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })"));
  assert.ok(provider.includes('key={`${activePreview.data.playbackType}-${String(activePreview.data.id)}`}'));
  assert.ok(!provider.includes('activePreview.left}-${activePreview.top'));

  const styles = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/tv.css'), 'utf-8');
  assert.ok(styles.includes('--tv-poster-height: calc(var(--tv-poster-width) * 1.5)'));
  assert.ok(styles.includes(".carousel-shell__item[data-tv-preview-expanded='true']"));
  assert.ok(styles.includes(".ranked-card[data-tv-preview-expanded='true'] .hover-preview-card"));
  assert.ok(styles.includes('rgb(229 9 20 / 92%)'));
  assert.ok(styles.includes('.details-hero__trailer-mount'));
  assert.ok(styles.includes('scroll-behavior: auto'));
  assert.ok(styles.includes('transform: translate(-50%, -50%) scale(1)'));
});

test('18. TV preview confirms real playback, retries muted, and responds to remote media unlock', () => {
  const preview = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/hover-preview/YouTubePreview.tsx'),
    'utf-8',
  );
  assert.ok(preview.includes('autoplay timeout after 1500ms'));
  assert.ok(preview.includes("'daitign:tv-media-interaction'"));
  assert.ok(preview.includes('playVideo called from remote interaction'));
  assert.ok(preview.includes('remoteSoundRetryRef.current'));
  assert.ok(preview.includes('playVideo called (Android TV confirmation retry)'));
  assert.ok(preview.includes("[api.PlayerState.PLAYING]: 'PLAYING'"));
  assert.ok(preview.includes("[api.PlayerState.BUFFERING ?? 3]: 'BUFFERING'"));
  assert.ok(preview.includes('success (PLAYING)'));
  assert.ok(preview.includes('enablejsapi=1 autoplay=1 playsinline=1 origin='));
  assert.ok(preview.includes('mutedFallbackActive = true'));
  assert.ok(preview.includes('if (mutedFallbackActive && !remoteSoundRetryRef.current)'));
  assert.ok(preview.includes('preview unmounted'));
  assert.ok(preview.includes('YouTube player error'));
  assert.ok(preview.includes('getYouTubeErrorMeaning'));
  assert.ok(preview.includes('logTVPreviewStage'));
  assert.ok(preview.includes("logTVPreviewStage('audio attempt'"));
  assert.ok(preview.includes("logTVPreviewStage('playback confirmed'"));
  assert.ok(preview.includes("'daitign:tv-app-visibility'"));
  assert.ok(preview.includes('isTVAppSuspendedRef.current'));
  assert.ok(preview.includes("logTVPreviewStage('paused for TV app suspension'"));
});

test('19. TV preview eligibility bypasses WebView reduced-motion quirks before browser heuristics', () => {
  const hoverEligibility = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/hover-preview/usePreviewPlaybackEligibility.ts'),
    'utf-8',
  );
  const heroEligibility = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/home/useHeroPlaybackEligibility.ts'),
    'utf-8',
  );
  assert.ok(hoverEligibility.indexOf('if (isTVMode()) return true') < hoverEligibility.indexOf('if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false'));
  assert.ok(heroEligibility.indexOf('if (isTVMode()) return true') < heroEligibility.indexOf('const prefersReducedMotion'));
});
