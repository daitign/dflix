import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MediaItem } from '../catalog';
import {
  HOVER_PREVIEW_ACTION_EVENT,
  type HoverPreviewActionDetail,
} from '../hover-preview/types';
import { DetailsModal } from './components/DetailsModal';
import { getMockMediaDetailsById } from './data/mockMediaDetails';
import type { DetailsModalContextValue, MediaDetails } from './types';

const DetailsModalContext = createContext<DetailsModalContextValue | null>(null);

interface DetailsModalProviderProps {
  children: ReactNode;
}

export function DetailsModalProvider({ children }: DetailsModalProviderProps) {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const openDetails = useCallback((mediaId: MediaItem['id'], trigger?: HTMLElement | null) => {
    const nextDetails = getMockMediaDetailsById(mediaId);
    if (!nextDetails) return;
    restoreFocusRef.current = trigger
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDetails(nextDetails);
    setIsOpen(true);
  }, []);

  const closeDetails = useCallback(() => setIsOpen(false), []);

  const clearClosedDetails = useCallback(() => {
    setDetails(null);
    restoreFocusRef.current = null;
  }, []);

  const selectSimilar = useCallback((item: MediaItem) => {
    const nextDetails = getMockMediaDetailsById(item.id);
    if (nextDetails) setDetails(nextDetails);
  }, []);

  useEffect(() => {
    const handlePreviewAction = (event: Event) => {
      const { detail } = event as CustomEvent<HoverPreviewActionDetail>;
      if (detail.action === 'details') openDetails(detail.media.id, detail.trigger);
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
      {details && (
        <DetailsModal
          details={details}
          isOpen={isOpen}
          onAfterClose={clearClosedDetails}
          onClose={closeDetails}
          onSelectSimilar={selectSimilar}
          restoreFocusElement={restoreFocusRef.current}
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
