import type { MediaItem } from '../../features/catalog/types.ts';
import {
  isTopTenItem,
  resolveTvFreshnessBadge,
  getFreshnessLabel,
  type TvFreshnessBadgeType,
  type TvBadgeType,
} from './tvMediaBadgeLogic.ts';
import './TvComponents.css';

export { isTopTenItem, resolveTvFreshnessBadge, getFreshnessLabel };
export type { TvFreshnessBadgeType, TvBadgeType };

export interface TvMediaBadgeProps {
  className?: string;
  isRanked?: boolean;
  isPreviewActive?: boolean;
  item: MediaItem;
  layout?: 'solid' | 'split';
}

/**
 * TvMediaBadge: Netflix / TV V1-compatible merchandising badge component.
 * - Top 10: Stacked red corner badge pinned to top-left.
 * - Freshness: Rectangular red label attached flush to the bottom edge of artwork.
 * - Purely informational, non-focusable (data-tv-focusable="false", tabIndex={-1}).
 * - Fades out gracefully when inline video preview is active.
 */
export function TvMediaBadge({
  className = '',
  isRanked = false,
  isPreviewActive = false,
  item,
  layout = 'solid',
}: TvMediaBadgeProps) {
  // If card is already in a ranked row (with giant outline number), suppress duplicate corner badge
  const showTopTen = !isRanked && isTopTenItem(item);
  const freshnessType = resolveTvFreshnessBadge(item);

  if (!showTopTen && !freshnessType) {
    return null;
  }

  const hiddenClass = isPreviewActive ? 'tv-v2-card__badge--hidden' : '';

  return (
    <>
      {/* 1. Top-Left Netflix Top 10 Stacked Corner Badge */}
      {showTopTen && (
        <div
          aria-hidden="true"
          aria-label="Top 10"
          className={`tv-v2-card__top10-badge ${hiddenClass} ${className}`.trim()}
          data-tv-focusable="false"
          tabIndex={-1}
        >
          <span className="tv-v2-card__top10-text">TOP</span>
          <span className="tv-v2-card__top10-rank">10</span>
        </div>
      )}

      {/* 2. Bottom Attached Netflix Freshness Badge */}
      {freshnessType && (
        <div
          aria-hidden="true"
          aria-label={getFreshnessLabel(freshnessType)}
          className={`tv-v2-card__badge-container ${hiddenClass} ${className}`.trim()}
          data-tv-focusable="false"
          tabIndex={-1}
        >
          {layout === 'split' && freshnessType === 'new-episode' ? (
            <div className="tv-v2-card__bottom-badge tv-v2-card__bottom-badge--split">
              <span className="tv-v2-card__badge-segment tv-v2-card__badge-segment--red">
                New Episode
              </span>
              <span className="tv-v2-card__badge-segment tv-v2-card__badge-segment--white">
                Watch Now
              </span>
            </div>
          ) : (
            <div className="tv-v2-card__bottom-badge">
              <span className="tv-v2-card__bottom-badge-text">
                {getFreshnessLabel(freshnessType)}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
