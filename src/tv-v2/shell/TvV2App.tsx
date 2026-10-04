import { useState, useCallback, useEffect } from 'react';
import type { MediaItem } from '../../features/catalog';
import { TvFocusProvider, useTvFocus } from '../focus/TvFocusContext.tsx';
import { tvPreviewManager } from '../previews/TvPreviewManager.ts';
import { TvHomeScreen } from '../screens/TvHomeScreen.tsx';
import { TvDetailScreen } from '../screens/TvDetailScreen.tsx';
import { TvPlayerScreen } from '../player/TvPlayerScreen.tsx';
import { buildVidStuckUrl } from '../../lib/vidstuck/buildPlayerUrl.ts';
import './TvV2Shell.css';

interface PlaybackRequest {
  episode?: number;
  item: MediaItem;
  season?: number;
}

export function TvV2App() {
  return (
    <TvFocusProvider>
      <TvV2Shell />
    </TvFocusProvider>
  );
}

function TvV2Shell() {
  const { engine, pushScope, popScope } = useTvFocus();

  const [activeDetailItem, setActiveDetailItem] = useState<MediaItem | null>(null);
  const [activePlayback, setActivePlayback] = useState<PlaybackRequest | null>(null);
  const [myListIds, setMyListIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('daitign_tv_my_list');
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [savedListItems, setSavedListItems] = useState<MediaItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const rawTv = localStorage.getItem('daitign_tv_my_list_items');
      if (rawTv) {
        const parsed = JSON.parse(rawTv);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const rawWeb = localStorage.getItem('daitign-my-list');
      if (rawWeb) {
        const parsed = JSON.parse(rawWeb);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            backdropUrl: item.backdropUrl,
            genres: item.genres,
            id: item.tmdbId,
            maturityRating: item.maturityRating,
            overview: item.overview,
            posterUrl: item.posterUrl,
            title: item.title,
            tmdbId: item.tmdbId,
            type: item.catalogCategory ?? item.playbackType ?? 'movie',
            year: item.year,
          }));
        }
      }
    } catch {}
    return [];
  });

  const isInList = useCallback(
    (id: string | number) => myListIds.has(String(id)),
    [myListIds]
  );

  const toggleList = useCallback((item: MediaItem) => {
    const strId = String(item.tmdbId ?? item.id);
    setMyListIds((prev) => {
      const next = new Set(prev);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      try {
        localStorage.setItem('daitign_tv_my_list', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    setSavedListItems((prev) => {
      const exists = prev.some((i) => String(i.tmdbId ?? i.id) === strId);
      const next = exists
        ? prev.filter((i) => String(i.tmdbId ?? i.id) !== strId)
        : [item, ...prev];
      try {
        localStorage.setItem('daitign_tv_my_list_items', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const handleOpenDetails = useCallback((item: MediaItem) => {
    pushScope('detail-scope', 'detail-action-play');
    setActiveDetailItem(item);
  }, [pushScope]);

  const handleCloseDetails = useCallback(() => {
    popScope();
    setActiveDetailItem(null);
  }, [popScope]);

  const handlePlay = useCallback((item: MediaItem, episodeInfo?: { episodeNumber: number; seasonNumber: number }) => {
    // Immediately stop any preview
    tvPreviewManager.stopActive();

    const candidateId = item.tmdbId ?? (typeof item.id === 'number' ? item.id : Number(item.id));
    const playbackType = item.type === 'tv' ? 'tv' : 'movie';
    const route = playbackType === 'movie'
      ? { tmdbId: candidateId, type: 'movie' as const }
      : {
          episode: episodeInfo?.episodeNumber ?? 1,
          season: episodeInfo?.seasonNumber ?? 1,
          tmdbId: candidateId,
          type: 'tv' as const,
        };

    // When running inside native Android TV wrapper, hand off playback to the native top-level playerWebView
    // and do NOT use the cross-origin iframe fallback!
    if (typeof window !== 'undefined' && window.AndroidTVBridge?.startTvPlayer) {
      const vidstuckUrl = buildVidStuckUrl(route);
      window.AndroidTVBridge.startTvPlayer(vidstuckUrl, JSON.stringify(route));
      return;
    }

    pushScope('player-scope');
    setActivePlayback({
      episode: episodeInfo?.episodeNumber,
      item,
      season: episodeInfo?.seasonNumber,
    });
  }, [pushScope]);

  const handleExitPlayer = useCallback(() => {
    popScope();
    setActivePlayback(null);
  }, [popScope]);

  // Register back fallback when details screen is open
  useEffect(() => {
    if (activeDetailItem) {
      engine.setOnBackFallback(() => {
        handleCloseDetails();
        return true;
      });
      return () => {
        engine.setOnBackFallback(null);
      };
    }
  }, [activeDetailItem, engine, handleCloseDetails]);

  // Document class indicator for TV V2
  useEffect(() => {
    document.documentElement.classList.add('daitign-tv-v2');
    return () => {
      document.documentElement.classList.remove('daitign-tv-v2');
      tvPreviewManager.stopActive();
    };
  }, []);

  return (
    <div className="tv-v2-root">
      {/* Home Screen Base */}
      <TvHomeScreen
        isInList={isInList}
        myListItems={savedListItems}
        onOpenDetails={handleOpenDetails}
        onPlay={(item) => handlePlay(item)}
        onToggleList={toggleList}
      />

      {/* Detail Overlay */}
      {activeDetailItem && !activePlayback && (
        <TvDetailScreen
          isInList={isInList(activeDetailItem.id)}
          item={activeDetailItem}
          onClose={handleCloseDetails}
          onPlay={(item, ep) => handlePlay(item, ep)}
          onSelectSimilar={(sim) => setActiveDetailItem(sim)}
          onToggleList={toggleList}
        />
      )}

      {/* True Fullscreen 100vw x 100vh Player Layer */}
      {activePlayback && (
        <TvPlayerScreen
          initialEpisode={activePlayback.episode}
          initialSeason={activePlayback.season}
          onExit={handleExitPlayer}
          title={activePlayback.item.title}
          tmdbId={activePlayback.item.tmdbId ?? Number(activePlayback.item.id)}
          type={activePlayback.item.type === 'tv' ? 'tv' : 'movie'}
        />
      )}
    </div>
  );
}
