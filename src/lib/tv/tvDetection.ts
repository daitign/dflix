import { getTvBrowseState, restoreTvBrowseState, saveTvBrowseState } from './tvBrowseState.ts';

type BackHandler = () => boolean;
export type TVPlatform = 'ANDROID_TV' | 'FIRE_TV';
const backHandlers: BackHandler[] = [];

declare global {
  interface Window {
    AndroidTVBridge?: {
      closeTvPlayer?: () => void;
      exitApp?: () => void;
      getAppVersion?: () => string;
      getPlatform?: () => string;
      isTV?: () => boolean;
      logPreviewEvent?: (message: string) => void;
      showToast?: (message: string) => void;
      startTvPlayer?: (vidstuckUrl: string, stateJson: string) => void;
    };
    DAITIGN_TV?: {
      getBrowseState?: () => string;
      handleBack?: () => boolean;
      handleMediaUnlock?: () => boolean;
      handleRemoteKey?: (key: 'OK') => boolean;
      isTV?: boolean;
      onNativeBack?: () => boolean;
      onPlayerClosed?: () => void;
      platform?: TVPlatform;
      restoreBrowseState?: () => void;
      saveBrowseState?: () => void;
      tvMediaInteractionUnlocked?: boolean;
      version?: string;
    };
  }
}

export function getTVPlatform(): TVPlatform {
  if (typeof window === 'undefined') return 'ANDROID_TV';
  try {
    const bridgePlatform = window.AndroidTVBridge?.getPlatform?.();
    if (bridgePlatform === 'FIRE_TV') return 'FIRE_TV';
  } catch {}
  return /DAITIGN-FIRE-TV|\bAFT[A-Z0-9]*\b/i.test(window.navigator.userAgent) ? 'FIRE_TV' : 'ANDROID_TV';
}

export function isTVMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.classList.contains('daitign-tv')) return true;
  if (new URLSearchParams(window.location.search).get('tv') === '1') return true;
  if (/DAITIGN-TV/i.test(window.navigator.userAgent)) return true;
  try {
    return window.AndroidTVBridge?.isTV?.() === true || window.DAITIGN_TV?.isTV === true;
  } catch {
    return false;
  }
}

export function registerTVBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
  };
}

export function executeTVBack(): boolean {
  for (let index = backHandlers.length - 1; index >= 0; index -= 1) {
    if (backHandlers[index]()) return true;
  }
  return false;
}

export function initTVMode(): boolean {
  if (!isTVMode()) return false;
  const platform = getTVPlatform();
  document.documentElement.classList.add('daitign-tv');
  document.documentElement.classList.toggle('daitign-fire-tv', platform === 'FIRE_TV');
  document.documentElement.dataset.tvPlatform = platform;
  window.DAITIGN_TV = {
    ...window.DAITIGN_TV,
    getBrowseState: () => JSON.stringify(getTvBrowseState() ?? {}),
    handleBack: executeTVBack,
    isTV: true,
    onNativeBack: executeTVBack,
    onPlayerClosed: () => { restoreTvBrowseState(); },
    platform,
    restoreBrowseState: () => { restoreTvBrowseState(); },
    saveBrowseState: () => { saveTvBrowseState(); },
    version: '2.0',
  };
  return true;
}
