/** Phase 1 boundary only. Authentication and persistence are intentionally deferred. */
export interface ViewerProfile {
  avatarUrl: string | null;
  displayName: string;
  id: string;
}

export interface SavedTitle {
  catalogId: string;
  createdAt: string;
  mediaType: 'movie' | 'series';
}

export interface SupabaseViewerGateway {
  getCurrentProfile(): Promise<ViewerProfile | null>;
  getSavedTitles(profileId: string): Promise<SavedTitle[]>;
  removeSavedTitle(profileId: string, catalogId: string): Promise<void>;
  saveTitle(profileId: string, title: Omit<SavedTitle, 'createdAt'>): Promise<void>;
}
