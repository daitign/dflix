import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark } from '../../components/brand/BrandMark';
import { Icon } from '../../components/icons/Icon';
import { VidStuckPlayer, type VidStuckPlayerHandle } from '../../components/player';
import { IconButton } from '../../components/primitives/IconButton';
import { Skeleton } from '../../components/primitives/Skeleton';
import { navigateHome, type WatchNavigationState, type WatchRoute } from '../../lib/navigation/watchRoutes';
import { getMediaDetails } from '../../lib/tmdb';
import { buildVidStuckUrl, type VidStuckPlayerOptions } from '../../lib/vidstuck/index.ts';
import { isTVMode, saveTvBrowseState } from '../../lib/tv/index.ts';
import './WatchPage.css';

interface WatchPageProps {
  navigationState?: WatchNavigationState;
  onExit?: () => void;
  route: WatchRoute;
}

export function WatchPage({ navigationState, onExit, route }: WatchPageProps) {
  const [activeRoute, setActiveRoute] = useState<WatchRoute>(route);
  const [resolvedTitle, setResolvedTitle] = useState(navigationState?.title ?? '');
  const [titleLoading, setTitleLoading] = useState(!navigationState?.title);
  const [isRouteValid, setIsRouteValid] = useState(Boolean(navigationState?.title));
  const [validationComplete, setValidationComplete] = useState(Boolean(navigationState?.title));
  const [server] = useState<string>('default');
  const [subtitle] = useState<string>('english');

  const playerHandleRef = useRef<VidStuckPlayerHandle>(null);
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setActiveRoute(route);
  }, [route]);

  const playerOptions = useMemo<VidStuckPlayerOptions>(() => {
    const base = activeRoute.type === 'movie'
      ? { tmdbId: activeRoute.tmdbId, type: 'movie' as const }
      : {
        episode: activeRoute.episode,
        season: activeRoute.season,
        tmdbId: activeRoute.tmdbId,
        type: 'tv' as const,
      };
    return {
      ...base,
      server: server !== 'default' ? server : undefined,
      subtitle: subtitle !== 'off' ? subtitle : undefined,
    };
  }, [activeRoute, server, subtitle]);

  useEffect(() => {
    if (isTVMode()) {
      document.documentElement.classList.add('daitign-tv-watching');
      if (typeof window !== 'undefined' && window.AndroidTVBridge?.startTvPlayer) {
        saveTvBrowseState();
        const vidstuckUrl = buildVidStuckUrl(playerOptions);
        window.AndroidTVBridge.startTvPlayer(vidstuckUrl, JSON.stringify(activeRoute));
      }
      return () => {
        document.documentElement.classList.remove('daitign-tv-watching');
      };
    }
  }, [activeRoute, playerOptions]);

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
    getMediaDetails({ catalogCategory: activeRoute.type, playbackType: activeRoute.type, tmdbId: activeRoute.tmdbId })
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
  }, [navigationState?.title, activeRoute.tmdbId, activeRoute.type]);

  const episodeLabel = activeRoute.type === 'tv'
    ? navigationState?.episodeLabel ?? `Season ${activeRoute.season} · Episode ${activeRoute.episode}`
    : 'Feature presentation';

  const handleBack = () => {
    if (onExit) {
      onExit();
      return;
    }
    if (window.history.length > 1) window.history.back();
    else navigateHome();
  };

  return (
    <main className="watch-page">
      {!isTVMode() && (
        <header className="watch-page__header">
          <IconButton aria-label="Back to browse" onClick={handleBack} size="md" tone="glass" tooltip="Back">
            <Icon name="chevronLeft" size={23} />
          </IconButton>
          <BrandMark compact />
          <div className="watch-page__title">
            {titleLoading ? <Skeleton height="1.2rem" width="12rem" /> : <h1>{resolvedTitle}</h1>}
            <p>{episodeLabel}</p>
          </div>
        </header>
      )}
      <section aria-label="Video playback" className="watch-page__stage" ref={stageRef}>
        {!validationComplete ? (
          <Skeleton className="watch-page__player-skeleton" radius="lg" />
        ) : isRouteValid ? (
          <VidStuckPlayer
            options={playerOptions}
            ref={playerHandleRef}
            title={resolvedTitle || 'DAITIGN title'}
          />
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

