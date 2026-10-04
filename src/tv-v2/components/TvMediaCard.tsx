import { useEffect, useState } from 'react';
import type { MediaItem } from '../../features/catalog';
import { getMediaVideos, selectPreviewVideoCandidates } from '../../lib/tmdb/videos';
import { useTvFocusNode } from '../focus/useTvFocus.ts';
import { tvPreviewManager } from '../previews/TvPreviewManager.ts';
import { TvPreviewPlayer } from '../previews/TvPreviewPlayer.tsx';
import './TvComponents.css';

interface TvMediaCardProps {
  colIndex: number;
  customNodeId?: string;
  isRanked?: boolean;
  item: MediaItem;
  onBack?: () => boolean | void;
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
  isRanked = false,
  item,
  onBack,
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
    if (isFocused) {
      tvPreviewManager.requestPreview(previewId, { delayMs: 500 });
    } else {
      tvPreviewManager.stop(previewId);
      setIsPreviewActive(false);
    }

    return () => {
      tvPreviewManager.stop(previewId);
    };
  }, [isFocused, previewId]);

  // Subscribe to preview manager activations
  useEffect(() => {
    const unsubscribe = tvPreviewManager.subscribe((activeId) => {
      const active = activeId === previewId;
      setIsPreviewActive(active);

      // Only fetch video if active settled preview is triggered AND not yet cached
      if (active) {
        if (trailerCache.has(item.id)) {
          setTrailerKey(trailerCache.get(item.id) ?? null);
          return;
        }

        const playbackType = item.type === 'tv' ? 'tv' : 'movie';
        const tmdbId = item.tmdbId ?? (typeof item.id === 'number' ? item.id : null);
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

  return (
    <div
      className={`tv-v2-card ${isRanked ? 'tv-v2-card--ranked' : ''} ${
        isRankOne ? 'tv-v2-card--rank-1' : ''
      } ${isDoubleDigit ? 'tv-v2-card--double-digit' : ''} ${
        isFocused ? 'tv-v2-card--focused' : ''
      }`.trim()}
      data-card-id={item.id}
      data-testid={nodeId}
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

      {/* Poster Image Layer */}
      <div className="tv-v2-card__surface">
        <img
          alt={item.title}
          className="tv-v2-card__image"
          loading="lazy"
          src={posterUrl}
        />
        {item.badge && (
          <span className="tv-v2-card__badge">
            {item.badge === 'top-10' ? 'TOP 10' : item.badge.toUpperCase()}
          </span>
        )}
      </div>

      {/* Elevated 16:9 Cinematic Preview Tile (Active after 500ms focus settle) */}
      {isFocused && isPreviewActive && (
        <div aria-hidden="true" className="tv-v2-card-preview-tile">
          <TvPreviewPlayer
            aspectRatio="16/9"
            backdropUrl={backdropUrl}
            id={previewId}
            title={item.title}
            variant="card"
            videoKey={trailerKey}
          />
          <div className="tv-v2-card-preview-tile__scrim" />
          <div className="tv-v2-card-preview-tile__info">
            <span className="tv-v2-card-preview-tile__title">{item.title}</span>
            <div className="tv-v2-card-preview-tile__meta">
              {item.rating && <span className="tv-v2-card-preview-tile__rating">{item.rating}</span>}
              {item.year && <span>{item.year}</span>}
              {item.badge && (
                <span className="tv-v2-card-preview-tile__badge">
                  {item.badge === 'top-10' ? 'TOP 10' : item.badge.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
