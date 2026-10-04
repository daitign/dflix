import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildVidStuckUrl, type VidStuckPlayerOptions, type VidStuckProgressEvent } from '../../lib/vidstuck';
import { useVidStuckProgress } from '../../components/player/useVidStuckProgress';
import { useTvFocus } from '../focus/TvFocusContext.tsx';
import { parseTvKeyEvent } from '../focus/TvFocusEngine.ts';
import './TvPlayer.css';

interface TvPlayerScreenProps {
  initialEpisode?: number;
  initialSeason?: number;
  onExit: () => void;
  onProgress?: (event: VidStuckProgressEvent) => void;
  title: string;
  tmdbId: number;
  type: 'movie' | 'tv';
}

export function TvPlayerScreen({
  initialEpisode = 1,
  initialSeason = 1,
  onExit,
  onProgress,
  title,
  tmdbId,
  type,
}: TvPlayerScreenProps) {
  const { engine } = useTvFocus();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // VidStuck iframe URL for movie or TV show with original provider parameters
  const playerOptions: VidStuckPlayerOptions = useMemo(() => (
    type === 'movie'
      ? { tmdbId, type: 'movie' as const }
      : { episode: initialEpisode, season: initialSeason, tmdbId, type: 'tv' as const }
  ), [initialEpisode, initialSeason, tmdbId, type]);

  const sourceUrl = useMemo(() => {
    try {
      return buildVidStuckUrl(playerOptions);
    } catch {
      return '';
    }
  }, [playerOptions]);

  // Safety guard: if native Android TV bridge is present, hand off and do NOT render iframe
  useEffect(() => {
    if (typeof window !== 'undefined' && window.AndroidTVBridge?.startTvPlayer && sourceUrl) {
      window.AndroidTVBridge.startTvPlayer(sourceUrl, JSON.stringify(playerOptions));
      onExit();
    }
  }, [playerOptions, onExit, sourceUrl]);

  // Track progress from VidStuck player messages (watch-history telemetry only)
  useVidStuckProgress({
    expectedTmdbId: tmdbId,
    frameRef,
    onProgress,
  });

  if (typeof window !== 'undefined' && window.AndroidTVBridge?.startTvPlayer) {
    return null;
  }

  // Focus management: focus iframe on mount
  useEffect(() => {
    const focusIframe = () => {
      if (frameRef.current) {
        try {
          frameRef.current.focus();
        } catch {}
      }
    };

    focusIframe();
    const timer = setTimeout(focusIframe, 100);
    return () => clearTimeout(timer);
  }, []);

  // Focus management: focus iframe again after onLoad
  const handleIFrameLoad = useCallback(() => {
    setIsLoading(false);
    if (frameRef.current) {
      try {
        frameRef.current.focus();
      } catch {}
    }
  }, []);

  // Lock background scroll on mount
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('tv-v2-player-active');

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('tv-v2-player-active');
    };
  }, []);

  // Remote key handling:
  // Suspend outer TV browse navigation; Back exits player and restores focus;
  // all player keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter, Space, Tab) pass to the iframe
  useEffect(() => {
    const handlePlayerKeyDown = (event: KeyboardEvent): boolean => {
      const action = parseTvKeyEvent(event);

      // Hierarchical Back handling: exit playback and restore browse focus
      if (action === 'back') {
        event.preventDefault();
        event.stopPropagation();
        onExit();
        return true;
      }

      // Suspend outer TV browse spatial navigation while player is active.
      // Returning true claims the event so TvFocusEngine never moves browse focus,
      // while NOT calling preventDefault allows the browser to deliver the key
      // (Arrow keys, Enter, Space, Tab) directly to the focused player iframe.
      const key = event.key;
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'Enter' ||
        key === ' ' ||
        key === 'Tab' ||
        action === 'up' ||
        action === 'down' ||
        action === 'left' ||
        action === 'right' ||
        action === 'select'
      ) {
        return true;
      }

      return false;
    };

    engine.setCustomKeyHandler(handlePlayerKeyDown);
    return () => {
      engine.setCustomKeyHandler(null);
    };
  }, [engine, onExit]);

  return (
    <div className="tv-v2-fullscreen-player" data-testid="tv-v2-fullscreen-player">
      {/* 100vw x 100vh Fullscreen Video Player Iframe - Owns Keyboard Focus */}
      {sourceUrl ? (
        <iframe
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className="tv-v2-fullscreen-player__iframe"
          data-testid="tv-v2-player-iframe"
          onLoad={handleIFrameLoad}
          ref={frameRef}
          referrerPolicy="strict-origin-when-cross-origin"
          src={sourceUrl}
          tabIndex={0}
          title={`${title} video player`}
        />
      ) : (
        <div className="tv-v2-fullscreen-player__error">
          <span>Unable to load video playback stream.</span>
        </div>
      )}

      {/* Non-blocking subtle loading indicator */}
      {isLoading && (
        <div aria-hidden="true" className="tv-v2-fullscreen-player__loading">
          <div className="tv-v2-loading-spinner" />
          <span>Connecting to player…</span>
        </div>
      )}
    </div>
  );
}
