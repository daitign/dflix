import { getFreshnessBadge } from '../../features/catalog/freshness.ts';
import type { MediaItem, MediaRowModel } from '../../features/catalog/types.ts';

let customTmdbModules: {
  normalizeTmdbMovie: (item: any) => MediaItem | null;
  normalizeTmdbTv: (item: any, details?: any, category?: any) => MediaItem | null;
  tmdbClient: any;
} | null = null;

export function setTmdbModulesForTesting(modules: typeof customTmdbModules): void {
  customTmdbModules = modules;
}

async function getTmdbModules() {
  if (customTmdbModules) return customTmdbModules;
  try {
    const [clientMod, adaptersMod] = await Promise.all([
      import('../../lib/tmdb/client'),
      import('../../lib/tmdb/adapters'),
    ]);
    return {
      normalizeTmdbMovie: adaptersMod.normalizeTmdbMovie,
      normalizeTmdbTv: adaptersMod.normalizeTmdbTv,
      tmdbClient: clientMod.tmdbClient,
    };
  } catch (err) {
    return null;
  }
}

export interface TvGenreItem {
  id: string;
  languageCode?: string;
  name: string;
  tmdbGenreId?: number;
}

// Exactly mirrors MOVIE_GENRES from MoviesPage.tsx with Western (37) included
export const TV_V2_MOVIE_GENRES: TvGenreItem[] = [
  { id: 'all', name: 'All Movies' },
  { id: 'action', name: 'Action', tmdbGenreId: 28 },
  { id: 'adventure', name: 'Adventure', tmdbGenreId: 12 },
  { id: 'animation', name: 'Animation & Anime', tmdbGenreId: 16 },
  { id: 'comedy', name: 'Comedies', tmdbGenreId: 35 },
  { id: 'crime', name: 'Crime', tmdbGenreId: 80 },
  { id: 'documentary', name: 'Documentaries', tmdbGenreId: 99 },
  { id: 'drama', name: 'Dramas', tmdbGenreId: 18 },
  { id: 'family', name: 'Family & Kids', tmdbGenreId: 10751 },
  { id: 'fantasy', name: 'Fantasy', tmdbGenreId: 14 },
  { id: 'history', name: 'Historical', tmdbGenreId: 36 },
  { id: 'horror', name: 'Horror', tmdbGenreId: 27 },
  { id: 'music', name: 'Music & Musicals', tmdbGenreId: 10402 },
  { id: 'mystery', name: 'Mystery', tmdbGenreId: 9648 },
  { id: 'romance', name: 'Romantic Movies', tmdbGenreId: 10749 },
  { id: 'scifi', name: 'Sci-Fi & Fantasy', tmdbGenreId: 878 },
  { id: 'thriller', name: 'Thrillers', tmdbGenreId: 53 },
  { id: 'war', name: 'War', tmdbGenreId: 10752 },
  { id: 'western', name: 'Western', tmdbGenreId: 37 },
];

// Exactly mirrors TV_GENRES from ShowsPage.tsx with News, Talk, Western included
export const TV_V2_TV_GENRES: TvGenreItem[] = [
  { id: 'all', name: 'All TV Shows' },
  { id: 'action-adventure', name: 'Action & Adventure', tmdbGenreId: 10759 },
  { id: 'anime', name: 'Anime Series', tmdbGenreId: 16 },
  { id: 'comedy', name: 'Comedies', tmdbGenreId: 35 },
  { id: 'crime', name: 'Crime & Thriller', tmdbGenreId: 80 },
  { id: 'documentary', name: 'Documentaries', tmdbGenreId: 99 },
  { id: 'drama', name: 'Drama', tmdbGenreId: 18 },
  { id: 'kids', name: 'Kids & Family', tmdbGenreId: 10762 },
  { id: 'korean', name: 'Korean Series', languageCode: 'ko' },
  { id: 'mystery', name: 'Mystery', tmdbGenreId: 9648 },
  { id: 'news', name: 'News', tmdbGenreId: 10763 },
  { id: 'reality', name: 'Reality TV', tmdbGenreId: 10764 },
  { id: 'scifi-fantasy', name: 'Sci-Fi & Fantasy', tmdbGenreId: 10765 },
  { id: 'soap', name: 'Soap Operas', tmdbGenreId: 10766 },
  { id: 'talk', name: 'Talk', tmdbGenreId: 10767 },
  { id: 'war-politics', name: 'War & Politics', tmdbGenreId: 10768 },
  { id: 'western', name: 'Western', tmdbGenreId: 37 },
];

export interface TvGenreCatalogData {
  hero: MediaItem;
  rows: MediaRowModel[];
  topTen: MediaItem[];
}

