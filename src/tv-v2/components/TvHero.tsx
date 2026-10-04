import { useEffect, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import type { MediaItem } from '../../features/catalog';
import { getMediaVideos, selectPreviewVideoCandidates } from '../../lib/tmdb/videos';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import { tvPreviewManager } from '../previews/TvPreviewManager.ts';
import { TvPreviewPlayer } from '../previews/TvPreviewPlayer.tsx';
import './TvComponents.css';

interface TvHeroProps {
  isInList: boolean;
  item: MediaItem;
  onOpenDetails: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  onToggleList: (item: MediaItem) => void;
}

export function TvHero({
  isInList,
  item,
  onOpenDetails,
  onPlay,
  onToggleList,
}: TvHeroProps) {
  useTvFocusRow({ id: 'hero-row', order: 1 });

  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  // Fetch TMDB trailer video
  useEffect(() => {
    let active = true;
    const tmdbId = item.tmdbId ?? (typeof item.id === 'number' ? item.id : null);
    if (!tmdbId) return;

    getMediaVideos(item.type === 'tv' ? 'tv' : 'movie', tmdbId)
      .then((videos) => {
        if (!active) return;
        const candidates = selectPreviewVideoCandidates(videos);
        if (candidates.length > 0 && candidates[0].key) {
          setTrailerKey(candidates[0].key);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [item]);

  const previewId = `hero-${item.id}`;
  const [isHeroActive, setIsHeroActive] = useState(() => tvPreviewManager.isPreviewActive(previewId));

  // Subscribe to preview manager state
  useEffect(() => {
    const unsubscribe = tvPreviewManager.subscribe((activeId) => {
      setIsHeroActive(activeId === previewId);
    });

    return () => {
      unsubscribe();
    };
  }, [previewId]);

  // Register Hero as baseline preview once trailer key resolves
  useEffect(() => {
    if (trailerKey) {
      tvPreviewManager.registerHero(previewId, { delayMs: 400 });
    }

    return () => {
      tvPreviewManager.unregisterHero(previewId);
    };
  }, [previewId, trailerKey]);

  const backdropUrl = item.backdrop?.fallback || item.backdropUrl || '';

  return (
    <section className="tv-v2-hero" data-hero-id={item.id} data-row-id="hero-row">
      {/* Background Trailer Player / Static Backdrop */}
      {isHeroActive && trailerKey ? (
        <TvPreviewPlayer
          aspectRatio="full-bleed"
          backdropUrl={backdropUrl}
          id={previewId}
          title={item.title}
          variant="hero"
          videoKey={trailerKey}
        />
      ) : (
        <img
          alt=""
          aria-hidden="true"
          className="tv-v2-hero__backdrop-img"
          loading="eager"
          src={backdropUrl}
        />
      )}

      {/* Cinematic Gradient Washes */}
      <div className="tv-v2-hero__vignette" />

      {/* Hero Content Overlay */}
      <div className="tv-v2-hero__content">
        <div className="tv-v2-hero__badge">
          <span>FEATURED</span>
        </div>

        <h1 className="tv-v2-hero__title">{item.title}</h1>

        <div className="tv-v2-hero__meta">
          {item.rating && <span className="tv-v2-hero__rating">{item.rating}</span>}
          {item.year && <span className="tv-v2-hero__year">{item.year}</span>}
          {item.genres && item.genres.length > 0 && (
            <span className="tv-v2-hero__genres">{item.genres.slice(0, 3).join(' • ')}</span>
          )}
        </div>

        {item.overview && (
          <p className="tv-v2-hero__overview">{item.overview}</p>
        )}

        {/* Action Buttons */}
        <div className="tv-v2-hero__actions">
          <HeroActionButton
            colIndex={0}
            icon={<Icon name="play" size={22} />}
            id="hero-play"
            label="Play"
            onSelect={() => onPlay(item)}
            primary
          />

          <HeroActionButton
            colIndex={1}
            icon={<Icon name="info" size={20} />}
            id="hero-details"
            label="More Info"
            onSelect={() => onOpenDetails(item)}
          />

          <HeroActionButton
            colIndex={2}
            icon={<Icon name={isInList ? 'check' : 'plus'} size={20} />}
            id="hero-list"
            label={isInList ? 'In My List' : 'My List'}
            onSelect={() => onToggleList(item)}
          />
        </div>
      </div>
    </section>
  );
}

function HeroActionButton({
  colIndex,
  icon,
  id,
  label,
  onSelect,
  primary = false,
}: {
  colIndex: number;
  icon: React.ReactNode;
  id: string;
  label: string;
  onSelect: () => void;
  primary?: boolean;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id,
    onSelect,
    rowId: 'hero-row',
  });

  return (
    <div
      className={`tv-v2-hero-btn ${primary ? 'tv-v2-hero-btn--primary' : ''} ${
        isFocused ? 'tv-v2-hero-btn--focused' : ''
      }`}
      id={id}
      onClick={onSelect}
      role="button"
      tabIndex={-1}
    >
      <span className="tv-v2-hero-btn__icon">{icon}</span>
      <span className="tv-v2-hero-btn__label">{label}</span>
    </div>
  );
}
