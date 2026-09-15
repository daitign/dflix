/**
 * Centralized TV Browse State Store
 * Preserves scroll position, active row, horizontal carousel offset, and focused card
 * across playback transitions so return-from-playback is completely instantaneous.
 */

export interface TvBrowseState {
  route: string;
  scrollY: number;
  activeRowId?: string;
  rowScrollLeft?: number;
  focusedMediaId?: string | number;
  focusedCardIndex?: number;
  focusedSelector?: string;
  modalState?: {
    isOpen: boolean;
    mediaId?: string | number;
    season?: number;
    episode?: number;
  };
  timestamp: number;
}

let inMemoryBrowseState: TvBrowseState | null = null;
const STORAGE_KEY = 'daitign_tv_browse_state';

/**
 * Saves current browse dashboard state before entering TV player.
 */
export function saveTvBrowseState(custom?: Partial<TvBrowseState>): TvBrowseState {
  if (typeof window === 'undefined') {
    const fallback: TvBrowseState = {
      route: '/',
      scrollY: 0,
      timestamp: Date.now(),
      ...custom,
    };
    inMemoryBrowseState = fallback;
    return fallback;
  }

  const currentRoute = window.location.pathname + window.location.search;
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

  const activeEl = document.activeElement as HTMLElement | null;
  let focusedMediaId: string | number | undefined;
  let focusedCardIndex: number | undefined;
  let focusedSelector: string | undefined;
  let activeRowId: string | undefined;
  let rowScrollLeft: number | undefined;

  if (activeEl && activeEl !== document.body && activeEl !== document.documentElement) {
    const card = activeEl.closest<HTMLElement>('.media-card, .ranked-card, .continue-card, [data-media-id]');
    if (card) {
      focusedMediaId = card.getAttribute('data-media-id') || activeEl.getAttribute('data-media-id') || undefined;
      const indexAttr = card.getAttribute('data-card-index') || activeEl.getAttribute('data-card-index');
      if (indexAttr) {
        focusedCardIndex = Number.parseInt(indexAttr, 10);
      }
    }

    const row = activeEl.closest<HTMLElement>('.media-row, .carousel-shell, [data-row-id]');
    if (row) {
      activeRowId = row.getAttribute('data-row-id') || row.id || undefined;
      const track = row.querySelector<HTMLElement>('.carousel-shell__track, [role="region"]') || activeEl.closest<HTMLElement>('.carousel-shell__track');
      if (track) {
        rowScrollLeft = track.scrollLeft;
      }
    }

    if (!focusedMediaId && activeEl.id) {
      focusedSelector = `#${activeEl.id}`;
    }
  }

  const state: TvBrowseState = {
    route: currentRoute.startsWith('/watch') ? (inMemoryBrowseState?.route || '/') : currentRoute,
    scrollY,
    activeRowId,
    rowScrollLeft,
    focusedMediaId,
    focusedCardIndex,
    focusedSelector,
    timestamp: Date.now(),
    ...custom,
  };

  inMemoryBrowseState = state;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // SessionStorage may fail in restricted/sandboxed environments
  }

  return state;
}

/**
 * Retrieves the currently saved browse state from memory or sessionStorage.
 */
export function getTvBrowseState(): TvBrowseState | null {
  if (inMemoryBrowseState) return inMemoryBrowseState;
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        inMemoryBrowseState = JSON.parse(stored);
        return inMemoryBrowseState;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Clears the saved browse state.
 */
export function clearTvBrowseState(): void {
  inMemoryBrowseState = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Restores route, scroll offset, and card focus from the saved browse state.
 */
export function restoreTvBrowseState(): boolean {
  const state = getTvBrowseState();
  if (!state || typeof window === 'undefined') return false;

  // 1. Restore route if needed
  const currentRoute = window.location.pathname + window.location.search;
  if (state.route && state.route !== currentRoute && !state.route.startsWith('/watch')) {
    window.history.replaceState({}, '', state.route);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }

  // 2. Perform element & scroll restoration across layout passes
  const applyRestoration = () => {
    // Vertical scroll position
    if (typeof state.scrollY === 'number') {
      window.scrollTo({ top: state.scrollY, behavior: 'instant' });
    }

    // Horizontal track position
    if (state.activeRowId && typeof state.rowScrollLeft === 'number') {
      const row = document.querySelector<HTMLElement>(`[data-row-id="${state.activeRowId}"], #${state.activeRowId}`);
      const track = row?.querySelector<HTMLElement>('.carousel-shell__track, [role="region"]');
      if (track) {
        track.scrollLeft = state.rowScrollLeft;
      }
    }

    // Focused card restoration
    let targetToFocus: HTMLElement | null = null;
    if (state.focusedMediaId) {
      targetToFocus = document.querySelector<HTMLElement>(
        `[data-media-id="${state.focusedMediaId}"] .media-card__surface, ` +
        `[data-media-id="${state.focusedMediaId}"] .ranked-card__poster-anchor, ` +
        `[data-media-id="${state.focusedMediaId}"] .continue-card__surface, ` +
        `button[data-media-id="${state.focusedMediaId}"], ` +
        `[data-media-id="${state.focusedMediaId}"]`
      );
    }

    if (!targetToFocus && state.focusedSelector) {
      targetToFocus = document.querySelector<HTMLElement>(state.focusedSelector);
    }

    if (targetToFocus && typeof targetToFocus.focus === 'function') {
      targetToFocus.focus();
    }
  };

  // Run immediately and queue for next frame
  applyRestoration();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(applyRestoration);
  }
  setTimeout(applyRestoration, 100);

  return true;
}
