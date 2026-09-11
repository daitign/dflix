import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import { getFreshnessBadge, type MediaItem } from '../../catalog';
import { toMediaPreviewData, useHoverPreviewAnchor } from '../../hover-preview';
import { RankNumeral } from './RankNumeral';
import { FreshnessBadge } from './StatusBadge';
import './RankedMediaCard.css';

interface RankedMediaCardProps {
  item: MediaItem;
  rank: number;
}

const posterPositionById: Record<string, string> = {
  'last-meridian': '74% center',
  'night-crossing': '52% center',
  'after-rain': '79% center',
  'white-signal': '72% center',
  'dust-protocol': '76% center',
  'celestial-archive': '71% center',
  'still-house': '67% center',
  'north-of-silence': '72% center',
  'paper-moons': '70% center',
  'glass-season': '79% center',
};

export function RankedMediaCard({ item, rank }: RankedMediaCardProps) {
  const artwork = item.poster ?? item.backdrop;
  const { anchorProps, anchorRef, referenceRef } = useHoverPreviewAnchor<HTMLElement>({
    data: toMediaPreviewData(item),
  });

  return (
    <article className={`ranked-card ranked-card--rank-${rank}${rank === 10 ? ' ranked-card--double-digit' : ''}`} ref={referenceRef}>
      <RankNumeral className="ranked-card__number" rank={rank} />
      <button
        {...anchorProps}
        aria-label={`Number ${rank}: ${item.title}`}
        className="ranked-card__art ranked-card__poster-anchor"
        ref={anchorRef}
        type="button"
      >
        <ResponsiveImage
          alt=""
          fallbackLabel={`${item.title} artwork unavailable`}
          objectPosition={posterPositionById[String(item.id)] ?? 'center'}
          sizes="(max-width: 767px) 104px, (max-width: 1023px) 120px, 132px"
          sources={artwork ? [{ srcSet: artwork.srcSet, type: artwork.type }] : []}
          src={artwork?.fallback ?? item.posterUrl ?? item.backdropUrl ?? ''}
        />
        {(() => {
          const freshnessBadge = getFreshnessBadge(item);
          return freshnessBadge ? (
            <div className="ranked-card__badge-container">
              <FreshnessBadge layout="stacked" item={item} status={freshnessBadge} />
            </div>
          ) : null;
        })()}
      </button>
    </article>
  );
}
