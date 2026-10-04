import test from 'node:test';
import assert from 'node:assert/strict';
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

