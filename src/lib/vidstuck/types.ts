export type VidStuckMediaType = 'movie' | 'tv';

export interface VidStuckPlayerOptions {
  autoplayNextEpisode?: boolean;
  branding?: string;
  color?: string;
  episode?: number;
  episodeSelector?: boolean;
  nextEpisode?: boolean;
  overlay?: boolean;
  progress?: number;
  season?: number;
  server?: string;
  subtitle?: string;
  tmdbId: number;
  type: VidStuckMediaType;
}

export interface VidStuckProgressEvent {
  duration: number;
  episode?: number;
  id: number | string;
  progress: number;
  season?: number;
  timestamp: number;
  type: VidStuckMediaType;
}
