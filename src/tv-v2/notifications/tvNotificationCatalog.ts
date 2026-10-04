import type { MediaItem } from '../../features/catalog/types.ts';

export interface TvNotificationItem {
  id: string;
  item?: MediaItem;
  message: string;
  thumbnailUrl?: string | null;
  time: string;
  title: string;
}

const STORAGE_KEY = 'daitign_tv_read_notifications';
let memoryReadSet = new Set<string>();

function getReadSet(): Set<string> {
  if (typeof window === 'undefined') return memoryReadSet;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : memoryReadSet;
  } catch {
    return memoryReadSet;
  }
}

function saveReadSet(set: Set<string>): void {
  memoryReadSet = set;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

async function getTmdb() {
  try {
    const [clientMod, adaptersMod] = await Promise.all([
      import('../../lib/tmdb/client'),
      import('../../lib/tmdb/adapters'),
    ]);
    return {
      normalizeTmdbMixed: adaptersMod.normalizeTmdbMixed,
      tmdbClient: clientMod.tmdbClient,
    };
  } catch {
    return null;
  }
}

let cachedNotifications: TvNotificationItem[] | null = null;
let pendingPromise: Promise<TvNotificationItem[]> | null = null;

export async function fetchTvNotifications(): Promise<TvNotificationItem[]> {
  if (cachedNotifications) {
    return cachedNotifications;
  }
  if (pendingPromise) {
    return pendingPromise;
  }

  const tmdb = await getTmdb();
  if (!tmdb) {
    return [];
  }

  const { tmdbClient, normalizeTmdbMixed } = tmdb;

  const safely = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch {
      return null;
    }
  };

  pendingPromise = (async () => {
    try {
      const [nowPlayingRes, airingTodayRes, trendingRes] = await Promise.all([
        safely(tmdbClient.getNowPlayingMovies()),
        safely(tmdbClient.getAiringTodayTv()),
        safely(tmdbClient.getTrending()),
      ]);

      const items: TvNotificationItem[] = [];

      if (nowPlayingRes?.results?.length) {
        const item = normalizeTmdbMixed(nowPlayingRes.results[0]);
        if (item) {
          items.push({
            id: `notif-movie-${item.id}`,
            item,
            message: `${item.title} is now streaming in cinema 4K audio & video.`,
            thumbnailUrl: item.backdropUrl ?? item.posterUrl,
            time: '2 hours ago',
            title: 'New Arrival',
          });
        }
      }

      if (airingTodayRes?.results?.length) {
        const item = normalizeTmdbMixed(airingTodayRes.results[0]);
        if (item) {
          items.push({
            id: `notif-tv-${item.id}`,
            item,
            message: `A brand-new episode of ${item.title} just dropped.`,
            thumbnailUrl: item.backdropUrl ?? item.posterUrl,
            time: '5 hours ago',
            title: 'New Episode Available',
          });
        }
      }

      if (trendingRes?.results?.length) {
        const candidate = normalizeTmdbMixed(trendingRes.results[0]);
        if (candidate) {
          items.push({
            id: `notif-trending-${candidate.id}`,
            item: candidate,
            message: `${candidate.title} is currently trending in Top 10 recommendations.`,
            thumbnailUrl: candidate.backdropUrl ?? candidate.posterUrl,
            time: '1 day ago',
            title: 'Trending Now',
          });
        }
      }

      cachedNotifications = items;
      return items;
    } catch {
      return [];
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
}

export function getUnreadNotificationCount(notifications: TvNotificationItem[]): number {
  const readSet = getReadSet();
  return notifications.filter((n) => !readSet.has(n.id)).length;
}

export function markNotificationAsRead(id: string): void {
  const readSet = getReadSet();
  readSet.add(id);
  saveReadSet(readSet);
}

export function markAllNotificationsAsRead(notifications: TvNotificationItem[]): void {
  const readSet = getReadSet();
  notifications.forEach((n) => readSet.add(n.id));
  saveReadSet(readSet);
}

export function clearTvNotificationCache(): void {
  cachedNotifications = null;
  pendingPromise = null;
  memoryReadSet = new Set();
}
