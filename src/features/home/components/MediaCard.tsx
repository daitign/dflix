import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { MediaItem } from '../../catalog';
import { toMediaPreviewData, useHoverPreviewAnchor } from '../../hover-preview';
import { StatusBadge } from './StatusBadge';
import './MediaCard.css';

interface MediaCardProps {
  item: MediaItem;
}

export function MediaCard({ item }: MediaCardProps) {
  const artwork = item.backdrop;
  const { anchorProps, anchorRef, referenceRef } = useHoverPreviewAnchor<HTMLElement>({
    data: toMediaPreviewData(item),
  });

  return (
    <article className="media-card" ref={referenceRef}>
      <button
        {...anchorProps}
        aria-label={`View ${item.title}`}
        className="media-card__surface"
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
        {item.badge && (
          <span className="media-card__badge"><StatusBadge status={item.badge} /></span>
        )}
      </button>
      <div className="media-card__meta">
        <h3>{item.title}</h3>
        <p>
          {item.year && <span>{item.year}</span>}
          {item.type && <span>{item.type === 'tv' ? 'Series' : item.type === 'anime' ? 'Anime' : 'Film'}</span>}
          {(item.maturityRating ?? item.rating) && <span>{item.maturityRating ?? item.rating}</span>}
          {!item.maturityRating && !item.rating && item.voteAverage !== undefined && item.voteAverage > 0 && <span>{item.voteAverage.toFixed(1)} ★</span>}
        </p>
      </div>
    </article>
  );
}
