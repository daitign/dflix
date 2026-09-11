import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/icons/Icon';
import { IconButton } from '../../../components/primitives/IconButton';
import { Skeleton } from '../../../components/primitives/Skeleton';
import type { TmdbVideo } from '../../../lib/tmdb/types';
import { getMediaVideos } from '../../../lib/tmdb/videos';
import type { MediaDetails } from '../types';

interface TrailersAndMoreProps {
  details: MediaDetails;
}

interface TrailerCardProps {
  defaultBackdrop?: string;
  isActive: boolean;
  onPlay: (key: string) => void;
  onStop: () => void;
  video: TmdbVideo;
}

function TrailerCard({ defaultBackdrop, isActive, onPlay, onStop, video }: TrailerCardProps) {
  const [thumbSrc, setThumbSrc] = useState(
    `https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`,
  );

  const formattedType = video.type
    ? video.type.charAt(0).toUpperCase() + video.type.slice(1).toLowerCase()
    : 'Trailer';

  const handleThumbError = () => {
    if (thumbSrc.includes('hqdefault.jpg')) {
      setThumbSrc(`https://i.ytimg.com/vi/${video.key}/mqdefault.jpg`);
    } else if (thumbSrc.includes('mqdefault.jpg')) {
      setThumbSrc(`https://img.youtube.com/vi/${video.key}/0.jpg`);
    } else if (defaultBackdrop) {
      setThumbSrc(defaultBackdrop);
    }
  };

  return (
    <article className={`trailer-card${isActive ? ' trailer-card--active' : ''}`}>
      <div className="trailer-card__media">
        {isActive ? (
          <div className="trailer-card__player-wrap">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="trailer-card__iframe"
              src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`}
              title={video.name}
            />
            <IconButton
              aria-label={`Stop playing ${video.name}`}
              className="trailer-card__stop-btn"
              onClick={onStop}
              size="sm"
              tone="glass"
              tooltip="Close Video"
            >
              <Icon name="close" size={14} />
            </IconButton>
          </div>
        ) : (
          <>
            <img
              alt={video.name}
              className="trailer-card__thumb"
              loading="lazy"
              onError={handleThumbError}
              src={thumbSrc}
            />
            <button
              aria-label={`Play ${video.name}`}
              className="trailer-card__trigger"
              onClick={() => onPlay(video.key)}
              type="button"
            >
              <span aria-hidden="true" className="trailer-card__play-btn">
                <Icon name="play" size={20} />
              </span>
            </button>
            <span className="trailer-card__type-tag">{formattedType}</span>
          </>
        )}
      </div>
      <div className="trailer-card__body">
        <h4 className="trailer-card__title" title={video.name}>
          {video.name}
        </h4>
        <span className="trailer-card__type">
          {video.official ? 'Official ' : ''}
          {formattedType}
        </span>
      </div>
    </article>
  );
}

const TYPE_PRIORITY: Record<string, number> = {
  trailer: 1,
  teaser: 2,
  featurette: 3,
  'behind the scenes': 4,
  clip: 5,
  bloopers: 6,
};

export function TrailersAndMore({ details }: TrailersAndMoreProps) {
  const [videos, setVideos] = useState<TmdbVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeVideoKey, setActiveVideoKey] = useState<string | null>(null);

  useEffect(() => {
    setActiveVideoKey(null);
    setVideos([]);
    if (!details.tmdbId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    const playbackType = details.playbackType ?? (details.type === 'movie' ? 'movie' : 'tv');

    getMediaVideos(playbackType, details.tmdbId, { signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted) return;
        setVideos(results);
        setIsLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setVideos([]);
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [details.playbackType, details.tmdbId, details.type]);

  const displayVideos = useMemo(() => {
    const valid = videos.filter(
      (v) => v.site?.toLowerCase() === 'youtube' && /^[A-Za-z0-9_-]{6,}$/.test(v.key),
    );

    // Deduplicate by video key
    const seen = new Set<string>();
    const unique = valid.filter((v) => {
      if (seen.has(v.key)) return false;
      seen.add(v.key);
      return true;
    });

    // Sort by priority: Official first, then type rank, then recency
    unique.sort((a, b) => {
      if (a.official !== b.official) return a.official ? -1 : 1;
      const typeRankA = TYPE_PRIORITY[a.type?.trim().toLowerCase()] ?? 99;
      const typeRankB = TYPE_PRIORITY[b.type?.trim().toLowerCase()] ?? 99;
      if (typeRankA !== typeRankB) return typeRankA - typeRankB;
      const dateA = a.published_at ? Date.parse(a.published_at) : 0;
      const dateB = b.published_at ? Date.parse(b.published_at) : 0;
      return dateB - dateA;
    });

    return unique;
  }, [videos]);

  if (isLoading) {
    return (
      <section aria-labelledby="trailers-heading" className="details-section details-trailers">
        <h3 id="trailers-heading">Trailers &amp; More</h3>
        <div className="trailers-grid">
          {[1, 2, 3].map((i) => (
            <div className="trailer-card" key={i}>
              <Skeleton height="9.5rem" radius="sm" />
              <div className="trailer-card__body">
                <Skeleton height="1rem" width="75%" />
                <Skeleton height="0.75rem" width="40%" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (displayVideos.length === 0) return null;

  return (
    <section aria-labelledby="trailers-heading" className="details-section details-trailers">
      <h3 id="trailers-heading">Trailers &amp; More</h3>
      <div className="trailers-grid">
        {displayVideos.map((video) => (
          <TrailerCard
            defaultBackdrop={details.backdrop?.fallback ?? details.backdropUrl}
            isActive={activeVideoKey === video.key}
            key={video.id || video.key}
            onPlay={setActiveVideoKey}
            onStop={() => setActiveVideoKey(null)}
            video={video}
          />
        ))}
      </div>
    </section>
  );
}
