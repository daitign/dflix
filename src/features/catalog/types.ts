export type MediaType = 'movie' | 'tv' | 'anime';

export type MediaBadge =
  | 'recently-added'
  | 'new-episode'
  | 'new-season'
  | 'trending'
  | 'top-10';

export interface MediaArtwork {
  fallback: string;
  srcSet: string;
}

export interface MediaItem {
  id: number | string;
  tmdbId?: number;
  type: MediaType;
  title: string;
  overview?: string;
  backdropUrl?: string;
  backdrop?: MediaArtwork;
  posterUrl?: string;
  year?: number;
  rating?: string;
  genres?: string[];
  runtime?: number;
  seasons?: number;
  badge?: MediaBadge;
  progress?: number;
  episodeLabel?: string;
}

export interface MediaRowModel {
  id: string;
  title: string;
  items: MediaItem[];
  emphasis?: 'standard' | 'featured' | 'compact';
}

export interface HomeCatalog {
  hero: MediaItem;
  topTen: MediaItem[];
  rows: MediaRowModel[];
}

export interface HomeCatalogGateway {
  getHomeCatalog(): Promise<HomeCatalog>;
}