function uniqueMovies(
  items: any[],
  normalizeMovie: (item: any) => MediaItem | null,
  limit = 18
): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    const normalized = normalizeMovie(item);
    if (!normalized || !normalized.title || (!normalized.posterUrl && !normalized.backdropUrl)) return;
    unique.set(String(normalized.id), normalized);
  });
  return [...unique.values()].slice(0, limit);
}

function uniqueTv(
  items: any[],
  normalizeTv: (item: any, details?: any, category?: any) => MediaItem | null,
  category: 'tv' | 'anime' = 'tv',
  limit = 18
): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    const normalized = normalizeTv(item, undefined, category);
    if (!normalized || !normalized.title || (!normalized.posterUrl && !normalized.backdropUrl)) return;
    unique.set(String(normalized.id), normalized);
  });
  return [...unique.values()].slice(0, limit);
}

function dedupeMedia(items: MediaItem[], limit = 18): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

function enrichMovie(item: MediaItem, topTenIds: Set<string>): MediaItem {
  const badge = getFreshnessBadge(item);
  return {
    ...item,
    badge,
    inTopTen: topTenIds.has(String(item.id)),
  };
}

function enrichTv(
  item: MediaItem,
  detailsMap: Map<number, any>,
  topTenIds: Set<string>
): MediaItem {
  const details = item.tmdbId ? detailsMap.get(item.tmdbId) : undefined;
  const regularSeasons = details?.seasons?.filter(
    (s: any) => s.season_number > 0 && s.episode_count > 0 && Boolean(s.air_date)
  );
  const seasonAirDates = regularSeasons?.map((s: any) => s.air_date!).sort().reverse();
  const lastEpisode = details?.last_episode_to_air;

  const itemWithDates: MediaItem = {
    ...item,
    firstAirDate: details?.first_air_date ?? item.firstAirDate,
    lastAirDate: details?.last_air_date,
    lastEpisodeAirDate: lastEpisode?.air_date,
    seasonAirDates,
    seasons: details?.number_of_seasons,
  };

  const badge = getFreshnessBadge(itemWithDates);
  return {
    ...itemWithDates,
    badge,
    inTopTen: topTenIds.has(String(item.id)),
  };
}

const genreCatalogCache = new Map<string, TvGenreCatalogData>();

export function clearGenreCatalogCache(): void {
  genreCatalogCache.clear();
}

export function getCachedGenreCatalog(type: 'movie' | 'tv', genreId: string): TvGenreCatalogData | null {
  return genreCatalogCache.get(`${type}-${genreId}`) ?? null;
}

const safely = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

