import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark } from '../../components/brand/BrandMark';
import { Icon } from '../../components/icons/Icon';
import { VidStuckPlayer, type VidStuckPlayerHandle } from '../../components/player';
import { IconButton } from '../../components/primitives/IconButton';
import { Skeleton } from '../../components/primitives/Skeleton';
import { navigateHome, type WatchNavigationState, type WatchRoute } from '../../lib/navigation/watchRoutes';
import { getMediaDetails } from '../../lib/tmdb';
import type { VidStuckPlayerOptions } from '../../lib/vidstuck';
import './WatchPage.css';

interface WatchPageProps {
  navigationState?: WatchNavigationState;
  route: WatchRoute;
}

export function WatchPage({ navigationState, route }: WatchPageProps) {
  const playerRef = useRef<VidStuckPlayerHandle>(null);
  const [resolvedTitle, setResolvedTitle] = useState(navigationState?.title ?? '');
  const [titleLoading, setTitleLoading] = useState(!navigationState?.title);
  const [isRouteValid, setIsRouteValid] = useState(Boolean(navigationState?.title));
  const [validationComplete, setValidationComplete] = useState(Boolean(navigationState?.title));
  const [canUseCustomFullscreen, setCanUseCustomFullscreen] = useState(false);

  useEffect(() => {
    if (navigationState?.title) {
      setResolvedTitle(navigationState.title);
      setTitleLoading(false);
      setIsRouteValid(true);
      setValidationComplete(true);
      return;
    }

    let active = true;
    setTitleLoading(true);
    setValidationComplete(false);
    getMediaDetails({ catalogCategory: route.type, playbackType: route.type, tmdbId: route.tmdbId })
      .then((details) => {
        if (active) {
          setResolvedTitle(details.title);
          setIsRouteValid(true);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedTitle('Title unavailable');
          setIsRouteValid(false);
        }
      })
      .finally(() => {
        if (active) {
          setTitleLoading(false);
          setValidationComplete(true);
        }
      });
    return () => { active = false; };
  }, [navigationState?.title, route.tmdbId, route.type]);

  useEffect(() => {
    const updateCapability = () => setCanUseCustomFullscreen(
      window.matchMedia('(max-width: 64rem)').matches
      && Boolean(playerRef.current?.canRequestFullscreen()),
    );
    const frame = window.requestAnimationFrame(updateCapability);
    window.addEventListener('resize', updateCapability);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateCapability);
    };
  }, [isRouteValid, validationComplete]);

  const playerOptions = useMemo<VidStuckPlayerOptions>(() => (
    route.type === 'movie'
      ? { tmdbId: route.tmdbId, type: 'movie' }
      : {
        episode: route.episode,
        season: route.season,
        tmdbId: route.tmdbId,
        type: 'tv',
      }
  ), [route]);

  const episodeLabel = route.type === 'tv'
    ? navigationState?.episodeLabel ?? `Season ${route.season} · Episode ${route.episode}`
    : 'Feature presentation';

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigateHome();
  };

  return (
    <main className="watch-page">
      <header className="watch-page__header">
        <IconButton aria-label="Back to browse" onClick={handleBack} size="md" tone="glass" tooltip="Back">
          <Icon name="chevronLeft" size={23} />
        </IconButton>
        <BrandMark compact />
        <div className="watch-page__title">
          {titleLoading ? <Skeleton height="1.2rem" width="12rem" /> : <h1>{resolvedTitle}</h1>}
          <p>{episodeLabel}</p>
        </div>
        {canUseCustomFullscreen && (
          <IconButton
            aria-label="Enter fullscreen"
            className="watch-page__fullscreen"
            onClick={async () => {
              const succeeded = await playerRef.current?.requestFullscreen();
              if (!succeeded) setCanUseCustomFullscreen(false);
            }}
            size="md"
            tone="glass"
            tooltip="Fullscreen"
          >
            <Icon name="fullscreen" size={21} />
          </IconButton>
        )}
      </header>
      <section aria-label="Video playback" className="watch-page__stage">
        {!validationComplete ? (
          <Skeleton className="watch-page__player-skeleton" radius="lg" />
        ) : isRouteValid ? (
          <VidStuckPlayer ref={playerRef} options={playerOptions} title={resolvedTitle || 'DAITIGN title'} />
        ) : (
          <div className="watch-page__invalid" role="alert">
            <span>Playback unavailable</span>
            <p>This watch link does not point to a valid TMDB title.</p>
          </div>
        )}
      </section>
    </main>
  );
}
