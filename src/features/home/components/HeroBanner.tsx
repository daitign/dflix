import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/icons/Icon';
import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { MediaItem } from '../../catalog';
import { useDetailsModal } from '../../details-modal';
import { YouTubePreview } from '../../hover-preview/YouTubePreview';
import { usePreviewAudio } from '../../preview-audio';
import { useHeroPlaybackEligibility } from '../useHeroPlaybackEligibility';
import { useHeroScrollPlayback } from '../useHeroScrollPlayback';
import { getMediaVideos, selectPreviewVideoCandidates } from '../../../lib/tmdb/videos';
import type { TmdbVideo } from '../../../lib/tmdb/types';
import { navigateToWatch } from '../../../lib/navigation/watchRoutes';
import { useMyList } from '../../my-list';
import { logTVPreviewStage } from '../../hover-preview/tvPreviewDiagnostics';
import './HeroBanner.css';

interface HeroBannerProps {
  item: MediaItem;
}

export function HeroBanner({ item }: HeroBannerProps) {
  const heroRef = useRef<HTMLElement>(null);
  const { isHeroInView, heroVolumeFactor } = useHeroScrollPlayback(heroRef);
  const { openDetails } = useDetailsModal();
  const { isAudible, isHoverActive, isModalActive, toggleSound } = usePreviewAudio();
  const { isInList, toggleItem } = useMyList();
  const isListed = isInList(item.tmdbId ?? item.id);
  const [heroVideo, setHeroVideo] = useState<TmdbVideo | null>(null);
  const [heroCandidates, setHeroCandidates] = useState<TmdbVideo[]>([]);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);
  const canPlayVideo = useHeroPlaybackEligibility();

  const mediaFormat = item.type === 'tv' ? 'SERIES' : item.type === 'anime' ? 'ANIME SERIES' : 'FILM';
  const categoryLabel = item.type === 'tv' ? 'TV Shows' : 'Movies';

  useEffect(() => {
    setHeroVideo(null);
    setHeroCandidates([]);
    setIsTrailerPlaying(false);
    logTVPreviewStage('preview requested', {
      surface: 'hero', title: item.title, tmdbId: item.tmdbId, eligible: canPlayVideo,
    });
    if (!canPlayVideo || !item.tmdbId) return;

    const controller = new AbortController();
    const playbackType = item.playbackType ?? (item.type === 'movie' ? 'movie' : 'tv');
    getMediaVideos(playbackType, item.tmdbId, { signal: controller.signal })
      .then((videos) => {
        if (!controller.signal.aborted) {
          const candidates = selectPreviewVideoCandidates(videos);
          logTVPreviewStage('trailer key resolved', {
            surface: 'hero', title: item.title, key: candidates[0]?.key ?? null, candidateCount: candidates.length,
          });
          setHeroCandidates(candidates);
          setHeroVideo(candidates[0] ?? null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHeroVideo(null);
          setHeroCandidates([]);
        }
      });

    return () => controller.abort();
  }, [canPlayVideo, item.playbackType, item.title, item.tmdbId, item.type]);

  useEffect(() => {
    if (isHoverActive || isModalActive) setIsTrailerPlaying(false);
  }, [isHoverActive, isModalActive]);

  return (
    <section aria-labelledby="hero-title" className="hero-banner" id="home" ref={heroRef}>
      <ResponsiveImage
        alt=""
        className={`hero-banner__backdrop${isTrailerPlaying ? ' hero-banner__backdrop--under-trailer' : ''}`}
        fetchPriority="high"
        loading="eager"
        objectPosition="center 30%"
        sizes="100vw"
        sources={item.backdrop ? [{ srcSet: item.backdrop.srcSet, type: item.backdrop.type }] : []}
        src={item.backdrop?.fallback ?? item.backdropUrl ?? '/media/fallback-landscape.svg'}
      />
      {heroVideo && !isHoverActive && !isModalActive && (
        <YouTubePreview
          heroVolumeFactor={heroVolumeFactor}
          isHeroInView={isHeroInView}
          key={item.tmdbId}
          onPlaying={() => setIsTrailerPlaying(true)}
          surface="hero"
          title={item.title}
          variant="hero"
          video={heroVideo}
          videos={heroCandidates}
        />
      )}
      <div aria-hidden="true" className="hero-banner__wash" />

      <div className="container hero-banner__content">
        <div className="hero-banner__copy">
          {/* Netflix Series / Film Badge */}
          <div className="hero-banner__badge">
            <span aria-hidden="true" className="hero-banner__n-glyph">N</span>
            <span className="hero-banner__format-label">{mediaFormat}</span>
          </div>

          {/* Title or Logo */}
          {item.logoUrl ? (
            <h1 className="hero-banner__logo-title" id="hero-title">
              <img alt={item.title} src={item.logoUrl} />
            </h1>
          ) : (
            <h1 className="hero-banner__text-title" id="hero-title">
              {item.title}
            </h1>
          )}

          {/* Top 10 Ribbon */}
          <div className="hero-banner__top-ten">
            <div aria-hidden="true" className="hero-banner__top-ten-badge">
              <span>TOP</span>
              <span>10</span>
            </div>
            <span className="hero-banner__top-ten-text">#1 in {categoryLabel} Today</span>
          </div>

          {/* Overview */}
          {item.overview && <p className="hero-banner__overview">{item.overview}</p>}

          {/* Action Buttons */}
          <div className="hero-banner__actions" data-tv-row>
            <Button
              className="hero-banner__play-button"
              data-tv-focusable="true"
              onClick={() => navigateToWatch(item)}
              size="lg"
              startIcon={<Icon name="play" size={22} />}
            >
              Play
            </Button>
            <Button
              className="hero-banner__info-button"
              data-tv-focusable="true"
              onClick={(event) => openDetails(item, event.currentTarget)}
              size="lg"
              startIcon={<Icon name="info" size={22} />}
              variant="secondary"
            >
              More Info
            </Button>
            <Button
              aria-label={isListed ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`}
              className="hero-banner__list-button"
              data-tv-focusable="true"
              onClick={() => toggleItem(item)}
              size="lg"
              startIcon={<Icon name={isListed ? 'check' : 'plus'} size={22} />}
              variant="secondary"
            >
              {isListed ? 'In My List' : 'My List'}
            </Button>
          </div>
        </div>

        {/* Right side controls: Mute button & Maturity Rating strip */}
        <div className="hero-banner__rail">
          <button
            aria-label={isAudible ? 'Mute preview' : 'Unmute preview'}
            aria-pressed={isAudible}
            className="hero-banner__audio-toggle"
            data-tv-focusable="true"
            onClick={toggleSound}
            type="button"
          >
            <Icon name={isAudible ? 'volume' : 'volumeOff'} size={18} />
          </button>
          <div className="hero-banner__rating-strip">
            <span>{item.maturityRating ?? item.rating ?? '16+'}</span>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="hero-banner__fade" />
    </section>
  );
}
