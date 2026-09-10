import { tmdbClient } from './client';
import type { TmdbVideo } from './types';

const VIDEO_CACHE_TTL_MS = 30 * 60_000;
const MAX_VIDEO_CACHE_ENTRIES = 100;

interface CachedVideos {
  expiresAt: number;
  videos: TmdbVideo[];
}

interface GetMediaVideosOptions {
  signal?: AbortSignal;
}

const mediaVideosCache = new Map<string, CachedVideos>();

function getCacheKey(type: 'movie' | 'tv', tmdbId: number) {
  return `${type}:${tmdbId}`;
}

function readCachedVideos(key: string) {
  const cached = mediaVideosCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    mediaVideosCache.delete(key);
    return null;
  }

  mediaVideosCache.delete(key);
  mediaVideosCache.set(key, cached);
  return cached.videos;
}

function cacheVideos(key: string, videos: TmdbVideo[]) {
  mediaVideosCache.set(key, {
    expiresAt: Date.now() + VIDEO_CACHE_TTL_MS,
    videos,
  });

  while (mediaVideosCache.size > MAX_VIDEO_CACHE_ENTRIES) {
    const oldestKey = mediaVideosCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    mediaVideosCache.delete(oldestKey);
  }
}

function getSelectionRank(video: TmdbVideo) {
  const type = video.type.trim().toLowerCase();
  if (type === 'trailer' && video.official) return 0;
  if (type === 'trailer') return 1;
  if (type === 'teaser') return 2;
  return Number.POSITIVE_INFINITY;
}

function getPublishedTimestamp(video: TmdbVideo) {
  if (!video.published_at) return 0;
  const timestamp = Date.parse(video.published_at);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export async function getMediaVideos(
  type: 'movie' | 'tv',
  tmdbId: number,
  options: GetMediaVideosOptions = {},
): Promise<TmdbVideo[]> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    throw new Error('A valid TMDB title is required to load preview videos.');
  }

  const key = getCacheKey(type, tmdbId);
  const cached = readCachedVideos(key);
  if (cached) return cached;

  const response = await tmdbClient.getMediaVideos(type, tmdbId, options.signal);
  const videos = Array.isArray(response.results) ? response.results : [];
  cacheVideos(key, videos);
  return videos;
}

export function selectBestPreviewVideo(videos: TmdbVideo[]): TmdbVideo | null {
  const candidates = videos.filter((video) => {
    const isYouTube = video.site.trim().toLowerCase() === 'youtube';
    const hasValidKey = /^[A-Za-z0-9_-]{6,}$/.test(video.key);
    return isYouTube && hasValidKey && Number.isFinite(getSelectionRank(video));
  });

  candidates.sort((first, second) => {
    const rankDifference = getSelectionRank(first) - getSelectionRank(second);
    if (rankDifference !== 0) return rankDifference;
    if (first.official !== second.official) return first.official ? -1 : 1;

    const dateDifference = getPublishedTimestamp(second) - getPublishedTimestamp(first);
    if (dateDifference !== 0) return dateDifference;
    return (second.size ?? 0) - (first.size ?? 0);
  });

  return candidates[0] ?? null;
}
