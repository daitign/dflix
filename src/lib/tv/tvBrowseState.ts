export interface TvBrowseState {
  focusedCardIndex?: number;
  focusedMediaId?: string;
  focusedRowId?: string;
  route: string;
  rowScrollPositions: Record<string, number>;
  scrollY: number;
  timestamp: number;
}

const STORAGE_KEY = 'daitign_tv_browse_state_v2';
let memoryState: TvBrowseState | null = null;

function routeNow() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function rowId(row: HTMLElement, index: number) {
  return row.dataset.tvRowId || row.closest<HTMLElement>('[data-row-id]')?.dataset.rowId || `row-${index}`;
}

function collectRowScrollPositions() {
  const positions: Record<string, number> = {};
  document.querySelectorAll<HTMLElement>('[data-tv-row-scroll]').forEach((row, index) => {
    positions[rowId(row, index)] = row.scrollLeft;
  });
  return positions;
}

export function saveTvBrowseState(overrides: Partial<TvBrowseState> = {}): TvBrowseState {
  if (typeof window === 'undefined') {
    memoryState = {
      route: '/', rowScrollPositions: {}, scrollY: 0, timestamp: Date.now(), ...overrides,
    };
    return memoryState;
  }

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const row = active?.closest<HTMLElement>('[data-tv-row-scroll], [data-row-id]');
  const cardIndex = active?.dataset.cardIndex ?? active?.closest<HTMLElement>('[data-card-index]')?.dataset.cardIndex;
  const currentRoute = routeNow();
  const next: TvBrowseState = {
    focusedCardIndex: cardIndex === undefined ? undefined : Number(cardIndex),
    focusedMediaId: active?.dataset.mediaId,
    focusedRowId: row ? rowId(row, 0) : undefined,
    route: currentRoute.startsWith('/watch') ? (memoryState?.route ?? '/') : currentRoute,
    rowScrollPositions: collectRowScrollPositions(),
    scrollY: window.scrollY,
    timestamp: Date.now(),
    ...overrides,
  };
  memoryState = next;
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* WebView privacy mode */ }
  return next;
}

export function getTvBrowseState(): TvBrowseState | null {
  if (memoryState) return memoryState;
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    memoryState = stored ? JSON.parse(stored) as TvBrowseState : null;
  } catch {
    memoryState = null;
  }
  return memoryState;
}

export function clearTvBrowseState() {
  memoryState = null;
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* WebView privacy mode */ }
  }
}

function focusSaved(state: TvBrowseState) {
  const escapedId = state.focusedMediaId && CSS.escape(state.focusedMediaId);
  const row = state.focusedRowId
    ? Array.from(document.querySelectorAll<HTMLElement>('[data-tv-row-scroll]'))
      .find((element, index) => rowId(element, index) === state.focusedRowId)
    : null;
  const byMedia = escapedId
    ? (row ?? document).querySelector<HTMLElement>(`[data-tv-focusable="true"][data-media-id="${escapedId}"]`)
    : null;
  const byIndex = state.focusedCardIndex === undefined
    ? null
    : row?.querySelector<HTMLElement>(`[data-tv-focusable="true"][data-card-index="${state.focusedCardIndex}"]`);
  (byMedia ?? byIndex)?.focus({ preventScroll: true });
}

export function restoreTvBrowseState(): boolean {
  const state = getTvBrowseState();
  if (!state || typeof window === 'undefined') return false;

  if (!routeNow().startsWith('/watch') && routeNow() !== state.route) {
    window.history.replaceState({}, '', state.route);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }

  const apply = () => {
    window.scrollTo({ behavior: 'instant', top: state.scrollY });
    document.querySelectorAll<HTMLElement>('[data-tv-row-scroll]').forEach((row, index) => {
      const saved = state.rowScrollPositions[rowId(row, index)];
      if (saved !== undefined) row.scrollLeft = saved;
    });
    focusSaved(state);
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
  return true;
}
