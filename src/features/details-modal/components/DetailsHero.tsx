import { useEffect, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { IconButton } from '../../../components/primitives/IconButton';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import { Icon } from '../../../components/icons/Icon';
import type { MediaDetails } from '../types';
import { YouTubePreview } from '../../hover-preview/YouTubePreview';
import { isMobileTouchDevice, usePreviewAudio } from '../../preview-audio';
import { useHeroPlaybackEligibility } from '../../home/useHeroPlaybackEligibility';
import { getMediaVideos, selectPreviewVideoCandidates } from '../../../lib/tmdb/videos';
import type { TmdbVideo } from '../../../lib/tmdb/types';
import { useMyList } from '../../my-list';
import { logTVPreviewStage } from '../../hover-preview/tvPreviewDiagnostics';

interface DetailsHeroProps {
  details: MediaDetails;
  onAction: (message: string) => void;
  onPlay: () => void;
}

export function DetailsHero({ details, onAction, onPlay }: DetailsHeroProps) {
  const [isLiked, setIsLiked] = useState(false);
  const { isInList, toggleItem } = useMyList();
  const isListed = isInList(details.tmdbId);
  const [modalVideo, setModalVideo] = useState<TmdbVideo | null>(null);
  const [modalCandidates, setModalCandidates] = useState<TmdbVideo[]>([]);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);

  const { isAudible, toggleSound } = usePreviewAudio();
  const canPlayVideo = useHeroPlaybackEligibility();

  // On mobile touch devices (e.g. iPhone), modal previews must always start muted
  // to comply with iOS WebKit autoplay policy. User can tap the audio button to unmute.
  const isMobile = isMobileTouchDevice();
  const [isMobileModalMuted, setIsMobileModalMuted] = useState(isMobile);

  const isTrailerAudible = isMobile ? (!isMobileModalMuted && isAudible) : isAudible;

  const handleAudioToggle = () => {
    if (isMobile) {
      if (isMobileModalMuted) {
        setIsMobileModalMuted(false);
        if (!isAudible) toggleSound();
      } else {
        setIsMobileModalMuted(true);
        if (isAudible) toggleSound();
      }
    } else {
      toggleSound();
    }
  };

  useEffect(() => {
    setModalVideo(null);
    setModalCandidates([]);
    setIsTrailerPlaying(false);
    logTVPreviewStage('preview requested', {
      surface: 'details', title: details.title, tmdbId: details.tmdbId, eligible: canPlayVideo,
    });
    if (!canPlayVideo || !details.tmdbId) return;

    const controller = new AbortController();
    const playbackType = details.playbackType ?? (details.type === 'movie' ? 'movie' : 'tv');
    getMediaVideos(playbackType, details.tmdbId, { signal: controller.signal })
      .then((videos) => {
        if (!controller.signal.aborted) {
          const candidates = selectPreviewVideoCandidates(videos);
          logTVPreviewStage('trailer key resolved', {
            surface: 'details', title: details.title, key: candidates[0]?.key ?? null, candidateCount: candidates.length,
          });
          setModalCandidates(candidates);
          setModalVideo(candidates[0] ?? null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setModalVideo(null);
          setModalCandidates([]);
        }
      });

    return () => controller.abort();
  }, [canPlayVideo, details.playbackType, details.title, details.tmdbId, details.type]);

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
          isAudible={isTrailerAudible}
          key={details.tmdbId}
          onPlaying={() => setIsTrailerPlaying(true)}
          surface="details"
          title={details.title}
          variant="modal"
          video={modalVideo}
          videos={modalCandidates}
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
            <Button data-tv-focusable="true" onClick={onPlay} size="lg" startIcon={<Icon name="play" />}>
              Play
            </Button>
            <IconButton
              aria-label={isListed ? `Remove ${details.title} from My List` : `Add ${details.title} to My List`}
              aria-pressed={isListed}
              className={isListed ? 'details-action--active' : undefined}
              data-tv-focusable="true"
              onClick={() => {
                const added = toggleItem(details);
                onAction(added ? `Added ${details.title} to My List.` : `Removed ${details.title} from My List.`);
              }}
              size="lg"
              tone="glass"
              tooltip={isListed ? 'In My List' : 'My List'}
            >
              <Icon name={isListed ? 'check' : 'plus'} size={22} />
            </IconButton>
            <IconButton
              aria-label={isLiked ? `Unlike ${details.title}` : `Like ${details.title}`}
              aria-pressed={isLiked}
              className={isLiked ? 'details-action--active' : undefined}
              data-tv-focusable="true"
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
            aria-label={isTrailerAudible ? `Mute trailer for ${details.title}` : `Unmute trailer for ${details.title}`}
            aria-pressed={isTrailerAudible}
            className="details-hero__audio-toggle"
            data-tv-focusable="true"
            onClick={handleAudioToggle}
            size="lg"
            tone="glass"
            tooltip={isTrailerAudible ? 'Mute' : 'Unmute'}
          >
            <Icon name={isTrailerAudible ? 'volume' : 'volumeOff'} size={22} />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
