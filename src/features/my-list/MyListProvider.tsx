import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MediaItem, MediaType } from '../catalog/types';
import type { MediaPreviewData } from '../hover-preview/types';

export const MY_LIST_STORAGE_KEY = 'daitign-my-list';

export interface MyListItem {
  tmdbId: number;
  playbackType: 'movie' | 'tv';
  catalogCategory?: MediaType;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  year?: number;
  addedAt: string;
  overview?: string;
  genres?: string[];
  maturityRating?: string;
}

export type MyListCandidate =
  | MediaItem
  | MediaPreviewData
  | MyListItem
  | {
      id?: number | string;
      tmdbId?: number;
      title: string;
      playbackType?: 'movie' | 'tv';
      type?: MediaType;
      posterUrl?: string;
      backdropUrl?: string;
      year?: number;
      overview?: string;
      genres?: string[];
      maturityRating?: string;
    };

interface MyListContextValue {
  items: MyListItem[];
  isInList: (tmdbId?: number | string | null) => boolean;
  toggleItem: (media: MyListCandidate) => boolean; // returns next state (true if added, false if removed)
  addItem: (media: MyListCandidate) => void;
  removeItem: (tmdbId: number) => void;
}

const MyListContext = createContext<MyListContextValue | null>(null);

function extractTmdbId(candidate: MyListCandidate): number {
  if ('tmdbId' in candidate && typeof candidate.tmdbId === 'number' && candidate.tmdbId > 0) {
    return candidate.tmdbId;
  }
  if ('id' in candidate && typeof candidate.id === 'number' && candidate.id > 0) {
    return candidate.id;
  }
  if ('id' in candidate && typeof candidate.id === 'string' && /^\d+$/.test(candidate.id)) {
    return Number(candidate.id);
  }
  return 0;
}

function normalizeCandidate(candidate: MyListCandidate): MyListItem | null {
  const tmdbId = extractTmdbId(candidate);
  if (!tmdbId || !candidate.title) return null;

  const playbackType: 'movie' | 'tv' =
    candidate.playbackType ?? ('type' in candidate && candidate.type === 'movie' ? 'movie' : 'tv');

  const catalogCategory: MediaType =
    ('catalogCategory' in candidate && candidate.catalogCategory)
      ? candidate.catalogCategory
      : ('type' in candidate && candidate.type ? candidate.type : playbackType);

  const posterUrl = 'posterUrl' in candidate ? candidate.posterUrl : undefined;
  const backdropUrl = 'backdropUrl' in candidate
    ? candidate.backdropUrl
    : ('artworkUrl' in candidate ? candidate.artworkUrl : undefined);
  const overview = 'overview' in candidate ? candidate.overview : undefined;

  return {
    tmdbId,
    playbackType,
    catalogCategory,
    title: candidate.title,
    posterUrl,
    backdropUrl,
    year: candidate.year,
    addedAt: 'addedAt' in candidate && candidate.addedAt ? candidate.addedAt : new Date().toISOString(),
    overview,
    genres: candidate.genres,
    maturityRating: candidate.maturityRating,
  };
}

function loadInitialList(): MyListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MY_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is MyListItem => Boolean(item && item.tmdbId && item.title));
    }
  } catch {
    // Gracefully handle storage errors
  }
  return [];
}

export function MyListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MyListItem[]>(loadInitialList);

  useEffect(() => {
    try {
      window.localStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore write errors (e.g. storage full or restricted)
    }
  }, [items]);

  // Sync if another tab modifies storage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MY_LIST_STORAGE_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated)) setItems(updated);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isInList = useCallback(
    (id?: number | string | null) => {
      if (!id) return false;
      const numId = typeof id === 'string' ? Number(id) : id;
      if (!numId || Number.isNaN(numId)) return false;
      return items.some((item) => item.tmdbId === numId);
    },
    [items],
  );

  const addItem = useCallback((media: MyListCandidate) => {
    const normalized = normalizeCandidate(media);
    if (!normalized) return;
    setItems((prev) => {
      if (prev.some((item) => item.tmdbId === normalized.tmdbId)) return prev;
      return [normalized, ...prev];
    });
  }, []);

  const removeItem = useCallback((tmdbId: number) => {
    setItems((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
  }, []);

  const toggleItem = useCallback(
    (media: MyListCandidate): boolean => {
      const id = extractTmdbId(media);
      if (!id) return false;
      const exists = items.some((item) => item.tmdbId === id);
      if (exists) {
        removeItem(id);
        return false;
      } else {
        addItem(media);
        return true;
      }
    },
    [items, addItem, removeItem],
  );

  const value = useMemo(
    () => ({
      items,
      isInList,
      toggleItem,
      addItem,
      removeItem,
    }),
    [items, isInList, toggleItem, addItem, removeItem],
  );

  return <MyListContext.Provider value={value}>{children}</MyListContext.Provider>;
}

export function useMyList() {
  const ctx = useContext(MyListContext);
  if (!ctx) {
    throw new Error('useMyList must be used within a MyListProvider');
  }
  return ctx;
}

export function myListItemToMediaItem(item: MyListItem): MediaItem {
  return {
    id: item.tmdbId,
    tmdbId: item.tmdbId,
    type: item.catalogCategory ?? item.playbackType,
    title: item.title,
    posterUrl: item.posterUrl,
    backdropUrl: item.backdropUrl,
    year: item.year,
    overview: item.overview,
    genres: item.genres,
    maturityRating: item.maturityRating,
    playbackType: item.playbackType,
    catalogCategory: item.catalogCategory,
  };
}
