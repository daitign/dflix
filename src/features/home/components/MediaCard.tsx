import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import { getFreshnessBadge, type MediaItem } from '../../catalog';
import { toMediaPreviewData, useHoverPreviewAnchor } from '../../hover-preview';
import { FreshnessBadge } from './StatusBadge';
import './MediaCard.css';

interface MediaCardProps {
  cardIndex?: number;
  item: MediaItem;
}

export function MediaCard({ cardIndex, item }: MediaCardProps) {
  const artwork = item.backdrop;
  const { anchorProps, anchorRef, referenceRef } = useHoverPreviewAnchor<HTMLElement>({
    data: toMediaPreviewData(item),
  });

  const freshnessBadge = getFreshnessBadge(item);
  const hasBadge = Boolean(freshnessBadge);

  return (
    <article
      className={`media-card${hasBadge ? ' media-card--has-badge' : ''}`}
      data-card-index={cardIndex}
      data-media-id={item.id}
      ref={referenceRef}
    >
      <button
        {...anchorProps}
        aria-label={`View ${item.title}`}
        className="media-card__surface"
        data-card-index={cardIndex}
        data-media-id={item.id}
        data-tv-card="true"
        data-tv-focusable="true"
        ref={anchorRef}
        type="button"
      >
        <ResponsiveImage
          alt=""
          fallbackLabel={`${item.title} artwork unavailable`}
          sizes="(max-width: 767px) 47vw, (max-width: 1279px) 24vw, 16vw"
          sources={artwork ? [{ srcSet: artwork.srcSet, type: artwork.type }] : []}
          src={artwork?.fallback ?? item.backdropUrl ?? ''}
        />
        <span aria-hidden="true" className="media-card__shade" />
        <div className="media-card__title-overlay">
          <h4>{item.title}</h4>
        </div>
        {item.inTopTen && (
          <div aria-label="Top 10" className="media-card__top10-badge">
            <span className="media-card__top10-text">TOP</span>
            <span className="media-card__top10-rank">10</span>
          </div>
        )}
        {hasBadge && (
          <div className="media-card__badge-container">
            <FreshnessBadge layout="inline" item={item} status={freshnessBadge} />
          </div>
        )}
      </button>
    </article>
  );
}
