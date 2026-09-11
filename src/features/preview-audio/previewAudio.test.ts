import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_PREFERENCE_STORAGE_KEY, shouldTrailerBeAudible } from './types.ts';
import { shouldAutoplayHeroTrailer } from '../home/useHeroPlaybackEligibility.ts';
import { calculateHeroVolumeFade, isHeroElementInView } from '../home/useHeroScrollPlayback.ts';
import fs from 'node:fs';
import path from 'node:path';

test('1. Default preview sound preference is SOUND ON', () => {
  // Key name constant check
  assert.equal(SOUND_PREFERENCE_STORAGE_KEY, 'daitign-preview-sound');
});

test('2. Hero trailer eligibility: disabled when prefers-reduced-motion is true', () => {
  const eligible = shouldAutoplayHeroTrailer({
    isLowBandwidth: false,
    prefersReducedMotion: true,
    saveData: false,
    viewportWidth: 1280,
  });
  assert.equal(eligible, false);
});

test('3. Hero trailer eligibility: disabled when Save-Data is enabled', () => {
  const eligible = shouldAutoplayHeroTrailer({
    isLowBandwidth: false,
    prefersReducedMotion: false,
    saveData: true,
    viewportWidth: 1280,
  });
  assert.equal(eligible, false);
});

test('4. Hero trailer eligibility: disabled on low-bandwidth (2g/slow-2g)', () => {
  const eligible = shouldAutoplayHeroTrailer({
    isLowBandwidth: true,
    prefersReducedMotion: false,
    saveData: false,
    viewportWidth: 1280,
  });
  assert.equal(eligible, false);
});

test('5. Hero trailer eligibility: disabled on ultra-compact mobile (< 480px)', () => {
  const eligible = shouldAutoplayHeroTrailer({
    isLowBandwidth: false,
    prefersReducedMotion: false,
    saveData: false,
    viewportWidth: 390,
  });
  assert.equal(eligible, false);
});

test('6. Hero trailer eligibility: enabled on capable devices (desktop / tablet)', () => {
  const eligible = shouldAutoplayHeroTrailer({
    isLowBandwidth: false,
    prefersReducedMotion: false,
    saveData: false,
    viewportWidth: 1024,
  });
  assert.equal(eligible, true);
});

test('7. Audio arbitration: muted when isAudible is false regardless of variant', () => {
  assert.equal(shouldTrailerBeAudible({ variant: 'hero', isAudible: false, isHoverActive: false, isModalActive: false }), false);
  assert.equal(shouldTrailerBeAudible({ variant: 'hover', isAudible: false, isHoverActive: true, isModalActive: false }), false);
  assert.equal(shouldTrailerBeAudible({ variant: 'modal', isAudible: false, isHoverActive: false, isModalActive: true }), false);
});

test('8. Audio arbitration: Hero trailer is audible only when neither hover nor modal is active', () => {
  assert.equal(shouldTrailerBeAudible({ variant: 'hero', isAudible: true, isHoverActive: false, isModalActive: false }), true);
  assert.equal(shouldTrailerBeAudible({ variant: 'hero', isAudible: true, isHoverActive: true, isModalActive: false }), false);
  assert.equal(shouldTrailerBeAudible({ variant: 'hero', isAudible: true, isHoverActive: false, isModalActive: true }), false);
  assert.equal(shouldTrailerBeAudible({ variant: 'hero', isAudible: true, isHoverActive: true, isModalActive: true }), false);
});

test('9. Audio arbitration: Hover preview trailer is audible when modal is not active', () => {
  assert.equal(shouldTrailerBeAudible({ variant: 'hover', isAudible: true, isHoverActive: true, isModalActive: false }), true);
  assert.equal(shouldTrailerBeAudible({ variant: 'hover', isAudible: true, isHoverActive: true, isModalActive: true }), false);
});

test('10. Audio arbitration: Modal hero trailer is audible when isAudible is true', () => {
  assert.equal(shouldTrailerBeAudible({ variant: 'modal', isAudible: true, isHoverActive: false, isModalActive: true }), true);
  assert.equal(shouldTrailerBeAudible({ variant: 'modal', isAudible: true, isHoverActive: true, isModalActive: true }), true);
});

