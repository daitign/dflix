import { useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { IconButton } from '../../../components/primitives/IconButton';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import { Icon } from '../../../components/icons/Icon';
import type { MediaDetails } from '../types';

interface DetailsHeroProps {
  details: MediaDetails;
  onAction: (message: string) => void;
}

export function DetailsHero({ details, onAction }: DetailsHeroProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isListed, setIsListed] = useState(false);

  return (
    <section className="details-hero" data-details-video-slot>
      <ResponsiveImage
        alt=""
        className="details-hero__backdrop"
        fetchPriority="high"
        loading="eager"
        objectPosition="center center"
        sizes="(min-width: 1024px) 62rem, 100vw"
        sources={details.backdrop ? [{ srcSet: details.backdrop.srcSet, type: 'image/webp' }] : []}
        src={details.backdrop?.fallback ?? details.backdropUrl ?? ''}
      />
      <div aria-hidden="true" className="details-hero__shade" />
      <div className="details-hero__content">
        {details.logoUrl ? (
          <img alt={`${details.title} logo`} className="details-hero__logo" src={details.logoUrl} />
        ) : (
          <p aria-hidden="true" className="details-hero__title">{details.title}</p>
        )}
        <div className="details-hero__actions">
          <Button onClick={() => onAction(`Playback for ${details.title} will connect in Phase 5.`)} size="lg" startIcon={<Icon name="play" />}>
            Play
          </Button>
          <IconButton
            aria-label={isListed ? `Remove ${details.title} from My List` : `Add ${details.title} to My List`}
            aria-pressed={isListed}
            className={isListed ? 'details-action--active' : undefined}
            onClick={() => {
              setIsListed((current) => !current);
              onAction(`${details.title} list preference updated for this session.`);
            }}
            size="lg"
            tone="glass"
            tooltip={isListed ? 'In My List' : 'My List'}
          >
            <Icon name={isListed ? 'bookmark' : 'plus'} size={22} />
          </IconButton>
          <IconButton
            aria-label={isLiked ? `Unlike ${details.title}` : `Like ${details.title}`}
            aria-pressed={isLiked}
            className={isLiked ? 'details-action--active' : undefined}
            onClick={() => {
              setIsLiked((current) => !current);
              onAction(`${details.title} rating preference updated for this session.`);
            }}
            size="lg"
            tone="glass"
            tooltip={isLiked ? 'Liked' : 'Like'}
          >
            <Icon name="heart" size={21} />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
