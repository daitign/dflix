import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { navigateToWatch } from '../../lib/navigation/watchRoutes';
import { getMediaDetails, getMediaIdentity, getMediaSeason } from '../../lib/tmdb';
import type { MediaItem } from '../catalog';
import {
  HOVER_PREVIEW_ACTION_EVENT,
  type HoverPreviewActionDetail,
} from '../hover-preview/types';
import { usePreviewAudio } from '../preview-audio';
import { DetailsModal } from './components/DetailsModal';
import type { DetailsModalContextValue, MediaDetails, SeasonData } from './types';
import { registerTVBackHandler } from '../../lib/tv';

const DetailsModalContext = createContext<DetailsModalContextValue | null>(null);

interface DetailsModalProviderProps {
  children: ReactNode;
}

export function DetailsModalProvider({ children }: DetailsModalProviderProps) {
  const { setModalActive } = usePreviewAudio();
  const [sourceMedia, setSourceMedia] = useState<MediaItem | null>(null);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [detailsError, setDetailsError] = useState('');
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setModalActive(isOpen);
    return () => setModalActive(false);
  }, [isOpen, setModalActive]);
  const [seasonLoading, setSeasonLoading] = useState<number | null>(null);
  const [seasonError, setSeasonError] = useState<{ message: string; seasonNumber: number } | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const requestVersionRef = useRef(0);
  const seasonCacheRef = useRef(new Map<string, SeasonData>());

  const loadDetails = useCallback(async (media: MediaItem) => {
    const identity = getMediaIdentity(media);
    const version = ++requestVersionRef.current;
    setSourceMedia(media);
    setDetails(null);
    setDetailsError('');
    setIsDetailsLoading(true);
    setSeasonError(null);
    setSeasonLoading(null);
    seasonCacheRef.current.clear();

    if (!identity) {
      setIsDetailsLoading(false);
      setDetailsError('This title does not have a valid playback identifier.');
      return;
    }

    try {
      const nextDetails = await getMediaDetails(identity);
      if (requestVersionRef.current !== version) return;
      setDetails(nextDetails);
    } catch (error) {
      if (requestVersionRef.current !== version) return;
      setDetailsError(error instanceof Error ? error.message : 'Title details are temporarily unavailable.');
    } finally {
      if (requestVersionRef.current === version) setIsDetailsLoading(false);
    }
  }, []);

  const openDetails = useCallback((media: MediaItem, trigger?: HTMLElement | null) => {
    restoreFocusRef.current = trigger
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setIsOpen(true);
    void loadDetails(media);
  }, [loadDetails]);

  const closeDetails = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    return registerTVBackHandler(() => {
      closeDetails();
      return true;
    });
  }, [isOpen, closeDetails]);

  const clearClosedDetails = useCallback(() => {
    requestVersionRef.current += 1;
    setSourceMedia(null);
    setDetails(null);
    setDetailsError('');
    setIsDetailsLoading(false);
    setSeasonLoading(null);
    setSeasonError(null);
    seasonCacheRef.current.clear();
    restoreFocusRef.current = null;
  }, []);

  const selectSimilar = useCallback((item: MediaItem) => {
    void loadDetails(item);
  }, [loadDetails]);

  const loadSeason = useCallback(async (seasonNumber: number) => {
    if (!details?.tmdbId || details.playbackType !== 'tv') return;
    const key = `${details.tmdbId}:${seasonNumber}`;
    const cached = seasonCacheRef.current.get(key);
    if (cached) {
      setDetails((current) => current ? {
        ...current,
        seasons: current.seasons?.map((season) => season.seasonNumber === seasonNumber ? cached : season),
      } : current);
      return;
    }

    setSeasonLoading(seasonNumber);
    setSeasonError(null);
    const expectedId = details.tmdbId;
    try {
      const season = await getMediaSeason(expectedId, seasonNumber);
      seasonCacheRef.current.set(key, season);
      setDetails((current) => current?.tmdbId === expectedId ? {
        ...current,
        seasons: current.seasons?.map((entry) => entry.seasonNumber === seasonNumber ? season : entry),
      } : current);
    } catch (error) {
      setSeasonError({
        message: error instanceof Error ? error.message : 'This season is temporarily unavailable.',
        seasonNumber,
      });
    } finally {
      setSeasonLoading((current) => current === seasonNumber ? null : current);
    }
  }, [details]);

  const playTitle = useCallback(() => {
    if (!details) return;
    closeDetails();
    navigateToWatch(details);
  }, [closeDetails, details]);

  const playEpisode = useCallback((seasonNumber: number, episodeNumber: number, episodeTitle: string) => {
    if (!details) return;
    closeDetails();
    navigateToWatch(details, {
      episode: episodeNumber,
      episodeLabel: `S${seasonNumber}:E${episodeNumber} · ${episodeTitle}`,
      season: seasonNumber,
    });
  }, [closeDetails, details]);

  useEffect(() => {
    const handlePreviewAction = (event: Event) => {
      const { detail } = event as CustomEvent<HoverPreviewActionDetail>;
      if (detail.action === 'details') openDetails(detail.media, detail.trigger);
    };

    window.addEventListener(HOVER_PREVIEW_ACTION_EVENT, handlePreviewAction);
    return () => window.removeEventListener(HOVER_PREVIEW_ACTION_EVENT, handlePreviewAction);
  }, [openDetails]);

  const contextValue = useMemo<DetailsModalContextValue>(() => ({
    closeDetails,
    openDetails,
  }), [closeDetails, openDetails]);

  return (
    <DetailsModalContext.Provider value={contextValue}>
      {children}
      {(sourceMedia || detailsError) && (
        <DetailsModal
          details={details}
          error={detailsError}
          isLoading={isDetailsLoading}
          isOpen={isOpen}
          onAfterClose={clearClosedDetails}
          onClose={closeDetails}
          onLoadSeason={loadSeason}
          onPlayEpisode={playEpisode}
          onPlayTitle={playTitle}
          onRetry={() => sourceMedia && void loadDetails(sourceMedia)}
          onSelectSimilar={selectSimilar}
          restoreFocusElement={restoreFocusRef.current}
          seasonError={seasonError}
          seasonLoading={seasonLoading}
          title={sourceMedia?.title ?? 'Title details'}
        />
      )}
    </DetailsModalContext.Provider>
  );
}

export function useDetailsModal() {
  const context = useContext(DetailsModalContext);
  if (!context) throw new Error('useDetailsModal must be used within DetailsModalProvider.');
  return context;
}
