import { useState } from 'react';
import { Icon } from '../../../components/icons/Icon';
import { IconButton } from '../../../components/primitives/IconButton';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { MediaItem } from '../../catalog';

interface SimilarTitlesProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
}

function SimilarTitleCard({ item, onSelect }: { item: MediaItem; onSelect: (item: MediaItem) => void }) {
  const [isListed, setIsListed] = useState(false);

  return (
    <article className="similar-card">
      <button className="similar-card__open" onClick={() => onSelect(item)} type="button">
        <ResponsiveImage
          alt=""
          loading="lazy"
          sizes="(max-width: 480px) 50vw, (max-width: 960px) 33vw, 18rem"
          sources={item.backdrop ? [{ srcSet: item.backdrop.srcSet, type: 'image/webp' }] : []}
          src={item.backdrop?.fallback ?? item.backdropUrl ?? ''}
        />
        <span className="similar-card__title">{item.title}</span>
      </button>
      <div className="similar-card__body">
        <div className="similar-card__meta">
          <span>{item.year}</span>
          {item.rating && <span className="similar-card__rating">{item.rating}</span>}
          <IconButton
            aria-label={isListed ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`}
            aria-pressed={isListed}
            onClick={() => setIsListed((current) => !current)}
            size="sm"
            tone="glass"
            tooltip={isListed ? 'In My List' : 'My List'}
          >
            <Icon name={isListed ? 'bookmark' : 'plus'} size={17} />
          </IconButton>
        </div>
        {item.overview && <p>{item.overview}</p>}
      </div>
    </article>
  );
}

export function SimilarTitles({ items, onSelect }: SimilarTitlesProps) {
  return (
    <section aria-labelledby="similar-titles-heading" className="details-section">
      <h3 id="similar-titles-heading">More Like This</h3>
      <div className="similar-grid">
        {items.map((item) => <SimilarTitleCard item={item} key={item.id} onSelect={onSelect} />)}
      </div>
    </section>
  );
}
