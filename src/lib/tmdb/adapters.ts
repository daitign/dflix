import type { MediaBadge, MediaItem, MediaType } from '../../features/catalog';
import type { EpisodeData, MediaDetails, SeasonData } from '../../features/details-modal';
import { getTmdbLocale } from './config';
import { getTmdbArtwork, getTmdbImageUrl } from './images';
import type {
  TmdbEpisode,
  TmdbImage,
  TmdbMediaSummary,
  TmdbMovieDetails,
  TmdbSeasonDetails,
  TmdbTvDetails,
} from './types';

const genreNames: Record<number, string> = {
  12: 'Adventure',
  14: 'Fantasy',
  16: 'Animation',
  18: 'Drama',
  27: 'Horror',
  28: 'Action',
  35: 'Comedy',
  36: 'History',
  37: 'Western',
  53: 'Thriller',
  80: 'Crime',
  99: 'Documentary',
  878: 'Science Fiction',
  9648: 'Mystery',
  10402: 'Music',
  10749: 'Romance',
  10751: 'Family',
  10752: 'War',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

function getTitle(item: TmdbMediaSummary, playbackType: 'movie' | 'tv') {
  return playbackType === 'movie' ? item.title?.trim() : item.name?.trim();
}

function getOriginalTitle(item: TmdbMediaSummary, playbackType: 'movie' | 'tv') {
  return playbackType === 'movie' ? item.original_title?.trim() : item.original_name?.trim();
}

function getYear(date?: string) {
  const year = date?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? Number(year) : undefined;
}

function getGenres(item: TmdbMediaSummary) {
  return (item.genre_ids ?? []).map((genreId) => genreNames[genreId]).filter(Boolean).slice(0, 4);
}

function isAnimeSource(item: TmdbMediaSummary) {
  return item.original_language === 'ja' && (item.genre_ids ?? []).includes(16);
}

export function hasUsableTmdbMedia(item: TmdbMediaSummary) {
  if (!Number.isInteger(item.id) || item.id <= 0) return false;
  if (!item.poster_path && !item.backdrop_path) return false;
  const playbackType = item.media_type === 'tv' ? 'tv' : 'movie';
  return Boolean(getTitle(item, playbackType));
}

function normalizeTmdbMedia(
  item: TmdbMediaSummary,
  playbackType: 'movie' | 'tv',
  options: { badge?: MediaBadge; category?: MediaType } = {},
): MediaItem | null {
  const title = getTitle(item, playbackType);
  if (!title || !Number.isInteger(item.id) || item.id <= 0 || (!item.poster_path && !item.backdrop_path)) {
    return null;
  }

  const inferredCategory: MediaType = isAnimeSource(item) ? 'anime' : playbackType;
  const backdrop = getTmdbArtwork(item.backdrop_path ?? item.poster_path, 'backdrop');
  const poster = getTmdbArtwork(item.poster_path ?? item.backdrop_path, 'poster');

  return {
    backdrop,
    backdropUrl: backdrop.fallback,
    badge: options.badge,
    catalogCategory: options.category ?? inferredCategory,
    genres: getGenres(item),
    id: `${playbackType}-${item.id}`,
    originalTitle: getOriginalTitle(item, playbackType),
    overview: item.overview?.trim() || undefined,
    playbackType,
    poster,
    posterUrl: poster.fallback,
    title,
    tmdbId: item.id,
    type: options.category ?? inferredCategory,
    voteAverage: item.vote_average,
    year: getYear(playbackType === 'movie' ? item.release_date : item.first_air_date),
  };
}

export function normalizeTmdbMovie(item: TmdbMediaSummary, badge?: MediaBadge) {
  return normalizeTmdbMedia(item, 'movie', { badge });
}

export function normalizeTmdbTv(
  item: TmdbMediaSummary,
  badge?: MediaBadge,
  category?: MediaType,
) {
  return normalizeTmdbMedia(item, 'tv', { badge, category });
}

export function normalizeTmdbMixed(item: TmdbMediaSummary, badge?: MediaBadge) {
  if (item.media_type === 'person') return null;
  const playbackType = item.media_type === 'tv' ? 'tv' : 'movie';
  return normalizeTmdbMedia(item, playbackType, { badge });
}

function chooseLogo(images: TmdbImage[] | undefined) {
  if (!images?.length) return undefined;
  const preferredLanguage = getTmdbLocale().language.split('-')[0].toLowerCase();
  const ranked = [...images].sort((left, right) => right.vote_average - left.vote_average);
  const logo = ranked.find((image) => image.iso_639_1?.toLowerCase() === preferredLanguage)
    ?? ranked.find((image) => image.iso_639_1?.toLowerCase() === 'en')
    ?? ranked.find((image) => image.iso_639_1 === null)
    ?? ranked[0];
  return getTmdbImageUrl(logo.file_path, 'w500', 'logo');
}

function getMovieCertification(details: TmdbMovieDetails) {
  const releases = details.release_dates?.results ?? [];
  const region = getTmdbLocale().region;
  const selected = releases.find((entry) => entry.iso_3166_1 === region)
    ?? releases.find((entry) => entry.iso_3166_1 === 'US')
    ?? releases.find((entry) => entry.release_dates.some((release) => release.certification));
  return selected?.release_dates.find((release) => release.certification)?.certification || undefined;
}

function getTvCertification(details: TmdbTvDetails) {
  const ratings = details.content_ratings?.results ?? [];
  const region = getTmdbLocale().region;
  return ratings.find((entry) => entry.iso_3166_1 === region)?.rating
    || ratings.find((entry) => entry.iso_3166_1 === 'US')?.rating
    || ratings.find((entry) => entry.rating)?.rating
    || undefined;
}

function normalizeRelated(
  recommendations: TmdbMediaSummary[] | undefined,
  similar: TmdbMediaSummary[] | undefined,
  playbackType: 'movie' | 'tv',
  category: MediaType,
) {
  const items = [...(recommendations ?? []), ...(similar ?? [])]
    .map((item) => normalizeTmdbMedia(item, playbackType, {
      category: category === 'anime' ? 'anime' : playbackType,
    }))
    .filter((item): item is MediaItem => item !== null);
  return [...new Map(items.map((item) => [item.tmdbId, item])).values()].slice(0, 9);
}

function seasonSummaries(details: TmdbTvDetails): SeasonData[] {
  return (details.seasons ?? [])
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .map((season) => ({
      airDate: season.air_date,
      episodeCount: season.episode_count,
      name: season.name || (season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`),
      posterUrl: getTmdbImageUrl(season.poster_path, 'w342', 'poster'),
      seasonNumber: season.season_number,
      year: getYear(season.air_date),
    }));
}

export function normalizeTmdbDetails(
  raw: TmdbMovieDetails | TmdbTvDetails,
  playbackType: 'movie' | 'tv',
  category: MediaType = playbackType,
): MediaDetails {
  const normalized = normalizeTmdbMedia(raw, playbackType, { category });
  if (!normalized) throw new Error('TMDB returned an unusable title.');

  const isMovie = playbackType === 'movie';
  const tv = raw as TmdbTvDetails;
  const movie = raw as TmdbMovieDetails;
  const cast = raw.credits?.cast
    ?.slice()
    .sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
    .slice(0, 8)
    .map((member) => member.name) ?? [];
  const directors = raw.credits?.crew.filter((member) => member.job === 'Director').map((member) => member.name) ?? [];
  const creators = isMovie ? directors : (tv.created_by ?? []).map((creator) => creator.name);
  const genres = raw.genres?.map((genre) => genre.name).filter(Boolean) ?? normalized.genres ?? [];

  return {
    backdrop: normalized.backdrop,
    backdropUrl: normalized.backdropUrl,
    cast,
    catalogCategory: category,
    creators,
    descriptors: genres.slice(0, 3),
    genres,
    id: normalized.id,
    logoUrl: chooseLogo(raw.images?.logos),
    maturityRating: isMovie ? getMovieCertification(movie) : getTvCertification(tv),
    originalTitle: normalized.originalTitle,
    overview: normalized.overview ?? 'No synopsis is currently available for this title.',
    playbackType,
    poster: normalized.poster,
    posterUrl: normalized.posterUrl,
    quality: 'HD',
    runtime: isMovie ? movie.runtime ?? undefined : tv.episode_run_time?.find((runtime) => runtime > 0),
    seasons: isMovie ? undefined : seasonSummaries(tv),
    similar: normalizeRelated(
      raw.recommendations?.results,
      raw.similar?.results,
      playbackType,
      category,
    ),
    title: normalized.title,
    tmdbId: normalized.tmdbId,
    type: category,
    voteAverage: normalized.voteAverage,
    year: normalized.year,
  };
}

export function normalizeTmdbEpisode(episode: TmdbEpisode): EpisodeData {
  const still = getTmdbArtwork(episode.still_path, 'still');
  return {
    airDate: episode.air_date,
    episodeNumber: episode.episode_number,
    id: String(episode.id),
    overview: episode.overview?.trim() || 'Episode information is not available yet.',
    runtime: episode.runtime ?? undefined,
    still,
    stillUrl: still.fallback,
    title: episode.name?.trim() || `Episode ${episode.episode_number}`,
  };
}

export function normalizeTmdbSeason(raw: TmdbSeasonDetails): SeasonData {
  return {
    airDate: raw.air_date,
    episodeCount: raw.episodes.length,
    episodes: raw.episodes.map(normalizeTmdbEpisode),
    name: raw.name || (raw.season_number === 0 ? 'Specials' : `Season ${raw.season_number}`),
    posterUrl: getTmdbImageUrl(raw.poster_path, 'w342', 'poster'),
    seasonNumber: raw.season_number,
    year: getYear(raw.air_date),
  };
}
