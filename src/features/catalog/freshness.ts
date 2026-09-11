import type { MediaBadge, MediaType } from './types';

/**
 * Strict date-based freshness calculations for movies and TV series using verified TMDB date fields.
 * No badges are ever assigned based on random values, card index, carousel position, category names,
 * mock data, or popularity.
 */

/**
 * Calculates the whole-day difference between a reference date and a target date string (YYYY-MM-DD or ISO).
 * Both dates are normalized to UTC midnight so that local timezones do not cause +/-1 day jitter.
 * Returns a positive integer if target date is in the past, 0 if today, negative if in the future,
 * or null if invalid or unparseable.
 */
export function getDaysDifference(dateStr?: string, referenceDate: Date = new Date()): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  const targetUtc = Date.UTC(year, month - 1, day);
  const currentUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  const diffMs = currentUtc - targetUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export interface FreshnessMediaInput {
  id?: number | string;
  title?: string;
  type?: MediaType;
  playbackType?: 'movie' | 'tv';
  releaseDate?: string;
  firstAirDate?: string;
  lastAirDate?: string;
  lastEpisodeAirDate?: string;
  seasonAirDates?: string[];
  badge?: MediaBadge;
}

/**
 * Movie Freshness Rules:
 * - Never show New Episode
 * - Never show New Season
 * - NEW: release_date within last 14 days (0 <= days <= 14)
 * - RECENTLY ADDED: release_date within last 30 days (15 <= days <= 30)
 * - Older than 30 days, future releases, or missing date: no badge (undefined)
 */
export function getMovieFreshnessBadge(
  releaseDate?: string,
  referenceDate?: Date,
): 'new' | 'recently-added' | undefined {
  const days = getDaysDifference(releaseDate, referenceDate);
  if (days === null || days < 0) return undefined;
  if (days <= 14) return 'new';
  if (days <= 30) return 'recently-added';
  return undefined;
}

/**
 * TV Freshness Rules:
 * - Priority 1: NEW EPISODE = latest aired episode date within last 7 days (0 <= days <= 7)
 * - Priority 2: NEW SEASON = latest regular season premiere date within last 30 days (0 <= days <= 30)
 * - Priority 3: RECENTLY ADDED = first air date within last 30 days (0 <= days <= 30)
 * - Priority: New Episode > New Season > Recently Added.
 * - Never label unaired future episodes as new (days < 0).
 * - Never use next_episode_to_air for New Episode.
 * - Ignore Season 0 / Specials when determining New Season.
 * - Older than threshold, future releases, or missing/uncertain data: no badge (undefined)
 */
export function getTvFreshnessBadge(
  input: FreshnessMediaInput,
  referenceDate?: Date,
): 'new-episode' | 'new-season' | 'recently-added' | undefined {
  // Priority 1: New Episode (latest aired episode within last 7 days)
  if (input.lastEpisodeAirDate) {
    const epDays = getDaysDifference(input.lastEpisodeAirDate, referenceDate);
    if (epDays !== null && epDays >= 0 && epDays <= 7) {
      return 'new-episode';
    }
  }

  // Priority 2: New Season (regular season premiere within last 30 days, excluding Season 0 / specials)
  if (input.seasonAirDates && input.seasonAirDates.length > 0) {
    for (const seasonDate of input.seasonAirDates) {
      const seasonDays = getDaysDifference(seasonDate, referenceDate);
      if (seasonDays !== null && seasonDays >= 0 && seasonDays <= 30) {
        return 'new-season';
      }
    }
  }

  // Priority 3: Recently Added (first_air_date within last 30 days)
  if (input.firstAirDate) {
    const firstDays = getDaysDifference(input.firstAirDate, referenceDate);
    if (firstDays !== null && firstDays >= 0 && firstDays <= 30) {
      return 'recently-added';
    }
  }

  return undefined;
}

/**
 * Centralized freshness badge helper with defensive media-type guards.
 * - movie: cannot ever return New Episode or New Season
 * - tv/anime: may return New Episode/New Season only from valid TV date data
 * - missing/unreliable dates: returns undefined (no badge)
 */
export function getFreshnessBadge(
  media?: FreshnessMediaInput | null,
  now?: Date,
): MediaBadge | undefined {
  if (!media) return undefined;

  const isDefiniteMovie = media.playbackType === 'movie' || media.type === 'movie';
  const isDefiniteTv = media.playbackType === 'tv' || media.type === 'tv';

  if (isDefiniteMovie) {
    // Movie guard: only evaluated via movie release_date; strictly prohibited from TV badges
    return getMovieFreshnessBadge(media.releaseDate, now);
  }

  if (isDefiniteTv) {
    // TV guard: evaluated strictly via verified TV date fields
    return getTvFreshnessBadge(media, now);
  }

  // Fallback for anime or mixed/unspecified categories:
  // If release_date is present without TV dates, treat as movie
  if (media.releaseDate && !media.firstAirDate && !media.lastEpisodeAirDate) {
    return getMovieFreshnessBadge(media.releaseDate, now);
  }

  // If TV date fields are present, evaluate strictly with TV rules
  if (media.firstAirDate || media.lastEpisodeAirDate || (media.seasonAirDates && media.seasonAirDates.length > 0)) {
    return getTvFreshnessBadge(media, now);
  }

  return undefined;
}
