import { useMemo } from 'react';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/icons/Icon';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { MediaItem } from '../../catalog';
import { useDetailsModal } from '../../details-modal';
import { navigateToWatch } from '../../../lib/navigation/watchRoutes';
import './HeroBanner.css';

interface HeroBannerProps {
  item: MediaItem;
}

function formatRuntime(minutes?: number): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

export function HeroBanner({ item }: HeroBannerProps) {
  const { openDetails } = useDetailsModal();
  const runtime = formatRuntime(item.runtime);
  const titleParts = useMemo(() => {
    const words = item.title.split(' ');
    return { lead: words.slice(0, -1).join(' '), accent: words.at(-1) ?? item.title };
  }, [item.title]);

  return (
    <section aria-labelledby="hero-title" className="hero-banner" id="home">
      <ResponsiveImage
        alt=""
        className="hero-banner__backdrop"
        fetchPriority="high"
        loading="eager"
        objectPosition="72% center"
        sizes="100vw"
        sources={item.backdrop ? [{ srcSet: item.backdrop.srcSet, type: item.backdrop.type }] : []}
        src={item.backdrop?.fallback ?? item.backdropUrl ?? '/media/fallback-landscape.svg'}
      />
      <div aria-hidden="true" className="hero-banner__wash" />
      <div className="container hero-banner__content">
        <div className="hero-banner__copy">
          <p className="hero-banner__kicker">
            <span aria-hidden="true" className="hero-banner__brand-glyph">D</span>
            DAITIGN FEATURE PRESENTS
          </p>
          {item.logoUrl ? (
            <h1 className="hero-banner__logo-title" id="hero-title">
              <img alt={item.title} src={item.logoUrl} />
            </h1>
          ) : (
            <h1 id="hero-title" aria-label={item.title}>
              <span>{titleParts.lead}</span>
              <em>{titleParts.accent}</em>
            </h1>
          )}
          <div aria-label="Title information" className="hero-banner__meta">
            {item.year && <span>{item.year}</span>}
            {(item.maturityRating ?? item.rating) && <span className="hero-banner__rating">{item.maturityRating ?? item.rating}</span>}
            {item.genres?.[0] && <span className="hero-banner__meta-detail">{item.genres[0]}</span>}
            {runtime && <span className="hero-banner__meta-detail">{runtime}</span>}
          </div>
          {item.overview && <p className="hero-banner__overview">{item.overview}</p>}
          <div className="hero-banner__actions">
            <Button onClick={() => navigateToWatch(item)} size="lg" startIcon={<Icon name="play" />}>
              Play
            </Button>
            <Button onClick={(event) => openDetails(item, event.currentTarget)} size="lg" startIcon={<Icon name="info" />} variant="secondary">
              More Details
            </Button>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="hero-banner__fade" />
    </section>
  );
}
