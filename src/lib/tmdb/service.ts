import type { MediaItem, MediaType } from '../../features/catalog';
import type { MediaDetails, SeasonData } from '../../features/details-modal';
import {
  normalizeTmdbDetails,
  normalizeTmdbMixed,
  normalizeTmdbSeason,
} from './adapters';
import { tmdbClient } from './client';

export interface MediaIdentity {
  catalogCategory: MediaType;
  playbackType: 'movie' | 'tv';
  tmdbId: number;
}

export function getMediaIdentity(item: Pick<MediaItem, 'catalogCategory' | 'playbackType' | 'tmdbId' | 'type'>): MediaIdentity | null {
  if (!item.tmdbId || !Number.isInteger(item.tmdbId) || item.tmdbId <= 0) return null;
  const playbackType = item.playbackType ?? (item.type === 'movie' ? 'movie' : 'tv');
  return {
    catalogCategory: item.catalogCategory ?? item.type,
    playbackType,
    tmdbId: item.tmdbId,
  };
}

export async function getMediaDetails(identity: MediaIdentity): Promise<MediaDetails> {
  const raw = identity.playbackType === 'movie'
    ? await tmdbClient.getMovieDetails(identity.tmdbId)
    : await tmdbClient.getTvDetails(identity.tmdbId);
  return normalizeTmdbDetails(raw, identity.playbackType, identity.catalogCategory);
}

export async function getMediaSeason(tmdbId: number, seasonNumber: number): Promise<SeasonData> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(seasonNumber) || seasonNumber < 0) {
    throw new Error('This season is unavailable.');
  }
  return normalizeTmdbSeason(await tmdbClient.getSeason(tmdbId, seasonNumber));
}

export async function searchMulti(query: string): Promise<MediaItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const response = await tmdbClient.searchMulti(trimmed);
  return response.results
    .map((item) => normalizeTmdbMixed(item))
    .filter((item): item is MediaItem => item !== null);
}
