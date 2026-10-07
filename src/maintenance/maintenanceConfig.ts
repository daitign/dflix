/**
 * EMERGENCY LOW-USAGE MAINTENANCE MODE CONFIGURATION
 * 
 * Goal: reduce DAITIGN Stream's Vercel usage to the absolute minimum possible
 * until October 15, 2026.
 * 
 * TV applications (?tv=1, ?tv=2, Android TV, Fire TV, DAITIGN-TV UA) bypass
 * this maintenance mode completely.
 * 
 * To disable manually at any time, change TEMPORARY_WEB_MAINTENANCE to false:
 */
export const TEMPORARY_WEB_MAINTENANCE = true;
export const RESUME_AT = '2026-10-15T00:00:00+08:00';

/**
 * Checks whether maintenance mode is currently active.
 * Automatically becomes inactive once current time >= RESUME_AT.
 */
export function isMaintenanceActive(nowMs: number = Date.now()): boolean {
  if (!TEMPORARY_WEB_MAINTENANCE) return false;
  const resumeTime = new Date(RESUME_AT).getTime();
  if (Number.isFinite(resumeTime) && nowMs >= resumeTime) {
    return false;
  }
  return true;
}

/**
 * Detects if the current visitor is an authorized TV application that should
 * bypass maintenance mode completely.
 */
export function isTvBypass(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Query parameters & routes (?tv=1, ?tv=2, ?tv=v2, /tv-v2)
  try {
    const params = new URLSearchParams(window.location.search);
    const tvParam = params.get('tv');
    if (tvParam === '1' || tvParam === '2' || tvParam === 'v2') {
      return true;
    }
    if (window.location.pathname.startsWith('/tv-v2')) {
      return true;
    }
  } catch {}

  // 2. User Agent checks (Android TV app, Fire TV app, DAITIGN-TV user agent)
  try {
    const ua = window.navigator.userAgent || '';
    if (/DAITIGN-TV/i.test(ua)) return true;
    if (/DAITIGN-FIRE-TV|\bAFT[A-Z0-9]*\b/i.test(ua)) return true;
  } catch {}

  // 3. Android TV Bridge injection (Android TV app WebView)
  try {
    if (window.AndroidTVBridge) {
      if (typeof window.AndroidTVBridge.isTV === 'function') {
        if (window.AndroidTVBridge.isTV()) return true;
      }
      return true;
    }
  } catch {}

  // 4. DAITIGN_TV global or DOM markers
  try {
    if (window.DAITIGN_TV?.isTV === true) return true;
    if (document.documentElement.classList.contains('daitign-tv')) return true;
  } catch {}

  return false;
}
