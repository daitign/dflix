import { useState } from 'react';
import { Icon } from '../../../components/icons/Icon';
import { SpatialAudioBadge } from '../../../components/primitives/SpatialAudioBadge';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { MediaItem } from '../../catalog';
import {
  getDurationLabel,
  getMaturityLabel,
  hasSpatialAudio,
  getStatusBadgeLabel,
} from '../similarTitlesUtils';

interface SimilarTitlesProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
}

function SimilarTitleCard({ item, onSelect }: { item: MediaItem; onSelect: (item: MediaItem) => void }) {
  const [isListed, setIsListed] = useState(false);
  const duration = getDurationLabel(item);
  const maturity = getMaturityLabel(item);
  const spatialAudio = hasSpatialAudio(item);
  const statusBadge = getStatusBadgeLabel(item.badge);

  return (
    <article className="similar-card">
      <button className="similar-card__open" onClick={() => onSelect(item)} type="button">
        <div className="similar-card__media">
          <ResponsiveImage
            alt=""
            loading="lazy"
            sizes="(max-width: 480px) 50vw, (max-width: 960px) 33vw, 18rem"
            sources={item.backdrop ? [{ srcSet: item.backdrop.srcSet, type: item.backdrop.type }] : []}
            src={item.backdrop?.fallback ?? item.backdropUrl ?? ''}
          />
          <span className="similar-card__duration">{duration}</span>
          {statusBadge && <span className="similar-card__badge">{statusBadge}</span>}
          <div className="similar-card__title-wrap">
            <span className="similar-card__title">{item.title}</span>
          </div>
        </div>
      </button>

      <div className="similar-card__body">
        <div className="similar-card__meta">
          <div className="similar-card__badges">
            <span className="similar-card__pill">{maturity}</span>
            <span className="similar-card__pill similar-card__pill--quality">HD</span>
            {spatialAudio && <SpatialAudioBadge size="sm" />}
            {item.year && <span className="similar-card__year">{item.year}</span>}
          </div>

          <button
            aria-label={isListed ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`}
            aria-pressed={isListed}
            className={`similar-card__list-btn ${isListed ? 'similar-card__list-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsListed((current) => !current);
            }}
            title={isListed ? 'In My List' : 'Add to My List'}
            type="button"
          >
            <Icon name={isListed ? 'check' : 'plus'} size={18} />
          </button>
        </div>

        {item.overview && <p className="similar-card__overview">{item.overview}</p>}
      </div>
    </article>
  );
}

const INITIAL_COUNT = 9;

export function SimilarTitles({ items, onSelect }: SimilarTitlesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = isExpanded ? items : items.slice(0, INITIAL_COUNT);
  const hasMore = items.length > INITIAL_COUNT;

  return (
    <section aria-labelledby="similar-titles-heading" className="details-section similar-section">
      <h3 id="similar-titles-heading">More Like This</h3>
      <div className="similar-grid">
        {visibleItems.map((item) => <SimilarTitleCard item={item} key={item.id} onSelect={onSelect} />)}
      </div>

      {hasMore && (
        <div className="similar-expand-divider">
          <button
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Show fewer titles' : 'Show more titles'}
            className="similar-expand-button"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={22} />
          </button>
        </div>
      )}
    </section>
  );
}
