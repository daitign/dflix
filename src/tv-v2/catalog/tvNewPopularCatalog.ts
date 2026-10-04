import type { MediaItem, MediaRowModel } from '../../features/catalog/types.ts';

export interface TvNewPopularCatalogData {
  hero: MediaItem;
  rows: MediaRowModel[];
  topTen: MediaItem[];
}

async function getTmdb() {
  try {
    const [clientMod, adaptersMod] = await Promise.all([
      import('../../lib/tmdb/client'),
      import('../../lib/tmdb/adapters'),
    ]);
    return {
      normalizeTmdbMixed: adaptersMod.normalizeTmdbMixed,
      normalizeTmdbMovie: adaptersMod.normalizeTmdbMovie,
      normalizeTmdbTv: adaptersMod.normalizeTmdbTv,
      tmdbClient: clientMod.tmdbClient,
    };
  } catch {
    return null;
  }
}

function uniqueValid(items: Array<MediaItem | null>, limit = 20): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

let cachedData: TvNewPopularCatalogData | null = null;
let pendingPromise: Promise<TvNewPopularCatalogData | null> | null = null;

export async function fetchTvNewPopularCatalog(): Promise<TvNewPopularCatalogData | null> {
  if (cachedData) {
    return cachedData;
  }
  if (pendingPromise) {
    return pendingPromise;
  }

  const tmdb = await getTmdb();
  if (!tmdb) {
    return null;
  }

  const { tmdbClient, normalizeTmdbMixed, normalizeTmdbMovie, normalizeTmdbTv } = tmdb;

  const safely = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch {
      return null;
    }
  };

  pendingPromise = (async () => {
    try {
      const [trendingRes, nowPlayingRes, popularMoviesRes, popularTvRes, topRatedRes] =
        await Promise.all([
          safely(tmdbClient.getTrending()),
          safely(tmdbClient.getNowPlayingMovies()),
          safely(tmdbClient.getPopularMovies()),
          safely(tmdbClient.getPopularTv()),
          safely(tmdbClient.getTopRatedMovies()),
        ]);

      const trending = uniqueValid(
        (trendingRes?.results ?? []).map((i: any) => normalizeTmdbMixed(i))
      );
      const newReleases = uniqueValid(
        (nowPlayingRes?.results ?? []).map((i: any) => normalizeTmdbMovie(i))
      );
      const popularMovies = uniqueValid(
        (popularMoviesRes?.results ?? []).map((i: any) => normalizeTmdbMovie(i))
      );
      const popularShows = uniqueValid(
        (popularTvRes?.results ?? []).map((i: any) => normalizeTmdbTv(i))
      );
      const topRated = uniqueValid(
        (topRatedRes?.results ?? []).map((i: any) => normalizeTmdbMovie(i))
      );

      const allItems = [...trending, ...newReleases, ...popularMovies, ...popularShows];
      const hero =
        allItems.find((i) => i.backdropUrl && i.overview) ||
        allItems[0] ||
        null;

      if (!hero) {
        return null;
      }

      const rows: MediaRowModel[] = [
        {
          emphasis: 'featured' as const,
          id: 'new-trending',
          items: trending,
          title: 'Trending Now',
        },
        {
          id: 'new-releases',
          items: newReleases,
          title: 'New Releases',
        },
        {
          id: 'new-popular-movies',
          items: popularMovies,
          title: 'Popular Movies',
        },
        {
          id: 'new-popular-shows',
          items: popularShows,
          title: 'Popular TV Shows',
        },
      ].filter((r) => r.items.length > 0);

      const data: TvNewPopularCatalogData = {
        hero,
        rows,
        topTen: topRated.slice(0, 10),
      };

      cachedData = data;
      return data;
    } catch {
      return null;
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
}

export function clearNewPopularCatalogCache(): void {
  cachedData = null;
  pendingPromise = null;
}
