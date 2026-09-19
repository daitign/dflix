import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/primitives/IconButton';
import type { TmdbVideo } from '../../lib/tmdb/types';
import { isTVMode } from '../../lib/tv/tvDetection.ts';
import { isMobileTouchDevice, shouldTrailerBeAudible, usePreviewAudio } from '../preview-audio';
import { logTVPreviewStage } from './tvPreviewDiagnostics';

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

interface YouTubePlayerErrorEvent extends YouTubePlayerEvent {
  data: number;
}

interface YouTubePlayerOptions {
  events: {
    onError: (event: YouTubePlayerErrorEvent) => void;
    onReady: (event: YouTubePlayerEvent) => void;
    onStateChange: (event: YouTubePlayerStateEvent) => void;
  };
  height: string;
  playerVars: Record<string, number | string>;
  videoId: string;
  width: string;
}

interface YouTubeApi {
  Player: new (element: HTMLElement | string, options: YouTubePlayerOptions) => YouTubePlayer;
  PlayerState: {
    BUFFERING?: number;
    CUED?: number;
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
let youtubeMountSequence = 0;

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

function getYouTubeErrorMeaning(code: number): string {
  if (code === 2) return 'invalid parameter or video ID';
  if (code === 5) return 'HTML5 player playback failure';
  if (code === 100) return 'video unavailable or removed';
  if (code === 101 || code === 150) return 'owner disallows embedded playback';
  if (code === 153) return 'missing HTTP Referer or client identity';
  return 'unknown YouTube playback error';
}

export interface YouTubePreviewProps {
  className?: string;
  heroVolumeFactor?: number;
  isAudible?: boolean;
  isHeroInView?: boolean;
  onPlaying?: () => void;
  surface?: 'card' | 'details' | 'hero' | 'top10';
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
  surface,
  title,
  variant = 'hover',
  video,
  videos,
}: YouTubePreviewProps) {
  const diagnosticSurface = surface ?? variant;
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;
  const hasStartedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const loopIntervalRef = useRef<number>(0);
  const currentVolumeRef = useRef<number>(100);
  const isMutedRef = useRef<boolean>(false);
  const fadeIntervalRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const remoteSoundRetryRef = useRef(false);
  const isTVAppSuspendedRef = useRef(false);
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
    tvMediaInteractionUnlocked,
    toggleSound,
  } = usePreviewAudio();

  const isAudible = isAudibleProp !== undefined ? isAudibleProp : contextIsAudible;
  const tvMediaInteractionUnlockedRef = useRef(tvMediaInteractionUnlocked);
  tvMediaInteractionUnlockedRef.current = tvMediaInteractionUnlocked;

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
  const shouldResumeAfterSuspendRef = useRef(false);
  shouldResumeAfterSuspendRef.current = isHero
    ? isHeroInView && !isHoverActive && !isModalActive
    : (isModal ? isModalActive : isHoverActive);