export async function fetchTvGenreCatalog(
  type: 'movie' | 'tv',
  genreId: string,
  baselineCatalog?: { hero: MediaItem; rows: MediaRowModel[]; topTen: MediaItem[] } | null
): Promise<TvGenreCatalogData | null> {
  const cacheKey = `${type}-${genreId}`;
  const cached = genreCatalogCache.get(cacheKey);
  if (cached) return cached;

  if (genreId === 'all' && baselineCatalog) {
    return baselineCatalog;
  }

  const modules = await getTmdbModules();
  if (!modules?.tmdbClient) {
    return baselineCatalog ?? null;
  }
  const { tmdbClient, normalizeTmdbMovie, normalizeTmdbTv } = modules;

  if (type === 'movie') {
    const genre = TV_V2_MOVIE_GENRES.find((g) => g.id === genreId);
    if (!genre && baselineCatalog) return baselineCatalog;

    const genreParam = genre?.tmdbGenreId ? { with_genres: genre.tmdbGenreId } : {};

    const [popRes, topRes, recentRes] = await Promise.all([
      safely(tmdbClient.discoverMovies({ ...genreParam, sort_by: 'popularity.desc' })),
      safely(tmdbClient.discoverMovies({ ...genreParam, sort_by: 'vote_average.desc', 'vote_count.gte': 80 })),
      safely(tmdbClient.discoverMovies({ ...genreParam, sort_by: 'primary_release_date.desc', 'vote_count.gte': 20 })),
    ]);

    const popularItems = uniqueMovies((popRes as any)?.results ?? [], normalizeTmdbMovie);
    const topItems = uniqueMovies((topRes as any)?.results ?? [], normalizeTmdbMovie);
    const recentItems = uniqueMovies((recentRes as any)?.results ?? [], normalizeTmdbMovie);

    const rankedPool = dedupeMedia([...popularItems, ...topItems], 10);
    const topTenIds = new Set(rankedPool.map((i) => String(i.id)));

    const heroCandidate =
      popularItems.find((i) => i.backdropUrl) ??
      rankedPool.find((i) => i.backdropUrl) ??
      popularItems[0] ??
      baselineCatalog?.hero;

    if (!heroCandidate) return baselineCatalog ?? null;

    const enrichedHero = enrichMovie(heroCandidate, topTenIds);
    const enrichedTopTen = rankedPool.map((i) => enrichMovie(i, topTenIds));

    const genreTitle = genre?.name ?? 'Movies';
    const rows: MediaRowModel[] = [
      {
        emphasis: 'featured' as const,
        id: `genre-${genreId}-popular`,
        items: popularItems.map((i) => enrichMovie(i, topTenIds)),
        title: `Popular in ${genreTitle}`,
      },
      {
        id: `genre-${genreId}-top-rated`,
        items: topItems.map((i) => enrichMovie(i, topTenIds)),
        title: `Critically Acclaimed ${genreTitle}`,
      },
      {
        emphasis: 'compact' as const,
        id: `genre-${genreId}-recent`,
        items: recentItems.map((i) => enrichMovie(i, topTenIds)),
        title: `Fresh ${genreTitle} Releases`,
      },
    ].filter((r) => r.items.length > 0);

    const result: TvGenreCatalogData = {
      hero: enrichedHero,
      rows,
      topTen: enrichedTopTen,
    };

    genreCatalogCache.set(cacheKey, result);
    return result;
  }

  // TV Shows
  const genre = TV_V2_TV_GENRES.find((g) => g.id === genreId);
  if (!genre && baselineCatalog) return baselineCatalog;

  const genreParam = genre?.languageCode
    ? { with_original_language: genre.languageCode }
    : genre?.tmdbGenreId
      ? { with_genres: genre.tmdbGenreId }
      : {};

  const [popRes, topRes, recentRes] = await Promise.all([
    safely(tmdbClient.discoverTv({ ...genreParam, sort_by: 'popularity.desc' })),
    safely(tmdbClient.discoverTv({ ...genreParam, sort_by: 'vote_average.desc', 'vote_count.gte': 50 })),
    safely(tmdbClient.discoverTv({ ...genreParam, sort_by: 'first_air_date.desc', 'vote_count.gte': 15 })),
  ]);

  const category = genre?.id === 'anime' ? 'anime' : 'tv';
  const popularItems = uniqueTv((popRes as any)?.results ?? [], normalizeTmdbTv, category);
  const topItems = uniqueTv((topRes as any)?.results ?? [], normalizeTmdbTv, category);
  const recentItems = uniqueTv((recentRes as any)?.results ?? [], normalizeTmdbTv, category);

  const rankedPool = dedupeMedia([...popularItems, ...topItems], 10);
  const topTenIds = new Set(rankedPool.map((i) => String(i.id)));

  const candidateIds = new Set<number>();
  [...rankedPool, ...recentItems.slice(0, 6)].forEach((item) => {
    if (item.tmdbId) candidateIds.add(item.tmdbId);
  });

  const detailsMap = new Map<number, any>();
  await Promise.allSettled(
    Array.from(candidateIds).map(async (id) => {
      try {
        const d = await tmdbClient.getTvDetails(id);
        detailsMap.set(id, d);
      } catch {
        // Fall back gracefully
      }
    })
  );

  const heroCandidate =
    popularItems.find((i) => i.backdropUrl) ??
    rankedPool.find((i) => i.backdropUrl) ??
    popularItems[0] ??
    baselineCatalog?.hero;

  if (!heroCandidate) return baselineCatalog ?? null;

  const enrichedHero = enrichTv(heroCandidate, detailsMap, topTenIds);
  const enrichedTopTen = rankedPool.map((i) => enrichTv(i, detailsMap, topTenIds));

  const genreTitle = genre?.name ?? 'Shows';
  const rows: MediaRowModel[] = [
    {
      emphasis: 'featured' as const,
      id: `genre-${genreId}-popular`,
      items: popularItems.map((i) => enrichTv(i, detailsMap, topTenIds)),
      title: `Popular in ${genreTitle}`,
    },
    {
      id: `genre-${genreId}-top-rated`,
      items: topItems.map((i) => enrichTv(i, detailsMap, topTenIds)),
      title: `Critically Acclaimed ${genreTitle}`,
    },
    {
      emphasis: 'compact' as const,
      id: `genre-${genreId}-recent`,
      items: recentItems.map((i) => enrichTv(i, detailsMap, topTenIds)),
      title: `Fresh & New in ${genreTitle}`,
    },
  ].filter((r) => r.items.length > 0);

  const result: TvGenreCatalogData = {
    hero: enrichedHero,
    rows,
    topTen: enrichedTopTen,
  };

  genreCatalogCache.set(cacheKey, result);
  return result;
}
