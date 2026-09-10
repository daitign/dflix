export interface PlayerSource {
  catalogId: string;
  mediaType: 'movie' | 'series';
  season?: number;
  episode?: number;
}

/** Service-specific URL construction stays behind this interface. */
export interface VidstuckUrlBuilder {
  build(source: PlayerSource): string;
}
