import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/icons/Icon';
import { IconButton } from '../../../components/primitives/IconButton';
import { Skeleton } from '../../../components/primitives/Skeleton';
import type { TmdbVideo } from '../../../lib/tmdb/types';
import { getMediaVideos } from '../../../lib/tmdb/videos';
import { filterAndRankTrailers, MAX_TRAILERS_COUNT } from '../trailersUtils';
import type { MediaDetails } from '../types';

export { filterAndRankTrailers, MAX_TRAILERS_COUNT };

interface TrailersAndMoreProps {
  details: MediaDetails;
  maxTrailers?: number;
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
              src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0&modestbranding=1&controls=1&iv_load_policy=3&playsinline=1`}
              title={video.name}
            />
            <IconButton
              aria-label={`Stop playing ${video.name}`}
              className="trailer-card__stop-btn"
              data-tv-focusable="true"
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
              data-tv-focusable="true"
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


export function TrailersAndMore({ details, maxTrailers = MAX_TRAILERS_COUNT }: TrailersAndMoreProps) {
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
    return filterAndRankTrailers(videos, maxTrailers);
  }, [videos, maxTrailers]);

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
