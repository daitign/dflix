interface WebKitFullscreenDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
}

interface WebKitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function canRequestElementFullscreen(element: HTMLElement | null) {
  if (!element) return false;
  const fullscreenDocument = document as WebKitFullscreenDocument;
  const fullscreenElement = element as WebKitFullscreenElement;

  return (document.fullscreenEnabled !== false && typeof element.requestFullscreen === 'function')
    || (fullscreenDocument.webkitFullscreenEnabled !== false
      && typeof fullscreenElement.webkitRequestFullscreen === 'function');
}

export function isElementFullscreen(element: HTMLElement | null) {
  if (!element) return false;
  const fullscreenDocument = document as WebKitFullscreenDocument;
  const fullscreenElement = document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement;
  return fullscreenElement === element || Boolean(fullscreenElement && element.contains(fullscreenElement));
}

export async function lockLandscapeOrientation() {
  const orientation = window.screen.orientation as ScreenOrientation | undefined;
  if (typeof orientation?.lock !== 'function') return false;

  try {
    await orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  try {
    window.screen.orientation?.unlock();
  } catch {
    // Some browsers expose Screen Orientation but only permit it in native fullscreen.
  }
}

export async function requestElementFullscreen(element: HTMLElement | null) {
  if (!element || !canRequestElementFullscreen(element)) return false;
  const fullscreenElement = element as WebKitFullscreenElement;

  try {
    if (typeof element.requestFullscreen === 'function') await element.requestFullscreen();
    else await fullscreenElement.webkitRequestFullscreen?.();
    await lockLandscapeOrientation();
    return true;
  } catch {
    return false;
  }
}
