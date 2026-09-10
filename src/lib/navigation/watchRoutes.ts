import type { MediaItem } from '../../features/catalog';
import type { MediaPreviewData } from '../../features/hover-preview/types';

export interface MovieWatchRoute {
  tmdbId: number;
  type: 'movie';
}

export interface TvWatchRoute {
  episode: number;
  season: number;
  tmdbId: number;
  type: 'tv';
}

export type WatchRoute = MovieWatchRoute | TvWatchRoute;

export interface WatchNavigationState {
  episodeLabel?: string;
  title: string;
}

type WatchableMedia = Pick<MediaItem | MediaPreviewData, 'playbackType' | 'title' | 'tmdbId' | 'type'>;

export function buildWatchPath(route: WatchRoute) {
  if (route.type === 'movie') return `/watch/movie/${route.tmdbId}`;
  return `/watch/tv/${route.tmdbId}/${route.season}/${route.episode}`;
}

export function parseWatchPath(pathname: string): WatchRoute | null {
  const movieMatch = pathname.match(/^\/watch\/movie\/(\d+)\/?$/);
  if (movieMatch) {
    const tmdbId = Number(movieMatch[1]);
    return tmdbId > 0 ? { tmdbId, type: 'movie' } : null;
  }

  const tvMatch = pathname.match(/^\/watch\/tv\/(\d+)\/(\d+)\/(\d+)\/?$/);
  if (!tvMatch) return null;
  const [, id, season, episode] = tvMatch.map(Number);
  if (id <= 0 || season <= 0 || episode <= 0) return null;
  return { episode, season, tmdbId: id, type: 'tv' };
}

export function navigateToWatch(
  media: WatchableMedia,
  options: { episode?: number; episodeLabel?: string; season?: number } = {},
) {
  if (!media.tmdbId || !Number.isInteger(media.tmdbId) || media.tmdbId <= 0) return false;
  const playbackType = media.playbackType ?? (media.type === 'movie' ? 'movie' : 'tv');
  const route: WatchRoute = playbackType === 'movie'
    ? { tmdbId: media.tmdbId, type: 'movie' }
    : {
      episode: options.episode ?? 1,
      season: options.season ?? 1,
      tmdbId: media.tmdbId,
      type: 'tv',
    };
  const state: WatchNavigationState = { episodeLabel: options.episodeLabel, title: media.title };
  window.history.pushState({ daitignWatch: state }, '', buildWatchPath(route));
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  return true;
}

export function navigateHome() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}
