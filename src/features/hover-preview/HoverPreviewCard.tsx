import { useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/primitives/IconButton';
import { ResponsiveImage } from '../../components/primitives/ResponsiveImage';
import type {
  HoverPreviewAction,
  HoverPreviewPlacement,
  MediaPreviewData,
} from './types';

interface HoverPreviewCardProps {
  anchorElement: HTMLElement;
  data: MediaPreviewData;
  onAction: (action: HoverPreviewAction, data: MediaPreviewData, trigger?: HTMLElement | null) => void;
  onCancelClose: () => void;
  onClose: (options?: { immediate?: boolean; returnFocus?: boolean }) => void;
  onScheduleClose: () => void;
  phase: 'open' | 'closing';
  placement: HoverPreviewPlacement;
  style: React.CSSProperties;
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
  const [isListed, setIsListed] = useState(false);

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
      <div aria-label="Cinematic preview image; video support is reserved for a future phase" className="hover-preview-card__media" data-preview-video-slot>
        <ResponsiveImage
          alt=""
          fallbackLabel={`${data.title} artwork unavailable`}
          loading="eager"
          sizes="(min-width: 1024px) 32rem, 70vw"
          sources={data.artwork ? [{ srcSet: data.artwork.srcSet, type: 'image/webp' }] : []}
          src={data.artwork?.fallback ?? data.artworkUrl ?? ''}
        />
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
              setIsListed((current) => !current);
              onAction('add-to-list', data);
            }}
            size="md"
            tone="glass"
            tooltip={isListed ? 'In My List' : 'My List'}
          >
            <Icon name={isListed ? 'bookmark' : 'plus'} size={19} />
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
            <Icon name="heart" size={19} />
          </IconButton>
          <span className="hover-preview-card__control-spacer" />
          <IconButton
            aria-label={`More details about ${data.title}`}
            onClick={() => onAction('details', data, anchorElement)}
            size="md"
            tone="glass"
            tooltip="More Details"
          >
            <Icon name="info" size={20} />
          </IconButton>
        </div>

        <div aria-label="Title information" className="hover-preview-card__facts">
          {data.year && <span>{data.year}</span>}
          {data.maturityRating && <span className="hover-preview-card__rating">{data.maturityRating}</span>}
          <span className="hover-preview-card__quality">{data.quality}</span>
          <span>{getLengthLabel(data)}</span>
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
