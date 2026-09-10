import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/primitives/IconButton';
import type { TmdbVideo } from '../../lib/tmdb/types';

const YOUTUBE_API_SCRIPT_ID = 'daitign-youtube-iframe-api';
const PLAYER_START_TIMEOUT_MS = 12_000;

interface YouTubePlayer {
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
  mute: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  stopVideo: () => void;
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

interface YouTubePreviewProps {
  title: string;
  video: TmdbVideo;
}

export function YouTubePreview({ title, video }: YouTubePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    let disposed = false;
    let startTimeout = window.setTimeout(() => {
      const player = playerRef.current;
      playerRef.current = null;
      player?.stopVideo();
      player?.destroy();
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
      activePlayer?.stopVideo();
      activePlayer?.destroy();
      if (!disposed) setIsUnavailable(true);
    };

    setHasStarted(false);
    setIsMuted(true);
    setIsUnavailable(false);

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
                event.target.destroy();
                return;
              }

              const iframe = event.target.getIframe();
              iframe.allow = 'autoplay; encrypted-media';
              iframe.referrerPolicy = 'strict-origin-when-cross-origin';
              iframe.tabIndex = -1;
              iframe.title = `${title} trailer preview`;
              event.target.mute();
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (disposed) return;
              if (event.data === api.PlayerState.PLAYING) {
                clearStartTimeout();
                setHasStarted(true);
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
      player?.stopVideo();
      player?.destroy();
    };
  }, [title, video.key]);

  if (isUnavailable) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className={`hover-preview-card__video${hasStarted ? ' hover-preview-card__video--playing' : ''}`}
      >
        <div className="hover-preview-card__video-mount" ref={mountRef} />
      </div>
      {hasStarted && (
        <IconButton
          aria-label={`${isMuted ? 'Unmute' : 'Mute'} trailer preview for ${title}`}
          aria-pressed={!isMuted}
          className="hover-preview-card__audio-toggle"
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            if (isMuted) player.unMute();
            else player.mute();
            setIsMuted((current) => !current);
          }}
          size="sm"
          tone="glass"
          tooltip={isMuted ? 'Unmute Preview' : 'Mute Preview'}
        >
          <Icon name={isMuted ? 'volumeOff' : 'volume'} size={17} />
        </IconButton>
      )}
    </>
  );
}
