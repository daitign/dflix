import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/icons/Icon';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { MediaItem } from '../../catalog';
import { useDetailsModal } from '../../details-modal';
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
  const [notice, setNotice] = useState('');
  const runtime = formatRuntime(item.runtime);
  const titleParts = useMemo(() => {
    const words = item.title.split(' ');
    return { lead: words.slice(0, -1).join(' '), accent: words.at(-1) ?? item.title };
  }, [item.title]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <section aria-labelledby="hero-title" className="hero-banner" id="home">
      <ResponsiveImage
        alt=""
        className="hero-banner__backdrop"
        fetchPriority="high"
        loading="eager"
        objectPosition="72% center"
        sizes="100vw"
        sources={[{
          srcSet: '/media/last-meridian-960.webp 960w, /media/last-meridian-1600.webp 1600w',
          type: 'image/webp',
        }]}
        src="/media/last-meridian-1600.webp"
      />
      <div aria-hidden="true" className="hero-banner__wash" />
      <div className="container hero-banner__content">
        <div className="hero-banner__copy">
          <p className="hero-banner__kicker">
            <span aria-hidden="true" className="hero-banner__brand-glyph">D</span>
            DAITIGN FEATURE PRESENTS
          </p>
          <h1 id="hero-title" aria-label={item.title}>
            <span>{titleParts.lead}</span>
            <em>{titleParts.accent}</em>
          </h1>
          <div aria-label="Title information" className="hero-banner__meta">
            {item.year && <span>{item.year}</span>}
            {item.rating && <span className="hero-banner__rating">{item.rating}</span>}
            {item.genres?.[0] && <span className="hero-banner__meta-detail">{item.genres[0]}</span>}
            {runtime && <span className="hero-banner__meta-detail">{runtime}</span>}
          </div>
          {item.overview && <p className="hero-banner__overview">{item.overview}</p>}
          <div className="hero-banner__actions">
            <Button onClick={() => setNotice('Playback will connect in a later phase.')} size="lg" startIcon={<Icon name="play" />}>
              Play
            </Button>
            <Button onClick={(event) => openDetails(item.id, event.currentTarget)} size="lg" startIcon={<Icon name="info" />} variant="secondary">
              More Details
            </Button>
          </div>
          <div aria-live="polite" className="hero-banner__notice" role="status">{notice}</div>
        </div>
      </div>
      <div aria-hidden="true" className="hero-banner__fade" />
    </section>
  );
}
