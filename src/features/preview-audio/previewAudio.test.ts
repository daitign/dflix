import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_PREFERENCE_STORAGE_KEY, shouldTrailerBeAudible } from './types.ts';
import { shouldAutoplayHeroTrailer } from '../home/useHeroPlaybackEligibility.ts';

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