  useEffect(() => {
    if (!isTVMode()) return;
    const handleTVAppVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ visible?: boolean; platform?: string }>).detail;
      const visible = detail?.visible !== false;
      isTVAppSuspendedRef.current = !visible;
      const player = playerRef.current;
      if (!player) return;
      try {
        if (!visible) {
          isPlayingRef.current = false;
          window.clearInterval(loopIntervalRef.current);
          player.pauseVideo();
          logTVPreviewStage('paused for TV app suspension', { platform: detail?.platform, title, surface: diagnosticSurface });
        } else if (shouldResumeAfterSuspendRef.current) {
          isPlayingRef.current = true;
          player.playVideo();
          logTVPreviewStage('resumed after TV app suspension', { platform: detail?.platform, title, surface: diagnosticSurface });
        }
      } catch {}
    };
    window.addEventListener('daitign:tv-app-visibility', handleTVAppVisibility);
    return () => window.removeEventListener('daitign:tv-app-visibility', handleTVAppVisibility);
  }, [diagnosticSurface, title]);

  useEffect(() => {
    if (!isTVMode()) return;
    const handleTVMediaInteraction = () => {
      const player = playerRef.current;
      if (!player) {
        logTVPreviewStage('media-unlock retry waiting for player', { title, surface: diagnosticSurface });
        return;
      }
      console.log('[DAITIGN TV Preview] remote media-unlock replay requested');
      try {
        if (shouldBeAudibleRef.current) {
          remoteSoundRetryRef.current = true;
          player.unMute();
          player.setVolume?.(100);
          currentVolumeRef.current = 100;
          isMutedRef.current = false;
        }
        player.playVideo();
        console.log('[DAITIGN TV Preview] playVideo called from remote interaction');
        logTVPreviewStage('playVideo() called from media unlock', {
          audio: shouldBeAudibleRef.current ? 'unmuted-retry' : 'muted-preference',
          title,
          surface: diagnosticSurface,
        });
      } catch (error) {
        console.warn('[DAITIGN TV Preview] remote media-unlock replay failed', error);
      }
    };
    window.addEventListener('daitign:tv-media-interaction', handleTVMediaInteraction);
    return () => window.removeEventListener('daitign:tv-media-interaction', handleTVMediaInteraction);
  }, []);

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
    logTVPreviewStage('shared preview engine mounted', {
      title, surface: diagnosticSurface, key: activeVideo?.key ?? null, origin: window.location.origin,
    });
    console.log('[DAITIGN TV Preview] preview selected:', title, 'variant:', variant);
    console.log('[DAITIGN TV Preview] trailer key:', activeVideo?.key ?? 'none');
    console.log('[DAITIGN TV Preview] preview mounted; document visibility:', document.visibilityState);
    hasStartedRef.current = false;
    remoteSoundRetryRef.current = false;
    setHasStarted(false);
    setIsUnavailable(false);

    let startTimeout = window.setTimeout(() => {
      const player = playerRef.current;
      playerRef.current = null;
      destroyPlayer(player);
      if (!disposed) setIsUnavailable(true);
    }, PLAYER_START_TIMEOUT_MS);
    let iframeRevealTimer = 0;
    let apiFallbackTimer = 0;
    let directRevealTimer = 0;
    let directFallbackActive = false;

    const clearStartTimeout = () => {
      window.clearTimeout(startTimeout);
      startTimeout = 0;
    };

    const markUnavailable = (player?: YouTubePlayer) => {
      clearStartTimeout();
      window.clearTimeout(iframeRevealTimer);
      window.clearTimeout(apiFallbackTimer);
      window.clearTimeout(directRevealTimer);
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

    const mountDirectIframeFallback = (reason: string) => {
      if (disposed || directFallbackActive || playerRef.current || !mountRef.current) return;
      directFallbackActive = true;

      const embedOrigin = 'https://www.youtube-nocookie.com';
      const params = new URLSearchParams({
        autoplay: '1',
        controls: '0',
        disablekb: '1',
        enablejsapi: '1',
        fs: '0',
        iv_load_policy: '3',
        loop: '1',
        modestbranding: '1',
        mute: '1',
        origin: window.location.origin,
        playlist: activeVideo.key,
        playsinline: '1',
        rel: '0',
      });
      const iframe = document.createElement('iframe');
      iframe.src = `${embedOrigin}/embed/${encodeURIComponent(activeVideo.key)}?${params.toString()}`;
      iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.tabIndex = -1;
      iframe.title = `${title} trailer preview`;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';

      const command = (func: string, args: unknown[] = []) => {
        iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), embedOrigin);
      };
      const directPlayer: YouTubePlayer = {
        destroy: () => iframe.remove(),
        getIframe: () => iframe,
        mute: () => command('mute'),
        pauseVideo: () => command('pauseVideo'),
        playVideo: () => command('playVideo'),
        seekTo: (seconds, allowSeekAhead) => command('seekTo', [seconds, allowSeekAhead]),
        setVolume: (volume) => command('setVolume', [volume]),
        unMute: () => command('unMute'),
      };
      const reveal = () => {
        if (disposed || hasStartedRef.current || !iframe.isConnected) return;
        directPlayer.mute();
        directPlayer.setVolume?.(0);
        directPlayer.playVideo();
        currentVolumeRef.current = 0;
        isMutedRef.current = true;
        isPlayingRef.current = true;
        hasStartedRef.current = true;
        setAutoplaySoundAllowed(false);
        setHasStarted(true);
        onPlayingRef.current?.();
        clearStartTimeout();
        console.warn(`[DAITIGN Preview] using direct iframe fallback: ${reason}`);
      };

      iframe.addEventListener('load', () => {
        directPlayer.playVideo();
        window.setTimeout(reveal, 80);
      }, { once: true });
      playerRef.current = directPlayer;
      mountRef.current.replaceChildren(iframe);
      directRevealTimer = window.setTimeout(reveal, 650);
    };

    // Windows browsers with strict tracking protection can create a normal
    // YouTube embed while blocking or delaying iframe_api. Start a lightweight
    // direct embed instead of leaving every preview surface empty.
    apiFallbackTimer = window.setTimeout(() => {
      mountDirectIframeFallback('iframe API readiness timeout');
    }, 900);

    loadYouTubeApi()
      .then((api) => {
        if (disposed || !mountRef.current) return;
        window.clearTimeout(apiFallbackTimer);
        if (directFallbackActive) return;
        logTVPreviewStage('YouTube API ready', { title, surface: diagnosticSurface, key: activeVideo.key });

        // Some Android/Fire WebView builds (and a few embedded Chromium
        // runtimes) drop the global YT reference after the first player is
        // destroyed. The resolved API object is still valid, but Player's
        // constructor and deferred callbacks consult window.YT internally.
        // Restore that reference before every surface hand-off so moving from
        // Hero -> card -> Details can create a fresh iframe reliably.
        if (!window.YT?.Player) window.YT = api;

        // YouTube replaces the element passed to YT.Player with an iframe.
        // Keep React's ref on a stable wrapper and give each player lifecycle a
        // fresh attached child. This survives StrictMode's setup/cleanup replay
        // and rapid focus changes without creating a detached iframe.
        const playerMount = document.createElement('div');
        playerMount.id = `daitign-youtube-preview-${++youtubeMountSequence}`;
        playerMount.style.width = '100%';
        playerMount.style.height = '100%';
        mountRef.current.replaceChildren(playerMount);

        const isMobile = isMobileTouchDevice();
        const wantSound = shouldBeAudibleRef.current && !isMobile;
        let playbackStarted = false;
        let mutedFallbackActive = false;

        // Supplying the attached element ID is the most compatible IFrame API
        // path across Chromium, Android System WebView and Fire OS WebView.
        const player = new api.Player(playerMount.id, {
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
            onError: (event) => {
              window.clearTimeout(iframeRevealTimer);
              logTVPreviewStage('YouTube player error', {
                title,
                surface: diagnosticSurface,
                key: activeVideo.key,
                code: event.data,
                meaning: getYouTubeErrorMeaning(event.data),
              });
              handleVideoError(event.target);
            },
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

              console.log('[DAITIGN TV Preview] API ready');
              console.log('[DAITIGN TV Preview] iframe created');
              console.log('[DAITIGN TV Preview] params enablejsapi=1 autoplay=1 playsinline=1 origin=' + window.location.origin);
              console.log('[DAITIGN TV Preview] tvMediaInteractionUnlocked=' + tvMediaInteractionUnlockedRef.current);
              logTVPreviewStage('iframe/player created', {
                title,
                surface: diagnosticSurface,
                key: activeVideo.key,
                enablejsapi: 1,
                autoplay: 1,
                playsinline: 1,
                origin: window.location.origin,
              });

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
              logTVPreviewStage('audio attempt', {
                mode: wantSound ? 'unmuted' : 'muted',
                savedMediaUnlock: tvMediaInteractionUnlockedRef.current,
                surface: diagnosticSurface,
                title,
              });
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
                console.log('[DAITIGN TV Preview] playVideo called (sound-on attempt=' + wantSound + ')');
                logTVPreviewStage('playVideo() called', { title, surface: diagnosticSurface, soundOn: wantSound });
              } catch (err) {
                console.warn('[DAITIGN TV Preview] 6. play promise result: playVideo error, retrying muted', err);
                console.log('[DAITIGN TV Preview] 7. muted state: muted (recovery)');
                mutedFallbackActive = true;
                event.target.mute();
                event.target.playVideo();
                currentVolumeRef.current = 0;
                isMutedRef.current = true;
              }

              if (isTVMode()) {
                window.setTimeout(() => {
                  if (disposed || playbackStarted) return;
                  try {
                    event.target.playVideo();
                    console.log('[DAITIGN TV Preview] playVideo called (Android TV confirmation retry)');
                  } catch {}
                }, 220);
              }

              // TV Playback Watchdog: If playback does NOT start within 1.5s, retry muted immediately
              if (watchdogTimerRef.current !== null) {
                window.clearTimeout(watchdogTimerRef.current);
              }
              watchdogTimerRef.current = window.setTimeout(() => {
                if (disposed || playbackStarted) return;
                console.warn('[DAITIGN TV Preview] autoplay timeout after 1500ms');
                console.log('[DAITIGN TV Preview] muted retry');
                logTVPreviewStage('autoplay timeout; muted retry', { title, surface: diagnosticSurface, key: activeVideo.key });
                try {
                  mutedFallbackActive = true;
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

              const stateNames: Record<number, string> = {
                [-1]: 'UNSTARTED',
                [api.PlayerState.ENDED]: 'ENDED',
                [api.PlayerState.PLAYING]: 'PLAYING',
                [api.PlayerState.PAUSED]: 'PAUSED',
                [api.PlayerState.BUFFERING ?? 3]: 'BUFFERING',
                [api.PlayerState.CUED ?? 5]: 'CUED',
              };
              console.log(`[DAITIGN TV Preview] state = ${stateNames[event.data] ?? event.data}`);
              logTVPreviewStage('player state', {
                title, surface: diagnosticSurface, key: activeVideo.key, state: stateNames[event.data] ?? event.data,
              });

              if (event.data === api.PlayerState.PLAYING) {
                window.clearTimeout(iframeRevealTimer);
                console.log('[DAITIGN TV Preview] 6. play promise result: success (PLAYING)');
                playbackStarted = true;
                logTVPreviewStage('playback confirmed', {
                  audio: mutedFallbackActive && !remoteSoundRetryRef.current
                    ? 'muted-fallback'
                    : (shouldBeAudibleRef.current ? 'unmuted' : 'muted'),
                  surface: diagnosticSurface,
                  title,
                });
                if (watchdogTimerRef.current !== null) {
                  window.clearTimeout(watchdogTimerRef.current);
                  watchdogTimerRef.current = null;
                }
                clearStartTimeout();
                if (!hasStartedRef.current) {
                  hasStartedRef.current = true;
                  isPlayingRef.current = true;
                  setHasStarted(true);
                  onPlayingRef.current?.();
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

                // Once WebView autoplay required a muted retry, keep this player
                // muted. Immediately unmuting here can make Android WebView block
                // or pause the same autoplay again.
                if (mutedFallbackActive && !remoteSoundRetryRef.current) {
                  try {
                    event.target.mute();
                    event.target.setVolume?.(0);
                  } catch {}
                  currentVolumeRef.current = 0;
                  isMutedRef.current = true;
                  setAutoplaySoundAllowed(false);
                  if (isHero && !isHeroInViewRef.current) {
                    try {
                      event.target.pauseVideo();
                      isPlayingRef.current = false;
                    } catch {}
                  }
                  return;
                }

                // A physical remote interaction is a real user gesture. If it
                // unlocks sound after the muted fallback, do not let the stale
                // fallback flag immediately mute the successful retry again.
                if (remoteSoundRetryRef.current && shouldBeAudibleRef.current) {
                  try {
                    event.target.unMute();
                    event.target.setVolume?.(100);
                  } catch {}
                  currentVolumeRef.current = 100;
                  isMutedRef.current = false;
                  mutedFallbackActive = false;
                  remoteSoundRetryRef.current = false;
                }

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
                if (isTVAppSuspendedRef.current) return;
                if (isPlayingRef.current || !hasStartedRef.current) {
                  console.warn('[DAITIGN TV Preview] 6. play promise result: paused by browser/system policy, immediately retrying muted');
                  console.log('[DAITIGN TV Preview] 7. muted state: muted (recovery)');
                  try {
                    mutedFallbackActive = true;
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
                  mutedFallbackActive = true;
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
        if (!window.YT?.Player) window.YT = api;

        iframeRevealTimer = window.setTimeout(() => {
          if (disposed || hasStartedRef.current || !mountRef.current) return;
          const iframe = mountRef.current.querySelector('iframe');
          if (!iframe) return;

          // Some Windows browsers and television WebViews successfully create
          // and autoplay the embed but never deliver IFrame API callbacks. Do
          // not leave that working video permanently transparent. The normal
          // PLAYING callback can still refine audio/state if it arrives later.
          try {
            if (shouldBeAudibleRef.current) {
              player.unMute();
              player.setVolume?.(100);
            } else {
              player.mute();
              player.setVolume?.(0);
            }
            player.playVideo();
          } catch {}
          hasStartedRef.current = true;
          setHasStarted(true);
          onPlayingRef.current?.();
          clearStartTimeout();
          logTVPreviewStage('iframe readiness fallback revealed preview', {
            title, surface: diagnosticSurface, key: activeVideo.key,
          });
        }, 650);
      })
      .catch((error) => {
        window.clearTimeout(apiFallbackTimer);
        if (!disposed && !directFallbackActive) {
          mountDirectIframeFallback(error instanceof Error ? error.message : 'iframe API failed');
          return;
        }
        console.error('[DAITIGN TV Preview] iframe/API creation failed:', error);
        logTVPreviewStage('YouTube API/player creation failed', {
          title, surface: diagnosticSurface, key: activeVideo?.key ?? null, error: error instanceof Error ? error.message : String(error),
        });
        markUnavailable();
      });

    return () => {
      disposed = true;
      console.log('[DAITIGN TV Preview] preview unmounted:', title, 'key:', activeVideo?.key ?? 'none');
      logTVPreviewStage('preview destroyed', {
        reason: 'surface-unmounted-or-video-changed',
        title,
        surface: diagnosticSurface,
        key: activeVideo?.key ?? null,
      });
      clearStartTimeout();
      window.clearTimeout(iframeRevealTimer);
      window.clearTimeout(apiFallbackTimer);
      window.clearTimeout(directRevealTimer);
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
      mountRef.current?.replaceChildren();
    };
  }, [activeVideo?.key, candidateIndex, candidateList.length, setAutoplaySoundAllowed, title, variant]);

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
