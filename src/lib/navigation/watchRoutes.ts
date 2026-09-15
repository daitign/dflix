import type { MediaItem } from '../../features/catalog';
import type { MediaPreviewData } from '../../features/hover-preview/types';
import { buildVidStuckUrl } from '../vidstuck/buildPlayerUrl.ts';
import { saveTvBrowseState } from '../tv/tvBrowseState.ts';

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

type WatchableMedia = Pick<MediaItem | MediaPreviewData, 'playbackType' | 'title' | 'tmdbId' | 'type'> & {
  id?: number | string;
};

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
  const candidateId = media.tmdbId && Number.isInteger(media.tmdbId) && media.tmdbId > 0
    ? media.tmdbId
    : (typeof media.id === 'number' && Number.isInteger(media.id) && media.id > 0
      ? media.id
      : (typeof media.id === 'string' && /^\d+$/.test(media.id)
        ? Number(media.id)
        : 0));

  if (!candidateId) return false;
  const playbackType = media.playbackType ?? (media.type === 'movie' ? 'movie' : 'tv');
  const route: WatchRoute = playbackType === 'movie'
    ? { tmdbId: candidateId, type: 'movie' }
    : {
      episode: options.episode ?? 1,
      season: options.season ?? 1,
      tmdbId: candidateId,
      type: 'tv',
    };
  if (typeof window !== 'undefined' && window.AndroidTVBridge?.startTvPlayer) {
    saveTvBrowseState();
    const vidstuckUrl = buildVidStuckUrl(route);
    window.AndroidTVBridge.startTvPlayer(vidstuckUrl, JSON.stringify(route));
    return true;
  }

  const state: WatchNavigationState = { episodeLabel: options.episodeLabel, title: media.title };
  window.history.pushState({ daitignWatch: state }, '', buildWatchPath(route));
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  return true;
}

export function navigateHome() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}
