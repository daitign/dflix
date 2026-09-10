import type { MediaArtwork, MediaItem, MediaType } from '../catalog';

export interface EpisodeData {
  episodeNumber: number;
  id: string;
  overview: string;
  progress?: number;
  runtime?: number;
  still?: MediaArtwork;
  stillUrl?: string;
  title: string;
  watched?: boolean;
}

export interface SeasonData {
  episodeCount: number;
  episodes: EpisodeData[];
  name: string;
  seasonNumber: number;
  year?: number;
}

export interface MediaDetails {
  backdrop?: MediaArtwork;
  backdropUrl?: string;
  cast: string[];
  creators: string[];
  descriptors: string[];
  genres: string[];
  id: MediaItem['id'];
  logoUrl?: string;
  maturityRating?: string;
  originalTitle?: string;
  overview: string;
  quality: 'HD' | '4K';
  runtime?: number;
  seasons?: SeasonData[];
  similar: MediaItem[];
  title: string;
  tmdbId?: number;
  type: MediaType;
  year?: number;
}

export interface DetailsModalContextValue {
  closeDetails: () => void;
  openDetails: (mediaId: MediaItem['id'], trigger?: HTMLElement | null) => void;
}