test('11. Hero scroll volume fade: starts at 100% and smoothly fades to 0% as user scrolls down', () => {
  // Default fade distance (600px)
  assert.equal(calculateHeroVolumeFade(0), 1.0);
  assert.equal(calculateHeroVolumeFade(-80), 1.0);
  assert.equal(calculateHeroVolumeFade(300), 0.5);
  assert.equal(calculateHeroVolumeFade(150), 0.75);
  assert.equal(calculateHeroVolumeFade(600), 0.0);
  assert.equal(calculateHeroVolumeFade(800), 0.0);

  // Explicit fade distance (320px)
  assert.equal(calculateHeroVolumeFade(0, 320), 1.0);
  assert.equal(calculateHeroVolumeFade(-80, 320), 1.0);
  assert.equal(calculateHeroVolumeFade(160, 320), 0.5);
  assert.equal(calculateHeroVolumeFade(80, 320), 0.75);
  assert.equal(calculateHeroVolumeFade(320, 320), 0.0);
  assert.equal(calculateHeroVolumeFade(500, 320), 0.0);
});

test('12. Hero viewport visibility: detects when hero is in view vs scrolled off screen', () => {
  const windowHeight = 900;
  // Hero fully in view at the top of the page
  assert.equal(isHeroElementInView({ top: 0, bottom: 650 }, windowHeight), true);
  // Hero partially scrolled down but still well in view
  assert.equal(isHeroElementInView({ top: -200, bottom: 450 }, windowHeight), true);
  // Hero scrolled past the top threshold (bottom <= 60px): not in view, must pause
  assert.equal(isHeroElementInView({ top: -600, bottom: 50 }, windowHeight), false);
  assert.equal(isHeroElementInView({ top: -750, bottom: -100 }, windowHeight), false);
  // Hero below the viewport (e.g. if page scrolled far up or offscreen)
  assert.equal(isHeroElementInView({ top: 950, bottom: 1600 }, windowHeight), false);
  // Null element rect
  assert.equal(isHeroElementInView(null, windowHeight), false);
});

test('13. HeroBanner: binds heroRef and passes scroll playback controls to YouTubePreview', () => {
  const heroBannerSrc = fs.readFileSync(
    path.resolve('src/features/home/components/HeroBanner.tsx'),
    'utf8'
  );
  assert.ok(heroBannerSrc.includes('useHeroScrollPlayback(heroRef)'), 'HeroBanner must call useHeroScrollPlayback');
  assert.ok(heroBannerSrc.includes('ref={heroRef}'), 'HeroBanner section must attach heroRef');
  assert.ok(heroBannerSrc.includes('isHeroInView={isHeroInView}'), 'HeroBanner must pass isHeroInView to YouTubePreview');
  assert.ok(heroBannerSrc.includes('heroVolumeFactor={heroVolumeFactor}'), 'HeroBanner must pass heroVolumeFactor to YouTubePreview');
});

test('14. YouTubePreview: pauses trailer when not in view and smoothly updates volume', () => {
  const ytPreviewSrc = fs.readFileSync(
    path.resolve('src/features/hover-preview/YouTubePreview.tsx'),
    'utf8'
  );
  assert.ok(ytPreviewSrc.includes('isHeroInView'), 'YouTubePreview must accept isHeroInView');
  assert.ok(ytPreviewSrc.includes('heroVolumeFactor'), 'YouTubePreview must accept heroVolumeFactor');
  assert.ok(ytPreviewSrc.includes('player.pauseVideo()'), 'YouTubePreview must call pauseVideo when not in view');
  assert.ok(ytPreviewSrc.includes('player.setVolume?.(targetVol)'), 'YouTubePreview must set faded volume on scroll');
  assert.ok(ytPreviewSrc.includes('fadeIntervalRef'), 'YouTubePreview must maintain volume fader interval');
});

test('15. PreviewAudioContext: initializes sound to ON by default and supports wheel/scroll gesture activation', () => {
  const audioContextSrc = fs.readFileSync(
    path.resolve('src/features/preview-audio/PreviewAudioContext.tsx'),
    'utf8'
  );
  assert.ok(audioContextSrc.includes('useState<boolean>(true)'), 'autoplaySoundAllowed must initialize to true for default sound ON');
  assert.ok(audioContextSrc.includes("'wheel'"), 'audioContext must listen for wheel events');
  assert.ok(audioContextSrc.includes("'scroll'"), 'audioContext must listen for scroll events');
});


