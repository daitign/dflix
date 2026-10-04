import { useEffect, useState } from 'react';
import type { MediaItem } from '../../features/catalog';
import { getMediaVideos, selectPreviewVideoCandidates } from '../../lib/tmdb/videos';
import { useTvFocusNode } from '../focus/useTvFocus.ts';
import type { Direction } from '../focus/TvFocusEngine.ts';
import { tvPreviewManager } from '../previews/TvPreviewManager.ts';
import { TvPreviewPlayer } from '../previews/TvPreviewPlayer.tsx';
import { TvMediaBadge } from './TvMediaBadge.tsx';
import './TvComponents.css';

interface TvMediaCardProps {
  colIndex: number;
  customNodeId?: string;
  disablePreview?: boolean;
  isRanked?: boolean;
  item: MediaItem;
  onBack?: () => boolean | void;
  onDirection?: (direction: Direction) => boolean | void;
  onFocus?: (item: MediaItem) => void;
  onSelect: (item: MediaItem) => void;
  rank?: number;
  rowId: string;
}

// Module-level cache for resolved trailer video keys
const trailerCache = new Map<string | number, string | null>();

export function TvMediaCard({
  colIndex,
  customNodeId,
  disablePreview = false,
  isRanked = false,
  item,
  onBack,
  onDirection,
  onFocus,
  onSelect,
  rank,
  rowId,
}: TvMediaCardProps) {
  const nodeId = customNodeId || `card-${rowId}-${item.id}`;
  const previewId = `preview-${nodeId}`;

  const { isFocused } = useTvFocusNode({
    colIndex,
    id: nodeId,
    onBack,
    onDirection,
    onFocus: () => onFocus?.(item),
    onSelect: () => onSelect(item),
    rowId,
  });

  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(() => trailerCache.get(item.id) ?? null);

  useEffect(() => {
    if (isFocused && onFocus) {
      onFocus(item);
    }
  }, [isFocused, item, onFocus]);

  // Request preview on focus with 500ms settling delay; cancel immediately on blur
  useEffect(() => {
    if (disablePreview) return;
    if (isFocused) {
      tvPreviewManager.requestPreview(previewId, { delayMs: 500 });
    } else {
      tvPreviewManager.stop(previewId);
      setIsPreviewActive(false);
    }

    return () => {
      tvPreviewManager.stop(previewId);
    };
  }, [disablePreview, isFocused, previewId]);

  // Subscribe to preview manager activations
  useEffect(() => {
    const unsubscribe = tvPreviewManager.subscribe((activeId) => {
      const active = activeId === previewId;
      setIsPreviewActive(active);

      // Only fetch video if active settled preview is triggered AND not yet cached
      if (active) {
        const cachedKey = trailerCache.get(item.id);
        if (cachedKey) {
          setTrailerKey(cachedKey);
          return;
        }

        const playbackType = item.playbackType || (item.type === 'tv' || item.type === 'anime' ? 'tv' : 'movie');
        const tmdbId = item.tmdbId ?? (typeof item.id === 'number' ? item.id : Number.parseInt(String(item.id).replace(/^[a-z]+-/, ''), 10) || null);
        if (!tmdbId) {
          trailerCache.set(item.id, null);
          return;
        }

        getMediaVideos(playbackType, tmdbId)
          .then((videos) => {
            const candidates = selectPreviewVideoCandidates(videos);
            const key = candidates[0]?.key ?? null;
            trailerCache.set(item.id, key);
            setTrailerKey(key);
          })
          .catch(() => {
            trailerCache.set(item.id, null);
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [item, previewId]);

  const posterUrl = item.poster?.fallback || item.posterUrl || item.backdropUrl || '';
  const backdropUrl = item.backdrop?.fallback || item.backdropUrl || posterUrl;

  const isDoubleDigit = rank === 10;
  const isRankOne = rank === 1;
  const isExpanded = !disablePreview && isFocused;

  return (
    <div
      className={`tv-v2-card ${isRanked ? 'tv-v2-card--ranked' : ''} ${
        isRankOne ? 'tv-v2-card--rank-1' : ''
      } ${isDoubleDigit ? 'tv-v2-card--double-digit' : ''} ${
        isFocused ? 'tv-v2-card--focused' : ''
      } ${isExpanded ? 'tv-v2-card--expanded' : ''}`.trim()}
      data-card-id={item.id}
      data-testid={nodeId}
      data-tv-expanded={isExpanded ? 'true' : 'false'}
      data-tv-focusable="true"
      id={nodeId}
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
    >
      {/* Top 10 Rank Digit */}
      {isRanked && rank !== undefined && (
        <span aria-hidden="true" className={`tv-v2-card__rank ${isDoubleDigit ? 'tv-v2-card__rank--double' : ''}`}>
          {rank}
        </span>
      )}

      {/* In-Row Card Surface */}
      <div className="tv-v2-card__surface">
        {/* Background Artwork: fills surface immediately with seamless transition */}
        <img
          alt={item.title}
          className="tv-v2-card__image"
          loading="lazy"
          src={isExpanded ? (backdropUrl || posterUrl) : posterUrl}
        />

        {/* Video Layer: mounted inside card surface, fades in when playing */}
        {isExpanded && isPreviewActive && trailerKey && (
          <div aria-hidden="true" className="tv-v2-card__video-layer">
            <TvPreviewPlayer
              aspectRatio="16/9"
              backdropUrl={backdropUrl}
              id={previewId}
              title={item.title}
              variant="card"
              videoKey={trailerKey}
            />
          </div>
        )}

        {/* Cinematic Vignette Scrim when expanded */}
        {isExpanded && <div className="tv-v2-card__scrim" />}

        {/* In-Row Title and Metadata */}
        {isExpanded && (
          <div className="tv-v2-card__info">
            <span className="tv-v2-card__info-title">{item.title}</span>
            <div className="tv-v2-card__info-meta">
              {item.rating && <span className="tv-v2-card__info-rating">{item.rating}</span>}
              {item.year && <span>{item.year}</span>}
            </div>
          </div>
        )}

        {/* TV V1 / Netflix-Style Media Badges */}
        <TvMediaBadge
          isRanked={isRanked}
          isPreviewActive={isExpanded && isPreviewActive && Boolean(trailerKey)}
          item={item}
        />
      </div>
    </div>
  );
}
