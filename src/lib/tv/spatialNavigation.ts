import { executeTVBack, isTVMode, isTvWatchMode } from './tvDetection.ts';

export const TV_FOCUSABLE_SELECTOR = '[data-tv-focusable="true"]:not([disabled]):not([aria-hidden="true"])';

const EXCLUDED_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'SECTION', 'ARTICLE']);

export function isFocusCandidate(el: HTMLElement): boolean {
  if (EXCLUDED_TAGS.has(el.tagName)) return false;
  if (el.getAttribute('role') === 'heading') return false;
  if (
    el.matches(
      '.section-header, .section-header__title, .section-header__explore, .media-row, .carousel-shell, .carousel-shell__track, .carousel-shell__item, .carousel-shell__viewport, .netflix-badge'
    )
  ) {
    return false;
  }
  return true;
}

export function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function getActiveScope(): HTMLElement {
  // If a modal/dialog is open, trap focus inside it
  const modal = document.querySelector<HTMLElement>(
    '.modal-shell__panel, .modal-shell, .details-modal-overlay, [role="dialog"], .details-modal'
  );
  if (modal && isVisible(modal)) {
    return modal;
  }
  return document.body;
}

export function getFocusableElements(scope: HTMLElement = getActiveScope()): HTMLElement[] {
  const elements = Array.from(scope.querySelectorAll<HTMLElement>(TV_FOCUSABLE_SELECTOR));
  return elements.filter((el) => isFocusCandidate(el) && isVisible(el));
}

