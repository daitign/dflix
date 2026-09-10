import type { MediaArtwork, MediaBadge, MediaItem, MediaType } from '../catalog';

export type HoverPreviewPlacement = 'left' | 'center' | 'right';

export type HoverPreviewAction = 'play' | 'add-to-list' | 'like' | 'details';

export interface MediaPreviewData {
  artwork?: MediaArtwork;
  artworkUrl?: string;
  badge?: MediaBadge;
  genres: string[];
  id: MediaItem['id'];
  maturityRating?: string;
  playbackType: 'movie' | 'tv';
  quality: 'HD';
  runtime?: number;
  seasons?: number;
  title: string;
  tmdbId?: number;
  type: MediaType;
  year?: number;
}

export interface HoverPreviewActionDetail {
  action: HoverPreviewAction;
  media: MediaPreviewData;
  trigger?: HTMLElement | null;
}

export const HOVER_PREVIEW_ACTION_EVENT = 'daitign:hover-preview-action';

export function toMediaPreviewData(item: MediaItem): MediaPreviewData {
  return {
    artwork: item.backdrop,
    artworkUrl: item.backdropUrl,
    badge: item.badge,
    genres: item.genres?.slice(0, 3) ?? [],
    id: item.id,
    maturityRating: item.maturityRating ?? item.rating,
    playbackType: item.playbackType ?? (item.type === 'movie' ? 'movie' : 'tv'),
    quality: 'HD',
    runtime: item.runtime,
    seasons: item.seasons,
    title: item.title,
    tmdbId: item.tmdbId,
    type: item.type,
    year: item.year,
  };
}
