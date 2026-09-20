import { executeTVBack, isTVMode } from './tvDetection.ts';

export const TV_FOCUSABLE_SELECTOR = '[data-tv-focusable="true"]:not([disabled]):not([aria-hidden="true"])';

type Direction = 'down' | 'left' | 'right' | 'up';

interface FocusRow {
  elements: HTMLElement[];
  centerY: number;
  order: number;
}

let preferredX: number | null = null;
let cachedScope: HTMLElement | null = null;
let cachedElements: HTMLElement[] | null = null;
let cachedRows: FocusRow[] | null = null;
let preservePreferredXDuringFocus = false;
let lastFocusedByRow = new WeakMap<HTMLElement, HTMLElement>();

function invalidateNavigationCache() {
  cachedScope = null;
  cachedElements = null;
  cachedRows = null;
}

export function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  const style = window.getComputedStyle(element);
  const isExpandedActiveAnchor = element === document.activeElement
    && Boolean(element.closest('[data-tv-preview-expanded="true"]'));
  if (
    style.display === 'none'
    || style.visibility === 'hidden'
    || (style.opacity === '0' && !isExpandedActiveAnchor)
  ) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function isFocusCandidate(element: HTMLElement): boolean {
  if (element.getAttribute('data-tv-focusable') !== 'true') return false;
  if (element.getAttribute('disabled') !== null || element.getAttribute('aria-hidden') === 'true') return false;
  if (/^(H[1-6]|HEADER|SECTION|ARTICLE)$/.test(element.tagName)) return false;
  return element.getAttribute('role') !== 'heading';
}

function getActiveScope(): HTMLElement {
  const scopes = Array.from(document.querySelectorAll<HTMLElement>(
    '[data-tv-focus-scope="modal"], [data-tv-focus-scope="menu"]',
  ));
  return scopes.reverse().find(isVisible) ?? document.body;
}

export function getFocusableElements(scope: HTMLElement = getActiveScope()): HTMLElement[] {
  if (scope === cachedScope && cachedElements) {
    // Visibility-affecting DOM changes invalidate this cache through the
    // observer. Avoid getComputedStyle/getBoundingClientRect for every card on
    // every D-pad press; that forced layout was noticeable on real TV CPUs.
    if (cachedElements.every((element) => element.isConnected)) return cachedElements.slice();
  }
  cachedScope = scope;
  cachedElements = Array.from(scope.querySelectorAll<HTMLElement>(TV_FOCUSABLE_SELECTOR)).filter(isVisible);
  cachedRows = null;
  return cachedElements;
}

