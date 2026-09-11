import { useEffect, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { IconButton } from '../../../components/primitives/IconButton';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import { Icon } from '../../../components/icons/Icon';
import type { MediaDetails } from '../types';
import { YouTubePreview } from '../../hover-preview/YouTubePreview';
import { usePreviewAudio } from '../../preview-audio';
import { useHeroPlaybackEligibility } from '../../home/useHeroPlaybackEligibility';
import { getMediaVideos, selectBestPreviewVideo } from '../../../lib/tmdb/videos';
import type { TmdbVideo } from '../../../lib/tmdb/types';

interface DetailsHeroProps {
  details: MediaDetails;
  onAction: (message: string) => void;
  onPlay: () => void;
}

export function DetailsHero({ details, onAction, onPlay }: DetailsHeroProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isListed, setIsListed] = useState(false);
  const [modalVideo, setModalVideo] = useState<TmdbVideo | null>(null);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);

  const { isAudible, toggleSound } = usePreviewAudio();
  const canPlayVideo = useHeroPlaybackEligibility();

  useEffect(() => {
    setModalVideo(null);
    setIsTrailerPlaying(false);
    if (!canPlayVideo || !details.tmdbId) return;

    const controller = new AbortController();
    const playbackType = details.playbackType ?? (details.type === 'movie' ? 'movie' : 'tv');
    getMediaVideos(playbackType, details.tmdbId, { signal: controller.signal })
      .then((videos) => {
        if (!controller.signal.aborted) {
          setModalVideo(selectBestPreviewVideo(videos));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setModalVideo(null);
      });

    return () => controller.abort();
  }, [canPlayVideo, details.playbackType, details.tmdbId, details.type]);

  return (
    <section className="details-hero" data-details-video-slot>
      <ResponsiveImage
        alt=""
        className={`details-hero__backdrop${isTrailerPlaying ? ' details-hero__backdrop--under-trailer' : ''}`}
        fetchPriority="high"
        loading="eager"
        objectPosition="center center"
        sizes="(min-width: 1024px) 62rem, 100vw"
        sources={details.backdrop ? [{ srcSet: details.backdrop.srcSet, type: details.backdrop.type }] : []}
        src={details.backdrop?.fallback ?? details.backdropUrl ?? ''}
      />
      {modalVideo && (
        <YouTubePreview
          key={modalVideo.key}
          onPlaying={() => setIsTrailerPlaying(true)}
          title={details.title}
          variant="modal"
          video={modalVideo}
        />
      )}
      <div aria-hidden="true" className="details-hero__shade" />
      <div className="details-hero__content">
        {details.logoUrl ? (
          <img alt={`${details.title} logo`} className="details-hero__logo" src={details.logoUrl} />
        ) : (
          <p aria-hidden="true" className="details-hero__title">{details.title}</p>
        )}
        <div className="details-hero__bottom-row">
          <div className="details-hero__actions">
            <Button onClick={onPlay} size="lg" startIcon={<Icon name="play" />}>
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
              <Icon name="thumbUp" size={21} />
            </IconButton>
          </div>
          <IconButton
            aria-label={isAudible ? `Mute trailer for ${details.title}` : `Unmute trailer for ${details.title}`}
            aria-pressed={isAudible}
            className="details-hero__audio-toggle"
            onClick={toggleSound}
            size="lg"
            tone="glass"
            tooltip={isAudible ? 'Mute' : 'Unmute'}
          >
            <Icon name={isAudible ? 'volume' : 'volumeOff'} size={22} />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
