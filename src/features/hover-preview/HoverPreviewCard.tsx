import { useEffect, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/primitives/IconButton';
import { ResponsiveImage } from '../../components/primitives/ResponsiveImage';
import { SpatialAudioBadge } from '../../components/primitives/SpatialAudioBadge';
import type { TmdbVideo } from '../../lib/tmdb/types';

import { getMediaVideos, selectBestPreviewVideo } from '../../lib/tmdb/videos';
import type {
  HoverPreviewAction,
  HoverPreviewPlacement,
  MediaPreviewData,
} from './types';
import { usePreviewPlaybackEligibility } from './usePreviewPlaybackEligibility';
import { YouTubePreview } from './YouTubePreview';
import { usePreviewAudio } from '../preview-audio';
import { useMyList } from '../my-list';

interface HoverPreviewCardProps {
  anchorElement: HTMLElement;
  data: MediaPreviewData;
  onAction: (action: HoverPreviewAction, data: MediaPreviewData, trigger?: HTMLElement | null) => void;
  onCancelClose: () => void;
  onClose: (options?: { immediate?: boolean; returnFocus?: boolean }) => void;
  onScheduleClose: () => void;
  phase: 'open' | 'closing';
  placement: HoverPreviewPlacement;
  style: { left: number; top: number; width: number };
}

function getLengthLabel(data: MediaPreviewData) {
  if (data.seasons) return `${data.seasons} Season${data.seasons === 1 ? '' : 's'}`;
  if (!data.runtime) return data.type === 'movie' ? 'Film' : 'Series';

  const hours = Math.floor(data.runtime / 60);
  const minutes = data.runtime % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function HoverPreviewCard({
  anchorElement,
  data,
  onAction,
  onCancelClose,
  onClose,
  onScheduleClose,
  phase,
  placement,
  style,
}: HoverPreviewCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const { isInList, toggleItem } = useMyList();
  const isListed = isInList(data.tmdbId ?? data.id);
  const [previewVideo, setPreviewVideo] = useState<TmdbVideo | null>(null);
  const canPlayPreview = usePreviewPlaybackEligibility();
  const { setHoverActive } = usePreviewAudio();

  // Arbitrate audio playback with Hero banner
  useEffect(() => {
    if (phase === 'open') {
      setHoverActive(true);
    } else {
      setHoverActive(false);
    }
    return () => {
      setHoverActive(false);
    };
  }, [phase, setHoverActive]);

  const matchPercentage = Math.max(
    74,
    Math.min(99, Math.round((data.voteAverage && data.voteAverage > 0 ? data.voteAverage : 8.3) * 10 + 2)),
  );

  useEffect(() => {
    setPreviewVideo(null);
    if (phase !== 'open' || !canPlayPreview || !data.tmdbId) return undefined;

    const controller = new AbortController();
    getMediaVideos(data.playbackType, data.tmdbId, { signal: controller.signal })
      .then((videos) => {
        if (!controller.signal.aborted) setPreviewVideo(selectBestPreviewVideo(videos));
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreviewVideo(null);
      });

    return () => controller.abort();
  }, [canPlayPreview, data.playbackType, data.tmdbId, phase]);

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node
      && (event.currentTarget.contains(nextTarget) || anchorElement.contains(nextTarget))
    ) return;

    onScheduleClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose({ returnFocus: true });
  };

  const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') onCancelClose();
  };

  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') onScheduleClose();
  };

  return (
    <article
      aria-label={`Preview for ${data.title}`}
      className={`hover-preview-card hover-preview-card--${placement} hover-preview-card--${phase}`}
      data-hover-preview-root
      id="daitign-hover-preview"
      onBlurCapture={handleBlur}
      onFocusCapture={onCancelClose}
      onKeyDown={handleKeyDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      role="region"
      style={style}
    >
      <div aria-label={`Cinematic preview for ${data.title}`} className="hover-preview-card__media" data-preview-video-slot>
        <ResponsiveImage
          alt=""
          fallbackLabel={`${data.title} artwork unavailable`}
          loading="eager"
          sizes="(min-width: 1024px) 32rem, 70vw"
          sources={data.artwork ? [{ srcSet: data.artwork.srcSet, type: data.artwork.type }] : []}
          src={data.artwork?.fallback ?? data.artworkUrl ?? ''}
        />
        {phase === 'open' && previewVideo && (
          <YouTubePreview title={data.title} video={previewVideo} />
        )}
        <span aria-hidden="true" className="hover-preview-card__media-shade" />
        <h2>{data.title}</h2>
      </div>

      <div className="hover-preview-card__body">
        <div className="hover-preview-card__controls">
          <IconButton
            aria-label={`Play ${data.title}`}
            className="hover-preview-card__primary"
            data-preview-primary
            onClick={() => onAction('play', data)}
            size="md"
            tone="accent"
            tooltip="Play"
          >
            <Icon name="play" size={20} />
          </IconButton>
          <IconButton
            aria-label={isListed ? `Remove ${data.title} from My List` : `Add ${data.title} to My List`}
            aria-pressed={isListed}
            className={isListed ? 'hover-preview-card__toggle--active' : undefined}
            onClick={() => {
              toggleItem(data);
              onAction('add-to-list', data);
            }}
            size="md"
            tone="glass"
            tooltip={isListed ? 'In My List' : 'My List'}
          >
            <Icon name={isListed ? 'check' : 'plus'} size={20} />
          </IconButton>
          <IconButton
            aria-label={isLiked ? `Unlike ${data.title}` : `Like ${data.title}`}
            aria-pressed={isLiked}
            className={isLiked ? 'hover-preview-card__toggle--active' : undefined}
            onClick={() => {
              setIsLiked((current) => !current);
              onAction('like', data);
            }}
            size="md"
            tone="glass"
            tooltip={isLiked ? 'Liked' : 'Like'}
          >
            <Icon name="thumbUp" size={19} />
          </IconButton>
          <span className="hover-preview-card__control-spacer" />
          <IconButton
            aria-label={`More details about ${data.title}`}
            onClick={() => onAction('details', data, anchorElement)}
            size="md"
            tone="glass"
            tooltip="More Details"
          >
            <Icon name="chevronDown" size={21} />
          </IconButton>
        </div>

        <div aria-label="Title information" className="hover-preview-card__facts">
          <span className="hover-preview-card__match">{matchPercentage}% Match</span>
          {data.maturityRating && <span className="hover-preview-card__rating">{data.maturityRating}</span>}
          <span>{getLengthLabel(data)}</span>
          <span className="hover-preview-card__quality">{data.quality}</span>
          {data.type === 'movie' && <SpatialAudioBadge />}
          {data.type !== 'movie' && data.year && <span>{data.year}</span>}
        </div>

        {data.genres.length > 0 && (
          <div aria-label="Genres" className="hover-preview-card__genres">
            {data.genres.map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        )}
      </div>
    </article>
  );
}
