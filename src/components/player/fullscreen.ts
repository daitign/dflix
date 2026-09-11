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

  return (document.fullscreenEnabled === true && typeof element.requestFullscreen === 'function')
    || (fullscreenDocument.webkitFullscreenEnabled === true
      && typeof fullscreenElement.webkitRequestFullscreen === 'function');
}

export async function requestElementFullscreen(element: HTMLElement | null) {
  if (!element || !canRequestElementFullscreen(element)) return false;
  const fullscreenElement = element as WebKitFullscreenElement;

  try {
    if (typeof element.requestFullscreen === 'function') await element.requestFullscreen();
    else await fullscreenElement.webkitRequestFullscreen?.();

    const fullscreenDocument = document as WebKitFullscreenDocument;
    return document.fullscreenElement === element || fullscreenDocument.webkitFullscreenElement === element;
  } catch {
    return false;
  }
}
