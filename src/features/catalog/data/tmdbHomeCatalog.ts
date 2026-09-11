import {
  normalizeTmdbMixed,
  normalizeTmdbMovie,
  normalizeTmdbTv,
} from '../../../lib/tmdb/adapters';
import { tmdbClient } from '../../../lib/tmdb/client';
import { getMediaDetails, getMediaIdentity } from '../../../lib/tmdb/service';
import type { TmdbMediaSummary, TmdbTvDetails } from '../../../lib/tmdb/types';
import { getFreshnessBadge } from '../freshness';
import type { HomeCatalog, HomeCatalogGateway, MediaItem, MediaRowModel } from '../types';

let catalogPromise: Promise<HomeCatalog> | null = null;

function uniqueValid(items: Array<MediaItem | null>, limit = 18) {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

function movies(items: TmdbMediaSummary[]) {
  return uniqueValid(items.map((item) => normalizeTmdbMovie(item)));
}

function tv(items: TmdbMediaSummary[]) {
  return uniqueValid(items.map((item) => normalizeTmdbTv(item)));
}

function anime(items: TmdbMediaSummary[]) {
  return uniqueValid(items.map((item) => normalizeTmdbTv(item, undefined, 'anime')));
}

function enrichTvItem(
  item: MediaItem,
  tvDetailsMap: Map<number, TmdbTvDetails>,
): MediaItem {
  const tmdbId = item.tmdbId;
  const details = tmdbId ? tvDetailsMap.get(tmdbId) : undefined;

  // Regular seasons only (exclude season 0 / Specials and empty seasons)
  const regularSeasons = details?.seasons?.filter(
    (season) => season.season_number > 0 && season.episode_count > 0 && Boolean(season.air_date),
  );

  const seasonAirDates = regularSeasons
    ?.map((season) => season.air_date!)
    .sort()
    .reverse();

  // Strictly use last_episode_to_air.air_date, never next_episode_to_air
  const lastEpisode = details?.last_episode_to_air;
  const lastEpisodeAirDate = lastEpisode?.air_date;
  const lastEpisodeSeasonNumber = lastEpisode?.season_number;
  const lastEpisodeNumber = lastEpisode?.episode_number;
  const lastEpisodeName = lastEpisode?.name;

  const itemWithDates: MediaItem = {
    ...item,
    firstAirDate: details?.first_air_date ?? item.firstAirDate,
    lastAirDate: details?.last_air_date,
    lastEpisodeAirDate,
    lastEpisodeSeasonNumber,
    lastEpisodeNumber,
    lastEpisodeName,
    seasonAirDates,
  };

  const badge = getFreshnessBadge(itemWithDates);

  return {
    ...itemWithDates,
    badge,
  };
}

function enrichMovieItem(item: MediaItem): MediaItem {
  const badge = getFreshnessBadge(item);
  return { ...item, badge };
}

function enrichMediaItem(
  item: MediaItem,
  tvDetailsMap: Map<number, TmdbTvDetails>,
  topTenIds: Set<string>,
): MediaItem {
  const isMovie = item.playbackType === 'movie' || item.type === 'movie';
  const enriched = isMovie
    ? enrichMovieItem(item)
    : enrichTvItem(item, tvDetailsMap);

  return {
    ...enriched,
    inTopTen: topTenIds.has(String(item.id)),
  };
}

async function buildCatalog(): Promise<HomeCatalog> {
  let firstError: unknown;
  const safely = async <T,>(request: Promise<T>): Promise<T | null> => {
    try {
      return await request;
    } catch (error) {
      firstError ??= error;
      return null;
    }
  };
  const [
    trending,
    popularMovies,
    popularTv,
    nowPlaying,
    upcoming,
    topRatedMovies,
    topRatedTv,
    onTheAir,
    airingToday,
    animeTv,
  ] = await Promise.all([
    safely(tmdbClient.getTrending()),
    safely(tmdbClient.getPopularMovies()),
    safely(tmdbClient.getPopularTv()),
    safely(tmdbClient.getNowPlayingMovies()),
    safely(tmdbClient.getUpcomingMovies()),
    safely(tmdbClient.getTopRatedMovies()),
    safely(tmdbClient.getTopRatedTv()),
    safely(tmdbClient.getOnTheAirTv()),
    safely(tmdbClient.getAiringTodayTv()),
    safely(tmdbClient.getAnimeTv()),
  ]);

  const trendingItems = uniqueValid(
    (trending?.results ?? []).map((item) => normalizeTmdbMixed(item)),
  );
  const popularMovieItems = movies(popularMovies?.results ?? []);
  const popularTvItems = tv(popularTv?.results ?? []);
  const rankedPool = uniqueValid([...trendingItems, ...popularMovieItems, ...popularTvItems], 10);
  const heroBase = rankedPool.find((item) => item.backdropUrl) ?? rankedPool[0];
  if (!heroBase) {
    if (firstError instanceof Error) throw firstError;
    throw new Error('TMDB did not return a usable featured title.');
  }

  // Bounded TV enrichment: fetch details only for active candidates (Top 10 + top Popular + top On The Air)
  const candidateTvIds = new Set<number>();
  rankedPool.forEach((item) => {
    if (item.playbackType === 'tv' && item.tmdbId) candidateTvIds.add(item.tmdbId);
  });
  (popularTv?.results ?? []).slice(0, 12).forEach((item) => {
    if (item.id) candidateTvIds.add(item.id);
  });
  (onTheAir?.results ?? []).slice(0, 8).forEach((item) => {
    if (item.id) candidateTvIds.add(item.id);
  });

  const tvDetailsMap = new Map<number, TmdbTvDetails>();
  await Promise.allSettled(
    Array.from(candidateTvIds).map(async (id) => {
      try {
        const details = await tmdbClient.getTvDetails(id);
        if (details) tvDetailsMap.set(id, details);
      } catch {
        // Fallback gracefully without badge
      }
    }),
  );

  const topTenIds = new Set(rankedPool.map((item) => String(item.id)));

  const heroIdentity = getMediaIdentity(heroBase);
  const heroDetails = heroIdentity
    ? await getMediaDetails(heroIdentity).catch(() => null)
    : null;
  const heroDraft: MediaItem = heroDetails
    ? {
      ...heroBase,
      genres: heroDetails.genres,
      logoUrl: heroDetails.logoUrl,
      maturityRating: heroDetails.maturityRating,
      runtime: heroDetails.runtime,
    }
    : heroBase;
  const hero = enrichMediaItem(heroDraft, tvDetailsMap, topTenIds);

  const rows = ([
    {
      id: 'trending',
      title: 'Trending Now',
      emphasis: 'featured',
      items: trendingItems.map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'now-playing',
      title: 'Now Playing',
      items: movies(nowPlaying?.results ?? []).map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'upcoming',
      title: 'Upcoming Movies',
      items: movies(upcoming?.results ?? []).map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'movies',
      title: 'Popular Movies',
      items: popularMovieItems.map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'series',
      title: 'Popular TV Shows',
      items: popularTvItems.map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'top-rated-movies',
      title: 'Critically Acclaimed Movies',
      emphasis: 'compact',
      items: movies(topRatedMovies?.results ?? []).map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'top-rated-tv',
      title: 'Top Rated TV',
      emphasis: 'compact',
      items: tv(topRatedTv?.results ?? []).map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'on-the-air',
      title: 'On The Air',
      emphasis: 'compact',
      items: tv(onTheAir?.results ?? []).map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'airing-today',
      title: 'Airing Today',
      emphasis: 'compact',
      items: tv(airingToday?.results ?? []).map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
    {
      id: 'anime',
      title: 'Anime',
      emphasis: 'compact',
      items: anime(animeTv?.results ?? []).map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds)),
    },
  ] satisfies MediaRowModel[]).filter((row) => row.items.length > 0);

  const topTen = rankedPool.map((item) => enrichMediaItem(item, tvDetailsMap, topTenIds));

  return {
    hero,
    rows,
    topTen,
  };
}

export const tmdbHomeCatalogGateway: HomeCatalogGateway = {
  getHomeCatalog() {
    if (!catalogPromise) catalogPromise = buildCatalog().catch((error) => {
      catalogPromise = null;
      throw error;
    });
    return catalogPromise;
  },
};

export function getTmdbHomeCatalog() {
  return tmdbHomeCatalogGateway.getHomeCatalog();
}
