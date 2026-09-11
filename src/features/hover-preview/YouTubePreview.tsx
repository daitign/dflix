import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/primitives/IconButton';
import type { TmdbVideo } from '../../lib/tmdb/types';
import { shouldTrailerBeAudible, usePreviewAudio } from '../preview-audio';

const YOUTUBE_API_SCRIPT_ID = 'daitign-youtube-iframe-api';
const PLAYER_START_TIMEOUT_MS = 12_000;

interface YouTubePlayer {
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  unMute: () => void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
}

interface YouTubePlayerStateEvent extends YouTubePlayerEvent {
  data: number;
}

interface YouTubePlayerOptions {
  events: {
    onError: (event: YouTubePlayerEvent) => void;
    onReady: (event: YouTubePlayerEvent) => void;
    onStateChange: (event: YouTubePlayerStateEvent) => void;
  };
  height: string;
  playerVars: Record<string, number | string>;
  videoId: string;
  width: string;
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PAUSED: number;
    PLAYING: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function destroyPlayer(player?: YouTubePlayer | null) {
  if (!player) return;

  try {
    player.destroy?.();
  } catch {
    // A rapidly closed preview can dispose the YouTube object before it finishes initializing.
  }
}

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      youtubeApiPromise = null;
      reject(new Error('The YouTube preview player did not load.'));
    }, PLAYER_START_TIMEOUT_MS);

    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      if (settled || !window.YT?.Player) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(window.YT);
    };

    const existingScript = document.getElementById(YOUTUBE_API_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');
    const handleError = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      youtubeApiPromise = null;
      if (!existingScript) script.remove();
      reject(new Error('The YouTube preview player could not be loaded.'));
    };

    script.addEventListener('error', handleError, { once: true });
    if (!existingScript) {
      script.async = true;
      script.id = YOUTUBE_API_SCRIPT_ID;
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.append(script);
    }
  });

  return youtubeApiPromise;
}

export interface YouTubePreviewProps {
  className?: string;
  onPlaying?: () => void;
  title: string;
  variant?: 'hover' | 'hero' | 'modal';
  video: TmdbVideo;
}

