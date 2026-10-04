import { useEffect, useState } from 'react';
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

  const isHero = variant === 'hero' || (aspectRatio === 'full-bleed' && variant !== 'detail');
  const isDetail = variant === 'detail';

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
      tvPreviewManager.stop(id);
    };
  }, [id]);

  const canPlayVideo = Boolean(isActive && videoKey && !hasError);

  const embedUrl = canPlayVideo && videoKey
    ? `https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&playsinline=1&rel=0&loop=1&playlist=${videoKey}&iv_load_policy=3&disablekb=1&modestbranding=1`
    : null;

  return (
    <div
      className={`tv-v2-preview-frame ${isHero ? 'tv-v2-preview-frame--hero' : ''} ${isDetail ? 'tv-v2-preview-frame--detail' : ''} ${className}`.trim()}
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
          className={`tv-v2-preview-video ${isHero ? 'tv-v2-preview-video--full-bleed' : ''} ${isDetail ? 'tv-v2-preview-video--detail' : ''} ${
            hasStarted ? 'tv-v2-preview-video--playing' : ''
          }`.trim()}
        >
          <iframe
            allow="autoplay; encrypted-media"
            className="tv-v2-preview-iframe"
            onError={() => setHasError(true)}
            onLoad={() => setHasStarted(true)}
            src={embedUrl}
            tabIndex={-1}
            title={`${title} trailer preview`}
          />
        </div>
      )}
    </div>
  );
}
