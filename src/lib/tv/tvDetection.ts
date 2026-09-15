declare global {
  interface Window {
    DAITIGN_TV?: {
      isTV?: boolean;
      version?: string;
      handleBack?: () => boolean;
      onNativeBack?: () => boolean;
      onPlayerClosed?: () => void;
      saveBrowseState?: () => void;
      restoreBrowseState?: () => void;
      getBrowseState?: () => string;
    };
    AndroidTVBridge?: {
      exitApp?: () => void;
      getAppVersion?: () => string;
      showToast?: (message: string) => void;
      startTvPlayer?: (vidstuckUrl: string, stateJson: string) => void;
      closeTvPlayer?: () => void;
      setPlayerState?: (state: string) => void;
    };
  }
}

import { getTvBrowseState, restoreTvBrowseState, saveTvBrowseState } from './tvBrowseState.ts';

type BackHandler = () => boolean;
const backHandlers: BackHandler[] = [];

/**
 * Checks whether the application is running in TV mode via query param, User-Agent, or native bridge.
 */
export function isTVMode(): boolean {
  if (typeof window === 'undefined') return false;

  if (document.documentElement.classList.contains('daitign-tv')) {
    return true;
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tv') === '1' || urlParams.has('tv')) {
    return true;
  }

  if (window.DAITIGN_TV?.isTV === true) {
    return true;
  }

  const ua = window.navigator.userAgent || '';
  if (/DAITIGN-TV|AndroidTV|GoogleTV|SmartTV|Large Screen/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Checks whether the user is currently watching video in TV mode.
 */
export function isTvWatchMode(): boolean {
  if (typeof window === 'undefined') return false;
  return isTVMode() && (
    window.location.pathname.startsWith('/watch') ||
    Boolean(document.querySelector('.watch-page')) ||
    document.documentElement.classList.contains('daitign-tv-watching')
  );
}

/**
 * Registers a back button handler. Returns an unregister function.
 * Handlers are evaluated in LIFO order (last registered / highest priority first).
 */
export function registerTVBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index !== -1) {
      backHandlers.splice(index, 1);
    }
  };
}

/**
 * Executes the active TV back handler.
 * Returns true if a handler handled the back action, false otherwise.
 */
export function executeTVBack(): boolean {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    const handler = backHandlers[i];
    try {
      if (handler()) {
        return true;
      }
    } catch (e) {
      console.error('[DAITIGN-TV] Error in back handler:', e);
    }
  }
  return false;
}

/**
 * Initializes TV mode by setting up the HTML class and the global bridge.
 */
export function initTVMode(): boolean {
  if (typeof window === 'undefined') return false;

  const tv = isTVMode();
  if (tv) {
    document.documentElement.classList.add('daitign-tv');

    window.DAITIGN_TV = {
      ...window.DAITIGN_TV,
      isTV: true,
      version: '1.0',
      handleBack: () => executeTVBack(),
      onNativeBack: () => executeTVBack(),
      saveBrowseState: () => {
        saveTvBrowseState();
      },
      restoreBrowseState: () => {
        restoreTvBrowseState();
      },
      getBrowseState: () => {
        return JSON.stringify(getTvBrowseState() || {});
      },
      onPlayerClosed: () => {
        restoreTvBrowseState();
        if (window.location.pathname.startsWith('/watch')) {
          const saved = getTvBrowseState();
          const target = (saved?.route && !saved.route.startsWith('/watch')) ? saved.route : '/';
          window.history.pushState({}, '', target);
          window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
        }
      },
    };
  }

  return tv;
}
