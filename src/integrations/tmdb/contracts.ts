/** Phase 1 boundary only. A concrete TMDB client is intentionally deferred. */
export interface CatalogItemSummary {
  id: string;
  mediaType: 'movie' | 'series';
  title: string;
  artworkPath: string | null;
  releaseYear: number | null;
}

export interface CatalogItemDetails extends CatalogItemSummary {
  overview: string;
  backdropPath: string | null;
  genres: string[];
  runtimeMinutes: number | null;
}

export interface TmdbCatalogGateway {
  getDetails(id: string, mediaType: CatalogItemSummary['mediaType']): Promise<CatalogItemDetails>;
  getTrending(): Promise<CatalogItemSummary[]>;
  search(query: string): Promise<CatalogItemSummary[]>;
}
