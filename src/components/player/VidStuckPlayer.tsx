import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { Icon } from '../icons/Icon';
import { Skeleton } from '../primitives/Skeleton';
import { buildVidStuckUrl, type VidStuckPlayerOptions, type VidStuckProgressEvent } from '../../lib/vidstuck';
import { useVidStuckProgress } from './useVidStuckProgress';
import {
  canRequestElementFullscreen,
  exitElementFullscreen,
  isElementFullscreen,
  lockLandscapeOrientation,
  requestElementFullscreen,
  unlockOrientation,
} from './fullscreen';
import './VidStuckPlayer.css';

interface VidStuckPlayerProps {
  onProgress?: (event: VidStuckProgressEvent) => void;
  options: VidStuckPlayerOptions;
  title: string;
}

export interface VidStuckPlayerHandle {
  canRequestFullscreen: () => boolean;
  requestFullscreen: () => Promise<boolean>;
}

export const VidStuckPlayer = forwardRef<VidStuckPlayerHandle, VidStuckPlayerProps>(function VidStuckPlayer(
  { onProgress, options, title },
  forwardedRef,
) {
  const playerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isViewportFullscreen, setIsViewportFullscreen] = useState(false);
  const source = useMemo(() => {
    try {
      return buildVidStuckUrl(options);
    } catch {
      return null;
    }
  }, [options]);

  useVidStuckProgress({ expectedTmdbId: options.tmdbId, frameRef, onProgress });

  useImperativeHandle(forwardedRef, () => ({
    canRequestFullscreen: () => canRequestElementFullscreen(playerRef.current),
    requestFullscreen: () => requestElementFullscreen(playerRef.current),
  }), []);

  useEffect(() => {
    setStatus(source ? 'loading' : 'error');
    if (!source) return;
    const timeout = window.setTimeout(() => setStatus((current) => current === 'loading' ? 'error' : current), 15_000);
    return () => window.clearTimeout(timeout);
  }, [attempt, source]);

  useEffect(() => {
    const syncFullscreenState = () => {
      const isFullscreen = isElementFullscreen(playerRef.current);
      setIsNativeFullscreen(isFullscreen);
      if (!isFullscreen) unlockOrientation();
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!isViewportFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsViewportFullscreen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    void lockLandscapeOrientation();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      unlockOrientation();
    };
  }, [isViewportFullscreen]);

  const toggleFullscreen = async () => {
    if (isViewportFullscreen) {
      setIsViewportFullscreen(false);
      return;
    }

    if (isNativeFullscreen) {
      await exitElementFullscreen();
      return;
    }

    const enteredNativeFullscreen = await requestElementFullscreen(playerRef.current);
    if (!enteredNativeFullscreen) setIsViewportFullscreen(true);
  };

  return (
    <div
      className={`vidstuck-frame${isViewportFullscreen ? ' vidstuck-frame--viewport-fullscreen' : ''}`}
      data-player-status={status}
      ref={playerRef}
    >
      {status === 'loading' && (
        <div className="vidstuck-frame__loading" role="status">
          <Skeleton height="100%" radius="lg" width="100%" />
          <span>Preparing your screening…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="vidstuck-frame__error" role="alert">
          <span>Playback is taking longer than expected.</span>
          <p>Check your connection, then try loading the player again.</p>
          {source && <Button onClick={() => { setAttempt((value) => value + 1); setStatus('loading'); }} size="sm" variant="secondary">Retry player</Button>}
        </div>
      )}
      {source && (
        <iframe
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          key={attempt}
          onError={() => setStatus('error')}
          onLoad={() => setStatus('ready')}
          ref={frameRef}
          referrerPolicy="strict-origin-when-cross-origin"
          src={source}
          title={`${title} video player`}
        />
      )}
      {source && status === 'ready' && (
        <button
          aria-label={isNativeFullscreen || isViewportFullscreen ? 'Exit fullscreen' : 'Enter fullscreen in landscape'}
          className="vidstuck-frame__fullscreen-toggle"
          onClick={() => { void toggleFullscreen(); }}
          type="button"
        >
          <Icon name="fullscreen" size={24} />
        </button>
      )}
    </div>
  );
});