function center(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function explicitRowFor(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>('[data-tv-row]');
}

function rememberRowFocus(element: HTMLElement) {
  const row = explicitRowFor(element);
  if (row) lastFocusedByRow.set(row, element);
}

function rowsFor(elements: HTMLElement[]): FocusRow[] {
  const documentOrder = new Map(elements.map((element, index) => [element, index]));
  const centers = new Map<HTMLElement, { x: number; y: number }>();
  const pointFor = (element: HTMLElement) => {
    const cached = centers.get(element);
    if (cached) return cached;
    const point = center(element);
    centers.set(element, point);
    return point;
  };
  const explicit = new Map<HTMLElement, HTMLElement[]>();
  const loose: HTMLElement[] = [];

  elements.forEach((element) => {
    const row = element.closest<HTMLElement>('[data-tv-row]');
    if (!row) {
      loose.push(element);
      return;
    }
    explicit.set(row, [...(explicit.get(row) ?? []), element]);
  });

  const rows: FocusRow[] = Array.from(explicit.values()).map((rowElements) => ({
    centerY: rowElements.reduce((sum, item) => sum + pointFor(item).y, 0) / rowElements.length,
    elements: rowElements.sort((a, b) => pointFor(a).x - pointFor(b).x),
    order: Math.min(...rowElements.map((item) => documentOrder.get(item) ?? Number.MAX_SAFE_INTEGER)),
  }));

  loose.sort((a, b) => pointFor(a).y - pointFor(b).y || pointFor(a).x - pointFor(b).x);
  loose.forEach((element) => {
    const point = pointFor(element);
    const row = rows.find((candidate) => Math.abs(candidate.centerY - point.y) <= 28);
    if (row) {
      row.elements.push(element);
      row.elements.sort((a, b) => pointFor(a).x - pointFor(b).x);
      row.centerY = row.elements.reduce((sum, item) => sum + pointFor(item).y, 0) / row.elements.length;
      row.order = Math.min(row.order, documentOrder.get(element) ?? Number.MAX_SAFE_INTEGER);
    } else {
      rows.push({
        centerY: point.y,
        elements: [element],
        order: documentOrder.get(element) ?? Number.MAX_SAFE_INTEGER,
      });
    }
  });

  // Screen-space Y is unstable when the fixed navigation bar remains visible
  // while the Hero scrolls above the viewport. DOM order always represents the
  // intended TV sequence: navigation -> Hero -> Top 10 -> catalog rows.
  return rows.sort((a, b) => a.order - b.order);
}

export function findClosestInRow(elements: HTMLElement[], targetX: number): HTMLElement | null {
  return elements.reduce<HTMLElement | null>((closest, element) => {
    if (!closest) return element;
    return Math.abs(center(element).x - targetX) < Math.abs(center(closest).x - targetX) ? element : closest;
  }, null);
}

export function findNextSpatialElement(current: HTMLElement, direction: Direction): HTMLElement | null {
  const scope = getActiveScope();
  if (scope !== cachedScope || !cachedRows) cachedRows = rowsFor(getFocusableElements(scope));
  const rows = cachedRows;
  const rowIndex = rows.findIndex((row) => row.elements.includes(current));
  if (rowIndex < 0) return null;

  const row = rows[rowIndex];
  const index = row.elements.indexOf(current);
  if (direction === 'left' || direction === 'right') {
    const nextIndex = index + (direction === 'right' ? 1 : -1);
    return row.elements[nextIndex] ?? null;
  }

  const nextRow = rows[rowIndex + (direction === 'down' ? 1 : -1)];
  if (!nextRow) return null;
  const nextExplicitRow = nextRow.elements[0] ? explicitRowFor(nextRow.elements[0]) : null;
  const remembered = nextExplicitRow ? lastFocusedByRow.get(nextExplicitRow) : null;
  if (remembered && nextRow.elements.includes(remembered) && isVisible(remembered)) return remembered;
  return findClosestInRow(nextRow.elements, preferredX ?? center(current).x);
}

export function scrollElementIntoOptimalView(element: HTMLElement) {
  window.requestAnimationFrame(() => {
    if (!element.isConnected) return;

    const modalScroll = element.closest<HTMLElement>('.detailsModalScroll');
    if (modalScroll && element.closest('[data-tv-modal-top="true"]')) {
      modalScroll.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    if (element.closest('[data-tv-page-top="true"]')) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    element.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
  });
}

function focusElement(element: HTMLElement, preserveX = false) {
  preservePreferredXDuringFocus = preserveX;
  try {
    element.focus({ preventScroll: true });
    rememberRowFocus(element);
    if (!preserveX) preferredX = center(element).x;
  } finally {
    preservePreferredXDuringFocus = false;
  }
  scrollElementIntoOptimalView(element);
}

function focusInitial() {
  const elements = getFocusableElements();
  const preferred = elements.find((element) => element.matches('.hero-banner__play-button')) ?? elements[0];
  if (preferred) focusElement(preferred);
}

function signalTVMediaInteraction() {
  if (window.DAITIGN_TV?.tvMediaInteractionUnlocked) return;
  window.DAITIGN_TV = { ...window.DAITIGN_TV, tvMediaInteractionUnlocked: true };
  try { window.sessionStorage.setItem('daitign-tv-media-unlocked', 'true'); } catch {}
  if (new URLSearchParams(window.location.search).get('tvDebug') === '1') {
    console.log('[DAITIGN TV Preview] media interaction unlocked by remote');
  }
  // One physical gesture unlocks subsequent previews. Replaying this event on
  // every D-pad move caused redundant YouTube commands and visible TV input lag.
  window.dispatchEvent(new CustomEvent('daitign:tv-media-interaction'));
}

export function activateTVFocusedElement(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active || !isFocusCandidate(active) || !isVisible(active)) return false;
  if (active.tagName === 'SELECT' || active.tagName === 'INPUT') return false;

  signalTVMediaInteraction();
  const menuScope = active.closest<HTMLElement>('[data-tv-focus-scope="menu"]');
  if (menuScope) {
    const route = active.dataset.tvRoute ?? active.getAttribute('href');
    const routeBeforeClick = window.location.pathname;
    // Always invoke the element's genuine React/anchor click handler first.
    active.click();
    if (!route || window.location.pathname !== routeBeforeClick) return true;

    // If a vendor WebView swallowed the anchor activation, ask the owning
    // Browse menu to perform its explicit SPA-route fallback.
    const activation = new CustomEvent('daitign:tv-menu-activate', {
      bubbles: true,
      cancelable: true,
      detail: { element: active },
    });
    menuScope.dispatchEvent(activation);
    return true;
  }

  active.click();
  return true;
}

export function initSpatialNavigation(): () => void {
  if (typeof window === 'undefined' || !isTVMode()) return () => {};

  const initialTimer = window.setTimeout(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || !isFocusCandidate(active) || !isVisible(active)) focusInitial();
  }, 250);

  const handleFocus = (event: FocusEvent) => {
    const target = event.target;
    if (
      !preservePreferredXDuringFocus
      && target instanceof HTMLElement
      && isFocusCandidate(target)
      && isVisible(target)
    ) {
      rememberRowFocus(target);
      preferredX = center(target).x;
    }
  };

  let lastRepeatedNavigationAt = 0;
  const perfDebug = new URLSearchParams(window.location.search).get('tvDebug') === '1';

  const handleKey = (event: KeyboardEvent) => {
    if (!isTVMode()) return;
    if (event.key.startsWith('Arrow')) {
      signalTVMediaInteraction();
    }
    if (event.key === 'Escape' || event.key === 'Backspace') {
      if (event.target instanceof HTMLInputElement && event.key === 'Backspace' && event.target.value) return;
      if (executeTVBack()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (activateTVFocusedElement()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    const directions: Record<string, Direction> = {
      ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up',
    };
    const direction = directions[event.key];
    if (!direction) return;

    if (event.repeat) {
      const now = window.performance.now();
      if (now - lastRepeatedNavigationAt < 75) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      lastRepeatedNavigationAt = now;
    }

    const active = document.activeElement as HTMLElement | null;
    const menuScope = active?.closest<HTMLElement>('[data-tv-focus-scope="menu"]');
    if (menuScope && direction === 'left') {
      event.preventDefault();
      event.stopImmediatePropagation();
      menuScope.dispatchEvent(new CustomEvent('daitign:tv-menu-back', { bubbles: true }));
      return;
    }
    if (active instanceof HTMLInputElement && (direction === 'left' || direction === 'right')) return;
    if (!active || !isFocusCandidate(active) || !isVisible(active)) {
      event.preventDefault();
      focusInitial();
      return;
    }

    const startedAt = window.performance.now();
    const next = findNextSpatialElement(active, direction);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!next) return;
    focusElement(next, direction === 'up' || direction === 'down');
    if (perfDebug) {
      window.requestAnimationFrame(() => {
        console.debug(`[DAITIGN TV Perf] key-to-focus ${Math.round(window.performance.now() - startedAt)}ms`);
      });
    }
  };

  let invalidationFrame = 0;
  const observer = new MutationObserver(() => {
    if (invalidationFrame) return;
    invalidationFrame = window.requestAnimationFrame(() => {
      invalidationFrame = 0;
      invalidateNavigationCache();
    });
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [
      'aria-hidden',
      'data-tv-focusable',
      'data-tv-preview-expanded',
      'data-tv-row',
      'disabled',
      'hidden',
    ],
    childList: true,
    subtree: true,
  });

  document.addEventListener('focusin', handleFocus, true);
  window.addEventListener('keydown', handleKey, true);
  window.DAITIGN_TV = {
    ...window.DAITIGN_TV,
    handleMediaUnlock: () => {
      signalTVMediaInteraction();
      return true;
    },
    handleRemoteKey: (key) => key === 'OK' && activateTVFocusedElement(),
    tvMediaInteractionUnlocked: window.sessionStorage.getItem('daitign-tv-media-unlocked') === 'true',
  };
  return () => {
    window.clearTimeout(initialTimer);
    document.removeEventListener('focusin', handleFocus, true);
    window.removeEventListener('keydown', handleKey, true);
    observer.disconnect();
    window.cancelAnimationFrame(invalidationFrame);
    if (window.DAITIGN_TV) {
      delete window.DAITIGN_TV.handleMediaUnlock;
      delete window.DAITIGN_TV.handleRemoteKey;
    }
    preferredX = null;
    lastFocusedByRow = new WeakMap<HTMLElement, HTMLElement>();
    invalidateNavigationCache();
  };
}
