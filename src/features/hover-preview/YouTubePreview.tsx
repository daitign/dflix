import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/primitives/IconButton';
import type { TmdbVideo } from '../../lib/tmdb/types';
import { isMobileTouchDevice, shouldTrailerBeAudible, usePreviewAudio } from '../preview-audio';

const YOUTUBE_API_SCRIPT_ID = 'daitign-youtube-iframe-api';
const PLAYER_START_TIMEOUT_MS = 12_000;

interface YouTubePlayer {
  destroy: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  getIframe: () => HTMLIFrameElement;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume?: (volume: number) => void;
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
  heroVolumeFactor?: number;
  isAudible?: boolean;
  isHeroInView?: boolean;
  onPlaying?: () => void;
  title: string;
  variant?: 'hover' | 'hero' | 'modal';
  video?: TmdbVideo;
  videos?: TmdbVideo[];
}

export function YouTubePreview({
  className = '',
  heroVolumeFactor = 1,
  isAudible: isAudibleProp,
  isHeroInView = true,
  onPlaying,
  title,
  variant = 'hover',
  video,
  videos,
}: YouTubePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const hasStartedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const loopIntervalRef = useRef<number>(0);
  const currentVolumeRef = useRef<number>(100);
  const isMutedRef = useRef<boolean>(false);
  const fadeIntervalRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const candidateList = useMemo(() => {
    if (videos && videos.length > 0) return videos;
    if (video) return [video];
    return [];
  }, [video, videos]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const activeVideo = candidateList[candidateIndex] ?? candidateList[0];

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateList]);

  const {
    isAudible: contextIsAudible,
    isHoverActive,
    isModalActive,
    setAutoplaySoundAllowed,
    toggleSound,
  } = usePreviewAudio();

  const isAudible = isAudibleProp !== undefined ? isAudibleProp : contextIsAudible;

  const isHero = variant === 'hero';
  const isModal = variant === 'modal';
  const shouldBeAudible = shouldTrailerBeAudible({
    variant,
    isAudible,
    isHoverActive,
    isModalActive,
  });

  const shouldBeAudibleRef = useRef(shouldBeAudible);
  shouldBeAudibleRef.current = shouldBeAudible;

  const heroVolumeFactorRef = useRef(heroVolumeFactor);
  heroVolumeFactorRef.current = heroVolumeFactor;

  const isHeroInViewRef = useRef(isHeroInView);
  isHeroInViewRef.current = isHeroInView;

  // Playback state arbitration (Play / Pause when scrolled out of view or modal/hover opens)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !hasStarted) return;

    if (isHero) {
      const shouldPlay = isHeroInView && !isHoverActive && !isModalActive;
      if (!shouldPlay && isPlayingRef.current) {
        isPlayingRef.current = false;
        try {
          player.pauseVideo();
        } catch {}
      } else if (shouldPlay && !isPlayingRef.current) {
        isPlayingRef.current = true;
        try {
          player.playVideo();
        } catch {}
      }
    } else if (isModal) {
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        try {
          player.playVideo();
        } catch {}
      }
    }
  }, [hasStarted, isHero, isHeroInView, isHoverActive, isModal, isModalActive]);

  // Audio state & volume fade arbitration (smooth gradual fade on scroll / mute toggle)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !hasStarted) return;

    const stopFade = () => {
      if (fadeIntervalRef.current !== null) {
        window.clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };

    if (isHero) {
      // If modal or hover is active, immediately silence hero so audio streams never collide
      const isOverridden = isHoverActive || isModalActive;
      if (isOverridden) {
        stopFade();
        try {
          player.mute();
          player.setVolume?.(0);
        } catch {}
        currentVolumeRef.current = 0;
        isMutedRef.current = true;
        return;
      }

      // Target volume: 0 if not in view or muted; otherwise scaled by heroVolumeFactor (0..100)
      const targetVol = isHeroInView && shouldBeAudible
        ? Math.max(0, Math.min(100, Math.round(heroVolumeFactor * 100)))
        : 0;

      // If already at target, settle immediately
      if (Math.round(currentVolumeRef.current) === targetVol) {
        stopFade();
        if (targetVol === 0 && !isMutedRef.current) {
          try {
            player.setVolume?.(0);
            player.mute();
          } catch {}
          isMutedRef.current = true;
        } else if (targetVol > 0 && isMutedRef.current) {
          try {
            player.unMute();
            player.setVolume?.(targetVol);
          } catch {}
          isMutedRef.current = false;
        }
        return;
      }

      // Smooth volume ramp: gradually interpolate current volume towards targetVol over ~400ms
      stopFade();
      fadeIntervalRef.current = window.setInterval(() => {
        const current = currentVolumeRef.current;
        const diff = targetVol - current;

        // Reached target
        if (Math.abs(diff) <= 2) {
          currentVolumeRef.current = targetVol;
          stopFade();
          try {
            if (targetVol > 0) {
              if (isMutedRef.current) {
                player.unMute();
                isMutedRef.current = false;
              }
              player.setVolume?.(targetVol);
            } else {
              player.setVolume?.(0);
              player.mute();
              isMutedRef.current = true;
            }
          } catch {}
          return;
        }

        // Adaptive natural fade step: larger at top, smooth taper near silence
        const step = Math.sign(diff) * Math.max(2.5, Math.min(10, Math.abs(diff) * 0.22));
        const nextVol = Math.max(0, Math.min(100, current + step));
        currentVolumeRef.current = nextVol;
        const rounded = Math.round(nextVol);

        try {
          if (rounded > 0) {
            if (isMutedRef.current) {
              player.unMute();
              isMutedRef.current = false;
            }
            player.setVolume?.(rounded);
          } else {
            player.setVolume?.(0);
            player.mute();
            isMutedRef.current = true;
          }
        } catch {}
      }, 35);
    } else if (isModal) {
      stopFade();
      const isMobile = isMobileTouchDevice();
      try {
        if (shouldBeAudible && (!isMobile || isAudibleProp)) {
          player.unMute();
          player.setVolume?.(100);
          currentVolumeRef.current = 100;
          isMutedRef.current = false;
        } else {
          player.setVolume?.(0);
          player.mute();
          currentVolumeRef.current = 0;
          isMutedRef.current = true;
        }
      } catch {}
    } else {
      // Hover preview
      stopFade();
      try {
        if (shouldBeAudible) {
          player.unMute();
          player.setVolume?.(100);
          currentVolumeRef.current = 100;
          isMutedRef.current = false;
        } else {
          player.setVolume?.(0);
          player.mute();
          currentVolumeRef.current = 0;
          isMutedRef.current = true;
        }
      } catch {}
    }

    return () => {
      stopFade();
    };
  }, [
    hasStarted,
    heroVolumeFactor,
    isHero,
    isHeroInView,
    isHoverActive,
    isModal,
    isModalActive,
    shouldBeAudible,
  ]);

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

    const handleVideoError = (targetPlayer?: YouTubePlayer) => {
      clearStartTimeout();
      if (candidateIndex + 1 < candidateList.length) {
        console.warn(`[DAITIGN Autoplay] Video error on ${activeVideo?.key}, falling back to candidate ${candidateIndex + 1}`);
        const activePlayer = targetPlayer ?? playerRef.current;
        playerRef.current = null;
        destroyPlayer(activePlayer);
        setCandidateIndex((idx) => idx + 1);
      } else {
        markUnavailable(targetPlayer);
      }
    };

    if (!activeVideo) {
      setIsUnavailable(true);
      return;
    }

    loadYouTubeApi()
      .then((api) => {
        if (disposed || !mountRef.current) return;

        const isMobile = isMobileTouchDevice();
        const wantSound = shouldBeAudibleRef.current && !isMobile;
        let playbackStarted = false;

        const player = new api.Player(mountRef.current, {
          height: '100%',
          width: '100%',
          videoId: activeVideo.key,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            loop: 1,
            modestbranding: 1,
            mute: 1,
            origin: window.location.origin,
            playlist: activeVideo.key,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onError: (event) => handleVideoError(event.target),
            onReady: (event) => {
              if (disposed) {
                destroyPlayer(event.target);
                return;
              }

              const iframe = event.target.getIframe();
              iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
              iframe.setAttribute('playsinline', '1');
              iframe.referrerPolicy = 'strict-origin-when-cross-origin';
              iframe.tabIndex = -1;
              iframe.title = `${title} trailer preview`;

              // 10 Specific Diagnostic Loggers (PART H)
              console.log('[DAITIGN TV Preview] 1. trailer selected:', activeVideo.name || activeVideo.key, `(${activeVideo.type})`);
              console.log('[DAITIGN TV Preview] 2. YouTube video key:', activeVideo.key);
              console.log('[DAITIGN TV Preview] 3. iframe created:', iframe.tagName);
              console.log('[DAITIGN TV Preview] 4. iframe loaded for key:', activeVideo.key);
              console.log('[DAITIGN TV Preview] 5. autoplay requested for:', title);
              console.log('[DAITIGN TV Preview] 8. sound preference:', shouldBeAudibleRef.current ? 'audible (sound ON)' : 'muted (sound OFF)');
              console.log('[DAITIGN TV Preview] 9. visibility state:', document.visibilityState, 'heroInView:', isHeroInViewRef.current);
              console.log('[DAITIGN TV Preview] 10. WebView media settings: mediaPlaybackRequiresUserGesture=false, ua:', navigator.userAgent);

              // Attempt sound ON first if requested; if policy rejects/pauses, retry muted immediately
              if (wantSound) {
                console.log('[DAITIGN TV Preview] 7. muted state: unmuted attempt (DAITIGN preference)');
                try {
                  event.target.unMute();
                  event.target.setVolume?.(100);
                  currentVolumeRef.current = 100;
                  isMutedRef.current = false;
                } catch {
                  event.target.mute();
                  currentVolumeRef.current = 0;
                  isMutedRef.current = true;
                }
              } else {
                console.log('[DAITIGN TV Preview] 7. muted state: muted');
                event.target.mute();
                currentVolumeRef.current = 0;
                isMutedRef.current = true;
              }

              try {
                event.target.playVideo();
                console.log('[DAITIGN TV Preview] 6. play promise result: playVideo() invoked');
              } catch (err) {
                console.warn('[DAITIGN TV Preview] 6. play promise result: playVideo error, retrying muted', err);
                console.log('[DAITIGN TV Preview] 7. muted state: muted (recovery)');
                event.target.mute();
                event.target.playVideo();
                currentVolumeRef.current = 0;
                isMutedRef.current = true;
              }

              // TV Playback Watchdog: If playback does NOT start within 1.5s, retry muted immediately
              if (watchdogTimerRef.current !== null) {
                window.clearTimeout(watchdogTimerRef.current);
              }
              watchdogTimerRef.current = window.setTimeout(() => {
                if (disposed || playbackStarted) return;
                console.warn('[DAITIGN TV Preview] 6. play promise result: Playback did not start within 1500ms, watchdog forcing muted retry');
                console.log('[DAITIGN TV Preview] 7. muted state: muted (watchdog recovery)');
                try {
                  event.target.mute();
                  event.target.setVolume?.(0);
                  event.target.playVideo();
                  currentVolumeRef.current = 0;
                  isMutedRef.current = true;
                } catch (e) {
                  console.error('[DAITIGN TV Preview] Watchdog retry failed:', e);
                }
              }, 1500);
            },
            onStateChange: (event) => {
              if (disposed) return;

              if (event.data === api.PlayerState.PLAYING) {
                console.log('[DAITIGN TV Preview] 6. play promise result: success (PLAYING)');
                playbackStarted = true;
                if (watchdogTimerRef.current !== null) {
                  window.clearTimeout(watchdogTimerRef.current);
                  watchdogTimerRef.current = null;
                }
                clearStartTimeout();
                if (!hasStartedRef.current) {
                  hasStartedRef.current = true;
                  isPlayingRef.current = true;
                  setHasStarted(true);
                  onPlaying?.();
                }

                // Seamless loop monitor: loop 0.6s before end to prevent YouTube "More videos" / related videos screen
                window.clearInterval(loopIntervalRef.current);
                loopIntervalRef.current = window.setInterval(() => {
                  try {
                    const current = event.target.getCurrentTime?.() ?? 0;
                    const duration = event.target.getDuration?.() ?? 0;
                    if (duration > 2 && duration - current < 0.6) {
                      event.target.seekTo(0.1, true);
                    }
                  } catch {}
                }, 250);

                const isMobile = isMobileTouchDevice();

                // Initial sound & volume setup for newly started player
                if (isHero) {
                  // On mobile touch devices, never auto-unmute on initial load to avoid iOS WebKit pausing the video
                  const targetVol = isHeroInViewRef.current && shouldBeAudibleRef.current && !isMobile
                    ? Math.max(0, Math.min(100, Math.round(heroVolumeFactorRef.current * 100)))
                    : 0;
                  if (targetVol > 0) {
                    try {
                      event.target.unMute();
                      event.target.setVolume?.(targetVol);
                      currentVolumeRef.current = targetVol;
                      isMutedRef.current = false;
                    } catch {
                      event.target.mute();
                      currentVolumeRef.current = 0;
                      isMutedRef.current = true;
                      setAutoplaySoundAllowed(false);
                    }
                  } else {
                    event.target.mute();
                    currentVolumeRef.current = 0;
                    isMutedRef.current = true;
                  }

                  if (!isHeroInViewRef.current) {
                    try {
                      event.target.pauseVideo();
                      isPlayingRef.current = false;
                    } catch {}
                  }
                } else if (isModal) {
                  // On mobile touch devices, never auto-unmute on initial load to avoid iOS WebKit pausing the video
                  if (shouldBeAudibleRef.current && !isMobile) {
                    try {
                      event.target.unMute();
                      event.target.setVolume?.(100);
                      currentVolumeRef.current = 100;
                      isMutedRef.current = false;
                    } catch {
                      event.target.mute();
                      currentVolumeRef.current = 0;
                      isMutedRef.current = true;
                      setAutoplaySoundAllowed(false);
                    }
                  } else {
                    event.target.mute();
                    currentVolumeRef.current = 0;
                    isMutedRef.current = true;
                  }
                } else if (shouldBeAudibleRef.current) {
                  try {
                    event.target.unMute();
                    event.target.setVolume?.(100);
                    currentVolumeRef.current = 100;
                    isMutedRef.current = false;
                  } catch {
                    event.target.mute();
                    currentVolumeRef.current = 0;
                    isMutedRef.current = true;
                    setAutoplaySoundAllowed(false);
                  }
                } else {
                  event.target.mute();
                  currentVolumeRef.current = 0;
                  isMutedRef.current = true;
                }
                return;
              }

              // Autoplay rejection / unexpected pause recovery:
              // If browser or iOS WebKit paused player unexpectedly while it was intended to play,
              // immediately re-mute and resume playback so the video never stays paused with overlay controls.
              if (event.data === api.PlayerState.PAUSED) {
                window.clearInterval(loopIntervalRef.current);
                if (isPlayingRef.current || !hasStartedRef.current) {
                  console.warn('[DAITIGN TV Preview] 6. play promise result: paused by browser/system policy, immediately retrying muted');
                  console.log('[DAITIGN TV Preview] 7. muted state: muted (recovery)');
                  try {
                    event.target.mute();
                    event.target.playVideo();
                    currentVolumeRef.current = 0;
                    isMutedRef.current = true;
                    setAutoplaySoundAllowed(false);
                  } catch {}
                }
                return;
              }

              // Autoplay queuing recovery: if YouTube API cued the video instead of auto-starting,
              // force playVideo() so it starts without requiring a tap on the video.
              if (event.data === 5 /* CUED */) {
                console.log('[DAITIGN TV Preview] 6. play promise result: CUED state received, forcing playVideo()');
                try {
                  event.target.mute();
                  event.target.playVideo();
                } catch {}
                return;
              }

              if (event.data === api.PlayerState.ENDED) {
                window.clearInterval(loopIntervalRef.current);
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
      if (watchdogTimerRef.current !== null) {
        window.clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      window.clearInterval(loopIntervalRef.current);
      if (fadeIntervalRef.current !== null) {
        window.clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      const player = playerRef.current;
      playerRef.current = null;
      destroyPlayer(player);
    };
  }, [activeVideo?.key, candidateIndex, candidateList.length, onPlaying, setAutoplaySoundAllowed, title]);

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

