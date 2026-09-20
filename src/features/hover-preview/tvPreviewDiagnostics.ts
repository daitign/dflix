import { isTVMode } from '../../lib/tv/tvDetection.ts';

export function isTVPreviewDiagnosticsEnabled() {
  if (typeof window === 'undefined' || !isTVMode()) return false;
  if (new URLSearchParams(window.location.search).get('tvDebug') === '1') return true;
  try { return window.localStorage.getItem('daitign-tv-debug') === '1'; } catch { return false; }
}

export function logTVPreviewStage(stage: string, details?: Record<string, unknown>) {
  if (!isTVPreviewDiagnosticsEnabled()) return;
  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  const message = `${stage}${suffix}`;
  console.log(`[DAITIGN TV Preview] ${message}`);
  try {
    window.AndroidTVBridge?.logPreviewEvent?.(message);
  } catch {
    // The diagnostics bridge exists only inside the Android TV shell.
  }
}