export function getElementCenter(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Automatically scrolls carousel track horizontally and window vertically to ensure
 * focused element and its row heading are visible comfortably without violent jumps.
 */
export function scrollElementIntoOptimalView(el: HTMLElement) {
  const modalScroll = el.closest<HTMLElement>('.detailsModalScroll, .modal-shell__body');
  if (modalScroll) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    return;
  }

  // If focused on Hero Banner, Category Header, or Top Navigation, smoothly scroll page to top
  if (el.closest('.hero-banner, .navigation-shell, .category-header')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // 1. Horizontal track scrolling: smoothly scroll track if focused card reaches margins
  const track = el.closest<HTMLElement>('.carousel-shell__track');
  if (track) {
    const trackRect = track.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const margin = 48; // comfortable horizontal margin

    if (elRect.left < trackRect.left + margin) {
      const scrollNeeded = elRect.left - (trackRect.left + margin);
      track.scrollBy({ left: scrollNeeded, behavior: 'smooth' });
    } else if (elRect.right > trackRect.right - margin) {
      const scrollNeeded = elRect.right - (trackRect.right - margin);
      track.scrollBy({ left: scrollNeeded, behavior: 'smooth' });
    }
  }

  // 2. Vertical page scrolling: ensure row heading + card are visible with comfortable margins
  const mediaRow = el.closest<HTMLElement>('.media-row');
  const targetElement = mediaRow || el;
  const targetRect = targetElement.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const topNavOffset = 80; // height of top navigation + padding
  const bottomMargin = 40;

  if (targetRect.top < topNavOffset) {
    const scrollNeeded = targetRect.top - topNavOffset;
    window.scrollBy({ top: scrollNeeded, behavior: 'smooth' });
  } else if (elRect.bottom > vh - bottomMargin) {
    const scrollNeeded = elRect.bottom - (vh - bottomMargin);
    window.scrollBy({ top: scrollNeeded, behavior: 'smooth' });
  }
}

/**
 * Finds the candidate element in a list closest to a target X coordinate
 */
export function findClosestInRow(elements: HTMLElement[], targetX: number): HTMLElement | null {
  if (elements.length === 0) return null;
  let bestEl: HTMLElement | null = null;
  let minDiff = Number.POSITIVE_INFINITY;

  for (const el of elements) {
    const center = getElementCenter(el);
    const diff = Math.abs(center.x - targetX);
    if (diff < minDiff) {
      minDiff = diff;
      bestEl = el;
    }
  }

  return bestEl;
}

/**
 * Handles directional navigation between carousel rows while preserving horizontal coordinate.
 * Completely skips row headings and non-interactive text.
 */
export function navigateBetweenRows(
  currentEl: HTMLElement,
  direction: 'up' | 'down'
): HTMLElement | null {
  const currentCenter = getElementCenter(currentEl);
  const currentRow = currentEl.closest<HTMLElement>('.media-row');

  // If inside a row
  if (currentRow) {
    const allRows = Array.from(document.querySelectorAll<HTMLElement>('.media-row')).filter((r) => isVisible(r));
    const currentRowIndex = allRows.indexOf(currentRow);
    if (currentRowIndex === -1) return null;

    const targetRowIndex = direction === 'down' ? currentRowIndex + 1 : currentRowIndex - 1;

    if (targetRowIndex >= 0 && targetRowIndex < allRows.length) {
      const targetRow = allRows[targetRowIndex];
      const candidateCards = getFocusableElements(targetRow);
      const closest = findClosestInRow(candidateCards, currentCenter.x);
      if (closest) return closest;
    }

    // Moving UP from Row 0: jump to Hero banner or Category header or Top Navigation
    if (direction === 'up' && targetRowIndex < 0) {
      const heroBanner = document.querySelector<HTMLElement>('.hero-banner');
      if (heroBanner && isVisible(heroBanner)) {
        const heroControls = getFocusableElements(heroBanner);
        if (heroControls.length > 0) {
          return findClosestInRow(heroControls, currentCenter.x) || heroControls[0];
        }
      }

      const catHeader = document.querySelector<HTMLElement>('.category-header');
      if (catHeader && isVisible(catHeader)) {
        const catControls = getFocusableElements(catHeader);
        if (catControls.length > 0) {
          return findClosestInRow(catControls, currentCenter.x) || catControls[0];
        }
      }

      const navShell = document.querySelector<HTMLElement>('.navigation-shell');
      if (navShell && isVisible(navShell)) {
        const navControls = getFocusableElements(navShell);
        if (navControls.length > 0) {
          return findClosestInRow(navControls, currentCenter.x) || navControls[0];
        }
      }
    }
  }

  return null;
}

/**
 * Handles horizontal movement within a carousel row
 */
export function navigateWithinRow(
  currentEl: HTMLElement,
  direction: 'left' | 'right'
): HTMLElement | null {
  const track = currentEl.closest<HTMLElement>('.carousel-shell__track');
  if (!track) return null;

  const cardsInTrack = getFocusableElements(track);
  const currentIndex = cardsInTrack.indexOf(currentEl);
  if (currentIndex === -1) return null;

  const nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;
  if (nextIndex >= 0 && nextIndex < cardsInTrack.length) {
    return cardsInTrack[nextIndex];
  }

  return null;
}

/**
 * Universal 2D geometric spatial navigation algorithm
 */
export function findNextSpatialElement(
  currentEl: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right'
): HTMLElement | null {
  const current = getElementCenter(currentEl);

  // 1. Check specialized row navigation first
  if (direction === 'left' || direction === 'right') {
    const rowNext = navigateWithinRow(currentEl, direction);
    if (rowNext) return rowNext;
  } else if (direction === 'up' || direction === 'down') {
    const rowNext = navigateBetweenRows(currentEl, direction);
    if (rowNext) return rowNext;
  }

  // 2. Specialized transitions: NavigationShell -> Hero / CategoryHeader / Row 0
  if (currentEl.closest('.navigation-shell') && direction === 'down') {
    const heroBanner = document.querySelector<HTMLElement>('.hero-banner');
    if (heroBanner && isVisible(heroBanner)) {
      const heroControls = getFocusableElements(heroBanner);
      if (heroControls.length > 0) {
        return findClosestInRow(heroControls, current.x) || heroControls[0];
      }
    }

    const catHeader = document.querySelector<HTMLElement>('.category-header');
    if (catHeader && isVisible(catHeader)) {
      const catControls = getFocusableElements(catHeader);
      if (catControls.length > 0) {
        return findClosestInRow(catControls, current.x) || catControls[0];
      }
    }

    const allRows = Array.from(document.querySelectorAll<HTMLElement>('.media-row')).filter((r) => isVisible(r));
    if (allRows.length > 0) {
      const topRow = allRows[0];
      const candidates = getFocusableElements(topRow);
      const closest = findClosestInRow(candidates, current.x);
      if (closest) return closest;
    }
  }

  // 3. Specialized transitions: HeroBanner -> NavigationShell / Row 0
  if (currentEl.closest('.hero-banner')) {
    if (direction === 'up') {
      const navShell = document.querySelector<HTMLElement>('.navigation-shell');
      if (navShell && isVisible(navShell)) {
        const navControls = getFocusableElements(navShell);
        if (navControls.length > 0) {
          return findClosestInRow(navControls, current.x) || navControls[0];
        }
      }
    } else if (direction === 'down') {
      const allRows = Array.from(document.querySelectorAll<HTMLElement>('.media-row')).filter((r) => isVisible(r));
      if (allRows.length > 0) {
        const topRow = allRows[0];
        const candidates = getFocusableElements(topRow);
        const closest = findClosestInRow(candidates, current.x);
        if (closest) return closest;
      }
    }
  }

  // 4. Specialized transitions: CategoryHeader -> NavigationShell / Row 0
  if (currentEl.closest('.category-header')) {
    if (direction === 'up') {
      const navShell = document.querySelector<HTMLElement>('.navigation-shell');
      if (navShell && isVisible(navShell)) {
        const navControls = getFocusableElements(navShell);
        if (navControls.length > 0) {
          return findClosestInRow(navControls, current.x) || navControls[0];
        }
      }
    } else if (direction === 'down') {
      const allRows = Array.from(document.querySelectorAll<HTMLElement>('.media-row')).filter((r) => isVisible(r));
      if (allRows.length > 0) {
        const topRow = allRows[0];
        const candidates = getFocusableElements(topRow);
        const closest = findClosestInRow(candidates, current.x);
        if (closest) return closest;
      }
    }
  }

  // 5. General 2D geometric navigation fallback (for Modals, Grids, etc.)
  const scope = getActiveScope();
  const candidates = getFocusableElements(scope).filter((el) => el !== currentEl);

  let bestCandidate: HTMLElement | null = null;
  let lowestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const cand = getElementCenter(candidate);
    const dx = cand.x - current.x;
    const dy = cand.y - current.y;

    let isEligible = false;
    let primaryDist = 0;
    let secondaryDist = 0;

    switch (direction) {
      case 'left':
        isEligible = cand.right <= current.left + 10;
        primaryDist = -dx;
        secondaryDist = Math.abs(dy);
        break;
      case 'right':
        isEligible = cand.left >= current.right - 10;
        primaryDist = dx;
        secondaryDist = Math.abs(dy);
        break;
      case 'up':
        isEligible = cand.bottom <= current.top + 10;
        primaryDist = -dy;
        secondaryDist = Math.abs(dx);
        break;
      case 'down':
        isEligible = cand.top >= current.bottom - 10;
        primaryDist = dy;
        secondaryDist = Math.abs(dx);
        break;
    }

    if (!isEligible || primaryDist < 0) continue;

    // Weight primary direction more heavily, penalize orthogonal distance
    const score = primaryDist * 1.2 + secondaryDist * 2.5;

    if (score < lowestScore) {
      lowestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

/**
 * Initializes spatial navigation listeners for TV mode
 */
export function initSpatialNavigation(): () => void {
  if (typeof window === 'undefined') return () => {};

  let isInitialized = false;

  // Initial focus on startup if nothing is active
  const initialFocusTimer = window.setTimeout(() => {
    if (!document.activeElement || document.activeElement === document.body) {
      const candidates = getFocusableElements();
      if (candidates.length > 0) {
        const heroPlay = candidates.find((c) => c.classList.contains('hero-banner__play-button'));
        (heroPlay || candidates[0]).focus();
      }
    }
  }, 350);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isTVMode()) return;

    // Handle Back / Escape keys
    if (event.key === 'Escape' || event.key === 'Backspace') {
      const activeEl = document.activeElement;
      // If typing inside an input and user presses back, allow default if input has value
      if (activeEl instanceof HTMLInputElement && activeEl.value.length > 0 && event.key === 'Backspace') {
        return;
      }

      if (executeTVBack()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const currentEl = document.activeElement as HTMLElement | null;

    // TV PLAYER FOCUS MODE:
    // When watching on TV or focused on the player iframe, do NOT intercept D-pad
    // navigation or Enter/Space so all controls and events belong to the player!
    if (isTvWatchMode() || currentEl?.closest('.vidstuck-frame') || currentEl instanceof HTMLIFrameElement) {
      return;
    }

    const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const direction = directionMap[event.key];
    if (!direction) return;

    // If nothing currently focused or focus is lost/detached, focus best eligible element
    if (!currentEl || currentEl === document.body || !currentEl.isConnected || !isVisible(currentEl)) {
      const candidates = getFocusableElements();
      if (candidates.length > 0) {
        const heroPlay = candidates.find((c) => c.classList.contains('hero-banner__play-button'));
        const target = heroPlay || candidates[0];
        target.focus();
        scrollElementIntoOptimalView(target);
        event.preventDefault();
      }
      return;
    }

    // Inside input field: allow left/right cursor movement
    if (currentEl instanceof HTMLInputElement && (direction === 'left' || direction === 'right')) {
      return;
    }

    const nextEl = findNextSpatialElement(currentEl, direction);
    if (nextEl) {
      event.preventDefault();
      nextEl.focus();
      scrollElementIntoOptimalView(nextEl);
    }
  };

  window.addEventListener('keydown', handleKeyDown, { capture: true });
  isInitialized = true;

  return () => {
    window.clearTimeout(initialFocusTimer);
    if (isInitialized) {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }
  };
}
