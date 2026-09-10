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
  type?: string;
}

export interface MediaItem {
  id: number | string;
  tmdbId?: number;
  type: MediaType;
  title: string;
  originalTitle?: string;
  overview?: string;
  backdropUrl?: string;
  backdrop?: MediaArtwork;
  posterUrl?: string;
  poster?: MediaArtwork;
  logoUrl?: string;
  year?: number;
  voteAverage?: number;
  rating?: string;
  maturityRating?: string;
  genres?: string[];
  runtime?: number;
  seasons?: number;
  badge?: MediaBadge;
  progress?: number;
  episodeLabel?: string;
  playbackType?: 'movie' | 'tv';
  catalogCategory?: MediaType;
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
