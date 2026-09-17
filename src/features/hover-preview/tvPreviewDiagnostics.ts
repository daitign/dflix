import { isTVMode } from '../../lib/tv/tvDetection.ts';

export function logTVPreviewStage(stage: string, details?: Record<string, unknown>) {
  if (!isTVMode()) return;
  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  const message = `${stage}${suffix}`;
  console.log(`[DAITIGN TV Preview] ${message}`);
  try {
    window.AndroidTVBridge?.logPreviewEvent?.(message);
  } catch {
    // The diagnostics bridge exists only inside the Android TV shell.
  }
}
