export interface TmdbPagedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMediaSummary {
  adult?: boolean;
  backdrop_path: string | null;
  first_air_date?: string;
  genre_ids?: number[];
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  name?: string;
  original_language?: string;
  original_name?: string;
  original_title?: string;
  overview?: string;
  poster_path: string | null;
  release_date?: string;
  title?: string;
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbImage {
  aspect_ratio: number;
  file_path: string;
  iso_639_1: string | null;
  vote_average: number;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  order?: number;
  profile_path?: string | null;
}

export interface TmdbCrewMember {
  id: number;
  job: string;
  name: string;
}

export interface TmdbSeasonSummary {
  air_date?: string;
  episode_count: number;
  id: number;
  name: string;
  poster_path: string | null;
  season_number: number;
}

export interface TmdbMovieDetails extends TmdbMediaSummary {
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  genres: TmdbGenre[];
  images?: { backdrops: TmdbImage[]; logos: TmdbImage[]; posters: TmdbImage[] };
  recommendations?: TmdbPagedResponse<TmdbMediaSummary>;
  release_dates?: {
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{ certification: string; type: number }>;
    }>;
  };
  runtime?: number | null;
  similar?: TmdbPagedResponse<TmdbMediaSummary>;
}

export interface TmdbTvDetails extends TmdbMediaSummary {
  content_ratings?: { results: Array<{ iso_3166_1: string; rating: string }> };
  created_by?: Array<{ id: number; name: string }>;
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  episode_run_time?: number[];
  genres: TmdbGenre[];
  images?: { backdrops: TmdbImage[]; logos: TmdbImage[]; posters: TmdbImage[] };
  number_of_seasons: number;
  recommendations?: TmdbPagedResponse<TmdbMediaSummary>;
  seasons: TmdbSeasonSummary[];
  similar?: TmdbPagedResponse<TmdbMediaSummary>;
}

export interface TmdbEpisode {
  air_date?: string;
  episode_number: number;
  id: number;
  name?: string;
  overview?: string;
  runtime?: number | null;
  season_number: number;
  still_path: string | null;
}

export interface TmdbSeasonDetails {
  air_date?: string;
  episodes: TmdbEpisode[];
  id: number;
  name: string;
  overview?: string;
  poster_path: string | null;
  season_number: number;
}

export interface TmdbVideo {
  id: string;
  iso_3166_1?: string;
  iso_639_1?: string;
  key: string;
  name: string;
  official: boolean;
  published_at?: string;
  site: string;
  size?: number;
  type: string;
}

export interface TmdbVideoResponse {
  id: number;
  results: TmdbVideo[];
}
