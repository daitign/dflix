import { executeTVBack, isTVMode } from './tvDetection.ts';

export const TV_FOCUSABLE_SELECTOR = '[data-tv-focusable="true"]:not([disabled]):not([aria-hidden="true"])';

type Direction = 'down' | 'left' | 'right' | 'up';

interface FocusRow {
  elements: HTMLElement[];
  centerY: number;
}

let preferredX: number | null = null;
let cachedScope: HTMLElement | null = null;
let cachedElements: HTMLElement[] | null = null;
let cachedRows: FocusRow[] | null = null;

function invalidateNavigationCache() {
  cachedScope = null;
  cachedElements = null;
  cachedRows = null;
}

export function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
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
    const current = cachedElements.filter((element) => element.isConnected && isVisible(element));
    if (current.length === cachedElements.length) return current;
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

function rowsFor(elements: HTMLElement[]): FocusRow[] {
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
    centerY: rowElements.reduce((sum, item) => sum + center(item).y, 0) / rowElements.length,
    elements: rowElements.sort((a, b) => center(a).x - center(b).x),
  }));

  loose.sort((a, b) => center(a).y - center(b).y || center(a).x - center(b).x);
  loose.forEach((element) => {
    const point = center(element);
    const row = rows.find((candidate) => Math.abs(candidate.centerY - point.y) <= 28);
    if (row) {
      row.elements.push(element);
      row.elements.sort((a, b) => center(a).x - center(b).x);
      row.centerY = row.elements.reduce((sum, item) => sum + center(item).y, 0) / row.elements.length;
    } else {
      rows.push({ centerY: point.y, elements: [element] });
    }
  });

  return rows.sort((a, b) => a.centerY - b.centerY);
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
  return findClosestInRow(nextRow.elements, preferredX ?? center(current).x);
}

export function scrollElementIntoOptimalView(element: HTMLElement) {
  window.requestAnimationFrame(() => {
    if (element.isConnected) element.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
  });
}

function focusElement(element: HTMLElement, preserveX = false) {
  element.focus({ preventScroll: true });
  if (!preserveX) preferredX = center(element).x;
  scrollElementIntoOptimalView(element);
}

function focusInitial() {
  const elements = getFocusableElements();
  const preferred = elements.find((element) => element.matches('.hero-banner__play-button')) ?? elements[0];
  if (preferred) focusElement(preferred);
}

export function initSpatialNavigation(): () => void {
  if (typeof window === 'undefined' || !isTVMode()) return () => {};

  const initialTimer = window.setTimeout(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || !isFocusCandidate(active) || !isVisible(active)) focusInitial();
  }, 250);

  const handleFocus = (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && isFocusCandidate(target) && isVisible(target)) preferredX = center(target).x;
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!isTVMode()) return;
    if (event.key === 'Escape' || event.key === 'Backspace') {
      if (event.target instanceof HTMLInputElement && event.key === 'Backspace' && event.target.value) return;
      if (executeTVBack()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && document.activeElement instanceof HTMLElement) {
      const active = document.activeElement;
      if (isFocusCandidate(active) && isVisible(active) && active.tagName !== 'SELECT' && active.tagName !== 'INPUT') {
        event.preventDefault();
        event.stopImmediatePropagation();
        active.click();
      }
      return;
    }

    const directions: Record<string, Direction> = {
      ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up',
    };
    const direction = directions[event.key];
    if (!direction) return;

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
    window.requestAnimationFrame(() => {
      console.debug(`[DAITIGN TV Perf] key-to-focus ${Math.round(window.performance.now() - startedAt)}ms`);
    });
  };

  const observer = new MutationObserver(invalidateNavigationCache);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden', 'data-tv-focusable', 'disabled', 'hidden', 'style'],
    childList: true,
    subtree: true,
  });

  document.addEventListener('focusin', handleFocus, true);
  window.addEventListener('keydown', handleKey, true);
  return () => {
    window.clearTimeout(initialTimer);
    document.removeEventListener('focusin', handleFocus, true);
    window.removeEventListener('keydown', handleKey, true);
    observer.disconnect();
    preferredX = null;
    invalidateNavigationCache();
  };
}
