import { Icon } from '../../../components/icons/Icon';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { MediaItem } from '../../catalog';
import { toMediaPreviewData, useHoverPreviewAnchor } from '../../hover-preview';
import './ContinueWatchingCard.css';

interface ContinueWatchingCardProps {
  cardIndex?: number;
  item: MediaItem;
}

export function ContinueWatchingCard({ cardIndex, item }: ContinueWatchingCardProps) {
  const progress = Math.min(100, Math.max(0, item.progress ?? 0));
  const { anchorProps, anchorRef, referenceRef } = useHoverPreviewAnchor<HTMLElement>({
    data: toMediaPreviewData(item),
  });

  return (
    <article
      className="continue-card"
      data-card-index={cardIndex}
      data-media-id={item.id}
      ref={referenceRef}
    >
      <button
        {...anchorProps}
        aria-label={`Resume ${item.title}`}
        className="continue-card__surface"
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
          sizes="(max-width: 767px) 74vw, 24vw"
          sources={item.backdrop ? [{ srcSet: item.backdrop.srcSet, type: item.backdrop.type }] : []}
          src={item.backdrop?.fallback ?? item.backdropUrl ?? ''}
        />
        <span aria-hidden="true" className="continue-card__shade" />
        <span aria-hidden="true" className="continue-card__resume"><Icon name="play" size={17} /></span>
        {item.episodeLabel && <span className="continue-card__episode">{item.episodeLabel}</span>}
        <span aria-hidden="true" className="continue-card__progress-track">
          <span style={{ width: `${progress}%` }} />
        </span>
      </button>
      <div className="continue-card__meta">
        <h3>{item.title}</h3>
        <span>{progress}% watched</span>
      </div>
    </article>
  );
}
