import {
  normalizeTmdbMixed,
  normalizeTmdbMovie,
  normalizeTmdbTv,
} from '../../../lib/tmdb/adapters';
import { tmdbClient } from '../../../lib/tmdb/client';
import { getMediaDetails, getMediaIdentity } from '../../../lib/tmdb/service';
import type { TmdbMediaSummary } from '../../../lib/tmdb/types';
import type { HomeCatalog, HomeCatalogGateway, MediaBadge, MediaItem, MediaRowModel } from '../types';

let catalogPromise: Promise<HomeCatalog> | null = null;

function uniqueValid(items: Array<MediaItem | null>, limit = 18) {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

function movies(items: TmdbMediaSummary[], badge?: MediaBadge) {
  return uniqueValid(items.map((item) => normalizeTmdbMovie(item, badge)));
}

function tv(items: TmdbMediaSummary[], badge?: MediaBadge) {
  return uniqueValid(items.map((item) => normalizeTmdbTv(item, badge)));
}

function anime(items: TmdbMediaSummary[]) {
  return uniqueValid(items.map((item) => normalizeTmdbTv(item, undefined, 'anime')));
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
    (trending?.results ?? []).map((item) => normalizeTmdbMixed(item, 'trending')),
  );
  const popularMovieItems = movies(popularMovies?.results ?? []);
  const popularTvItems = tv(popularTv?.results ?? []);
  const rankedPool = uniqueValid([...trendingItems, ...popularMovieItems, ...popularTvItems], 10);
  const heroBase = rankedPool.find((item) => item.backdropUrl) ?? rankedPool[0];
  if (!heroBase) {
    if (firstError instanceof Error) throw firstError;
    throw new Error('TMDB did not return a usable featured title.');
  }

  const heroIdentity = getMediaIdentity(heroBase);
  const heroDetails = heroIdentity
    ? await getMediaDetails(heroIdentity).catch(() => null)
    : null;
  const hero: MediaItem = heroDetails
    ? {
      ...heroBase,
      genres: heroDetails.genres,
      logoUrl: heroDetails.logoUrl,
      maturityRating: heroDetails.maturityRating,
      runtime: heroDetails.runtime,
    }
    : heroBase;

  const rows = ([
    { id: 'trending', title: 'Trending Now', emphasis: 'featured', items: trendingItems },
    { id: 'now-playing', title: 'Now Playing', items: movies(nowPlaying?.results ?? []) },
    { id: 'upcoming', title: 'Upcoming Movies', items: movies(upcoming?.results ?? []) },
    { id: 'movies', title: 'Popular Movies', items: popularMovieItems },
    { id: 'series', title: 'Popular TV Shows', items: popularTvItems },
    { id: 'top-rated-movies', title: 'Critically Acclaimed Movies', emphasis: 'compact', items: movies(topRatedMovies?.results ?? []) },
    { id: 'top-rated-tv', title: 'Top Rated TV', emphasis: 'compact', items: tv(topRatedTv?.results ?? []) },
    { id: 'on-the-air', title: 'On The Air', emphasis: 'compact', items: tv(onTheAir?.results ?? []) },
    { id: 'airing-today', title: 'Airing Today', emphasis: 'compact', items: tv(airingToday?.results ?? [], 'new-episode') },
    { id: 'anime', title: 'Anime', emphasis: 'compact', items: anime(animeTv?.results ?? []) },
  ] satisfies MediaRowModel[]).filter((row) => row.items.length > 0);

  return {
    hero,
    rows,
    topTen: rankedPool.map((item) => ({ ...item, badge: 'top-10' })),
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
