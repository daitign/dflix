import { useEffect, useRef, useState } from 'react';
import { isTVPreviewDiagnosticsEnabled, logTVPreviewStage } from '../../features/hover-preview/tvPreviewDiagnostics';
import { tvPreviewManager } from './TvPreviewManager.ts';
import './TvPreviewPlayer.css';

interface TvPreviewPlayerProps {
  aspectRatio?: '16/9' | 'cinematic' | 'full-bleed';
  backdropUrl?: string;
  className?: string;
  id: string;
  title: string;
  variant?: 'hero' | 'card' | 'detail' | 'default';
  videoKey?: string | null;
}

export function TvPreviewPlayer({
  aspectRatio = '16/9',
  backdropUrl,
  className = '',
  id,
  title,
  variant = 'default',
  videoKey,
}: TvPreviewPlayerProps) {
  const [isActive, setIsActive] = useState(() => tvPreviewManager.isPreviewActive(id));
  const [isMuted, setIsMuted] = useState(() => tvPreviewManager.getIsMuted());
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isHero = variant === 'hero' || (aspectRatio === 'full-bleed' && variant !== 'detail');
  const isDetail = variant === 'detail';

  // For Hero on initial cold TV launch before any remote keypress, start muted to guarantee
  // Android WebView Chromium autoplay policy is never violated.
  const hasUserInteracted = tvPreviewManager.getHasUserInteracted();
  const startMuted = isMuted || (!hasUserInteracted && isHero);

  useEffect(() => {
    const unsubscribe = tvPreviewManager.subscribe((activeId, muted) => {
      const currentlyActive = activeId === id;
      setIsActive(currentlyActive);
      setIsMuted(muted);
      if (!currentlyActive) {
        setHasStarted(false);
      }
    });

    return () => {
      unsubscribe();
      // Note: Do NOT call tvPreviewManager.stop(id) here; lifecycle ownership belongs to
      // the parent component (TvMediaCard or TvHero), preventing unmount race conditions.
    };
  }, [id]);

  // Listen for first remote interaction to smoothly un-mute hero if sound is preferred
  useEffect(() => {
    if (!startMuted || isMuted) return;

    const handleFirstInteraction = () => {
      tvPreviewManager.setHasUserInteracted(true);
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute' }),
          '*'
        );
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
          '*'
        );
      } catch {}
    };

    window.addEventListener('keydown', handleFirstInteraction, { once: true, capture: true });
    return () => {
      window.removeEventListener('keydown', handleFirstInteraction, { capture: true });
    };
  }, [startMuted, isMuted]);

  const canPlayVideo = Boolean(isActive && videoKey && !hasError);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = canPlayVideo && videoKey
    ? `https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&mute=${
        startMuted ? 1 : 0
      }&enablejsapi=1&origin=${encodeURIComponent(
        origin
      )}&controls=0&playsinline=1&rel=0&loop=1&playlist=${videoKey}&iv_load_policy=3&disablekb=1&modestbranding=1`
    : null;

  // Diagnostics and iframe handshake
  useEffect(() => {
    if (!embedUrl) return;

    if (isTVPreviewDiagnosticsEnabled()) {
      logTVPreviewStage(`Preview mounting for ${id}`, { isHero, startMuted, videoKey });
    }

    // Safety watchdog: ensure trailer reveals after settling delay if load event is deferred
    const watchdog = setTimeout(() => {
      setHasStarted(true);
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo' }),
          '*'
        );
      } catch {}
    }, 1500);

    // Listen for YouTube postMessage state updates
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'onStateChange') {
          // 1 = PLAYING
          if (data.info === 1) {
            setHasStarted(true);
            if (isTVPreviewDiagnosticsEnabled()) {
              logTVPreviewStage(`Preview playing for ${id}`, { videoKey });
            }
          }
          // 2 = PAUSED, 5 = CUED (Autoplay policy fallback: recover by muting and forcing play)
          if (data.info === 2 || data.info === 5) {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'mute' }),
              '*'
            );
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo' }),
              '*'
            );
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimeout(watchdog);
      window.removeEventListener('message', handleMessage);
    };
  }, [embedUrl, id, isHero, startMuted, videoKey]);

  const handleIframeLoad = () => {
    setHasStarted(true);
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening' }),
        '*'
      );
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo' }),
        '*'
      );
    } catch {}
  };

  return (
    <div
      className={`tv-v2-preview-frame ${isHero ? 'tv-v2-preview-frame--hero' : ''} ${
        isDetail ? 'tv-v2-preview-frame--detail' : ''
      } ${className}`.trim()}
    >
      {/* Fallback Artwork Layer */}
      {backdropUrl && (
        <img
          alt=""
          aria-hidden="true"
          className={`tv-v2-preview-backdrop ${hasStarted ? 'tv-v2-preview-backdrop--hidden' : ''}`}
          loading="lazy"
          src={backdropUrl}
        />
      )}

      {/* Video Layer: uncropped 16:9 */}
      {embedUrl && (
        <div
          className={`tv-v2-preview-video ${isHero ? 'tv-v2-preview-video--full-bleed' : ''} ${
            isDetail ? 'tv-v2-preview-video--detail' : ''
          } ${hasStarted ? 'tv-v2-preview-video--playing' : ''}`.trim()}
        >
          <iframe
            allow="autoplay; encrypted-media"
            className="tv-v2-preview-iframe"
            onError={() => {
              setHasError(true);
              if (isTVPreviewDiagnosticsEnabled()) {
                logTVPreviewStage(`Preview error for ${id}`);
              }
            }}
            onLoad={handleIframeLoad}
            ref={iframeRef}
            src={embedUrl}
            tabIndex={-1}
            title={`${title} trailer preview`}
          />
        </div>
      )}
    </div>
  );
}
