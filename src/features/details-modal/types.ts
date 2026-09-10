import type { MediaArtwork, MediaItem, MediaType } from '../catalog';

export interface EpisodeData {
  airDate?: string;
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
  airDate?: string;
  episodeCount: number;
  episodes?: EpisodeData[];
  name: string;
  posterUrl?: string;
  seasonNumber: number;
  year?: number;
}

export interface MediaDetails {
  backdrop?: MediaArtwork;
  backdropUrl?: string;
  cast: string[];
  catalogCategory: MediaType;
  creators: string[];
  descriptors: string[];
  genres: string[];
  id: MediaItem['id'];
  logoUrl?: string;
  maturityRating?: string;
  originalTitle?: string;
  overview: string;
  playbackType: 'movie' | 'tv';
  poster?: MediaArtwork;
  posterUrl?: string;
  quality: 'HD' | '4K';
  runtime?: number;
  seasons?: SeasonData[];
  similar: MediaItem[];
  title: string;
  tmdbId?: number;
  type: MediaType;
  voteAverage?: number;
  year?: number;
}

export interface DetailsModalContextValue {
  closeDetails: () => void;
  openDetails: (media: MediaItem, trigger?: HTMLElement | null) => void;
}
