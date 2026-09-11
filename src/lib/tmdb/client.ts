import { getTmdbLocale } from './config';
import { tmdbEndpoints } from './endpoints';
import type {
  TmdbMediaSummary,
  TmdbMovieDetails,
  TmdbPagedResponse,
  TmdbSeasonDetails,
  TmdbTvDetails,
  TmdbVideoResponse,
} from './types';

type QueryValue = boolean | number | string | undefined;

export class TmdbRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TmdbRequestError';
    this.status = status;
  }
}

const requestCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();

async function requestTmdb<T>(
  endpoint: string,
  query: Record<string, QueryValue> = {},
  cacheMs = 5 * 60_000,
  signal?: AbortSignal,
): Promise<T> {
  const { language, region } = getTmdbLocale();
  const params = new URLSearchParams({ endpoint, language });
  if (region) params.set('region', region);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });

  const requestUrl = `/api/tmdb?${params.toString()}`;
  const cached = requestCache.get(requestUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const existing = signal ? undefined : pendingRequests.get(requestUrl);
  if (existing) return existing as Promise<T>;

  const pending = fetch(requestUrl, { headers: { Accept: 'application/json' }, signal })
    .then(async (response) => {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new TmdbRequestError(
          payload?.error ?? 'DAITIGN could not reach the catalog service.',
          response.status,
        );
      }
      requestCache.set(requestUrl, { expiresAt: Date.now() + cacheMs, value: payload });
      return payload as T;
    })
    .finally(() => {
      if (!signal) pendingRequests.delete(requestUrl);
    });

  if (!signal) pendingRequests.set(requestUrl, pending);
  return pending;
}

const detailsAppend = 'credits,recommendations,similar,images,release_dates';
const tvDetailsAppend = 'credits,recommendations,similar,images,content_ratings';

function imageLanguages() {
  const language = getTmdbLocale().language.split('-')[0];
  return `${language},en,null`;
}

export const tmdbClient = {
  getAiringTodayTv: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.airingTodayTv),
  getAnimeTv: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.animeTv, {
    sort_by: 'popularity.desc',
    'vote_count.gte': 80,
    with_genres: 16,
    with_original_language: 'ja',
  }),
  discoverMovies: (params: Record<string, QueryValue> = {}) => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(
    tmdbEndpoints.discoverMovie,
    { sort_by: 'popularity.desc', 'vote_count.gte': 50, ...params },
  ),
  discoverTv: (params: Record<string, QueryValue> = {}) => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(
    tmdbEndpoints.discoverTv,
    { sort_by: 'popularity.desc', 'vote_count.gte': 40, ...params },
  ),
  getMovieDetails: (tmdbId: number) => requestTmdb<TmdbMovieDetails>(
    tmdbEndpoints.movieDetails(tmdbId),
    { append_to_response: detailsAppend, include_image_language: imageLanguages() },
    60 * 60_000,
  ),
  getMediaVideos: (type: 'movie' | 'tv', tmdbId: number, signal?: AbortSignal) => requestTmdb<TmdbVideoResponse>(
    type === 'movie' ? tmdbEndpoints.movieVideos(tmdbId) : tmdbEndpoints.tvVideos(tmdbId),
    {},
    30 * 60_000,
    signal,
  ),
  getNowPlayingMovies: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.nowPlayingMovies),
  getOnTheAirTv: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.onTheAirTv),
  getPopularMovies: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.popularMovies),
  getPopularTv: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.popularTv),
  getSeason: (tmdbId: number, season: number) => requestTmdb<TmdbSeasonDetails>(
    tmdbEndpoints.seasonDetails(tmdbId, season),
    {},
    60 * 60_000,
  ),
  getTopRatedMovies: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.topRatedMovies),
  getTopRatedTv: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.topRatedTv),
  getTrending: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.trending),
  getTrendingMovies: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.trendingMovies),
  getTrendingTv: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.trendingTv),
  getTvDetails: (tmdbId: number) => requestTmdb<TmdbTvDetails>(
    tmdbEndpoints.tvDetails(tmdbId),
    { append_to_response: tvDetailsAppend, include_image_language: imageLanguages() },
    60 * 60_000,
  ),
  getUpcomingMovies: () => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(tmdbEndpoints.upcomingMovies),
  searchMulti: (query: string) => requestTmdb<TmdbPagedResponse<TmdbMediaSummary>>(
    tmdbEndpoints.searchMulti,
    { include_adult: false, query: query.trim() },
    2 * 60_000,
  ),
};