export function YouTubePreview({
  className = '',
  onPlaying,
  title,
  variant = 'hover',
  video,
}: YouTubePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const hasStartedRef = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const {
    isAudible,
    isHoverActive,
    isModalActive,
    setAutoplaySoundAllowed,
    toggleSound,
  } = usePreviewAudio();

  const isHero = variant === 'hero';
  const isModal = variant === 'modal';
  const shouldBeAudible = shouldTrailerBeAudible({
    variant,
    isAudible,
    isHoverActive,
    isModalActive,
  });

  // React to audio state changes and preview arbitration
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !hasStarted) return;

    if (isHero) {
      if (isHoverActive || isModalActive) {
        // Pause and mute Hero while hover preview or Details modal is active
        try {
          player.mute();
          player.pauseVideo();
        } catch {}
      } else {
        // Resume Hero when neither hover preview nor modal is active
        try {
          player.playVideo();
          if (shouldBeAudible) {
            player.unMute();
          } else {
            player.mute();
          }
        } catch {}
      }
    } else if (isModal) {
      // Modal trailer audio state
      try {
        if (shouldBeAudible) {
          player.unMute();
        } else {
          player.mute();
        }
      } catch {}
    } else {
      // Hover preview audio update
      try {
        if (shouldBeAudible) {
          player.unMute();
        } else {
          player.mute();
        }
      } catch {}
    }
  }, [hasStarted, isHero, isHoverActive, isModal, isModalActive, shouldBeAudible]);

  useEffect(() => {
    let disposed = false;
    hasStartedRef.current = false;
    setHasStarted(false);
    setIsUnavailable(false);

    let startTimeout = window.setTimeout(() => {
      const player = playerRef.current;
      playerRef.current = null;
      destroyPlayer(player);
      if (!disposed) setIsUnavailable(true);
    }, PLAYER_START_TIMEOUT_MS);

    const clearStartTimeout = () => {
      window.clearTimeout(startTimeout);
      startTimeout = 0;
    };

    const markUnavailable = (player?: YouTubePlayer) => {
      clearStartTimeout();
      const activePlayer = player ?? playerRef.current;
      playerRef.current = null;
      destroyPlayer(activePlayer);
      if (!disposed) setIsUnavailable(true);
    };

    loadYouTubeApi()
      .then((api) => {
        if (disposed || !mountRef.current) return;

        const player = new api.Player(mountRef.current, {
          height: '100%',
          width: '100%',
          videoId: video.key,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            loop: 1,
            origin: window.location.origin,
            playlist: video.key,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onError: (event) => markUnavailable(event.target),
            onReady: (event) => {
              if (disposed) {
                destroyPlayer(event.target);
                return;
              }

              const iframe = event.target.getIframe();
              iframe.allow = 'autoplay; encrypted-media';
              iframe.referrerPolicy = 'strict-origin-when-cross-origin';
              iframe.tabIndex = -1;
              iframe.title = `${title} trailer preview`;

              // Always start muted initially so autoplay is guaranteed without browser block
              event.target.mute();
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (disposed) return;

              if (event.data === api.PlayerState.PLAYING) {
                clearStartTimeout();
                if (!hasStartedRef.current) {
                  hasStartedRef.current = true;
                  setHasStarted(true);
                  onPlaying?.();
                }

                // If sound should be on and browser permits it, attempt unmuting safely
                if (shouldBeAudible) {
                  try {
                    event.target.unMute();
                  } catch {
                    // Browser policy blocked unmuting; fallback to muted
                    event.target.mute();
                    setAutoplaySoundAllowed(false);
                  }
                } else {
                  event.target.mute();
                }
                return;
              }

              // Autoplay rejection recovery: If browser paused player because of sound, mute and resume immediately
              if (event.data === api.PlayerState.PAUSED && !hasStartedRef.current) {
                try {
                  event.target.mute();
                  event.target.playVideo();
                  setAutoplaySoundAllowed(false);
                } catch {}
                return;
              }

              if (event.data === api.PlayerState.ENDED) {
                event.target.seekTo(0, true);
                event.target.playVideo();
              }
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => markUnavailable());

    return () => {
      disposed = true;
      clearStartTimeout();
      const player = playerRef.current;
      playerRef.current = null;
      destroyPlayer(player);
    };
  }, [onPlaying, setAutoplaySoundAllowed, shouldBeAudible, title, video.key]);

  if (isUnavailable) return null;

  if (isHero) {
    return (
      <div
        aria-hidden="true"
        className={`hero-banner__trailer${hasStarted ? ' hero-banner__trailer--playing' : ''} ${className}`.trim()}
      >
        <div className="hero-banner__trailer-mount" ref={mountRef} />
      </div>
    );
  }

  if (isModal) {
    return (
      <div
        aria-hidden="true"
        className={`details-hero__trailer${hasStarted ? ' details-hero__trailer--playing' : ''} ${className}`.trim()}
      >
        <div className="details-hero__trailer-mount" ref={mountRef} />
      </div>
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        className={`hover-preview-card__video${hasStarted ? ' hover-preview-card__video--playing' : ''} ${className}`.trim()}
      >
        <div className="hover-preview-card__video-mount" ref={mountRef} />
      </div>
      {hasStarted && (
        <IconButton
          aria-label={`${isAudible ? 'Mute' : 'Unmute'} trailer preview for ${title}`}
          aria-pressed={isAudible}
          className="hover-preview-card__audio-toggle"
          onClick={toggleSound}
          size="sm"
          tone="glass"
          tooltip={isAudible ? 'Mute Preview' : 'Unmute Preview'}
        >
          <Icon name={isAudible ? 'volume' : 'volumeOff'} size={17} />
        </IconButton>
      )}
    </>
  );
}

