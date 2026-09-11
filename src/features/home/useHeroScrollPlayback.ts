import { useEffect, useRef, useState, type RefObject } from 'react';

export interface HeroScrollPlaybackState {
  isHeroInView: boolean;
  heroVolumeFactor: number;
}

/**
 * Calculates volume fade factor based on scroll offset from the top of the hero banner.
 * At scroll offset 0 (top of page), volume is 1.0 (100%).
 * As user scrolls down, volume smoothly fades towards 0.0 over fadeDistance pixels.
 * Negative scroll (iOS rubber-banding / bounce) is clamped to 1.0.
 */
export function calculateHeroVolumeFade(scrollOffset: number, fadeDistance = 320): number {
  if (scrollOffset <= 0) return 1;
  if (scrollOffset >= fadeDistance) return 0;
  const factor = 1 - scrollOffset / fadeDistance;
  return Math.max(0, Math.min(1, Math.round(factor * 100) / 100));
}

/**
 * Determines whether the hero banner element is sufficiently visible in the viewport
 * to warrant trailer playback.
 */
export function isHeroElementInView(
  rect: { bottom: number; top: number } | null,
  windowHeight: number
): boolean {
  if (!rect) return false;
  // Hero is in view when its bottom has not scrolled past the navbar/top threshold (> 60px)
  // and its top is within/above the viewport bottom
  return rect.bottom > 60 && rect.top < windowHeight;
}

/**
 * Hook that monitors the hero banner's scroll position and visibility.
 * - Smoothly fades hero trailer volume down to 0% as the user scrolls down.
 * - Signals to pause trailer playback when the hero banner is scrolled out of the viewport.
 * - Resumes trailer playback and fades volume back in when the user scrolls back up.
 * - Pauses playback when the browser tab is hidden or minimized.
 */
export function useHeroScrollPlayback(
  heroRef: RefObject<HTMLElement | null>
): HeroScrollPlaybackState {
  const [isHeroInView, setIsHeroInView] = useState(true);
  const [heroVolumeFactor, setHeroVolumeFactor] = useState(1);
  const rafIdRef = useRef<number>(0);
  const lastFactorRef = useRef(1);
  const lastInViewRef = useRef(true);

  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl || typeof window === 'undefined') return;

    const updatePlaybackState = () => {
      // Pause and mute when browser tab is inactive or hidden
      if (document.hidden) {
        if (lastInViewRef.current) {
          lastInViewRef.current = false;
          setIsHeroInView(false);
        }
        if (lastFactorRef.current !== 0) {
          lastFactorRef.current = 0;
          setHeroVolumeFactor(0);
        }
        return;
      }

      const rect = heroEl.getBoundingClientRect();
      const inView = isHeroElementInView(rect, window.innerHeight);

      if (inView !== lastInViewRef.current) {
        lastInViewRef.current = inView;
        setIsHeroInView(inView);
      }

      // Scroll distance down from top of hero banner
      const scrollDown = Math.max(0, -rect.top);
      // Gentle fade distance: 320px or 45% of hero height, minimum 160px
      const fadeDist = Math.max(160, Math.min(320, rect.height * 0.45));
      const factor = calculateHeroVolumeFade(scrollDown, fadeDist);

      // Only update state if volume factor changed by at least 2% or reached boundaries (0 or 1)
      if (
        Math.abs(factor - lastFactorRef.current) >= 0.02 ||
        (factor === 0 && lastFactorRef.current !== 0) ||
        (factor === 1 && lastFactorRef.current !== 1)
      ) {
        lastFactorRef.current = factor;
        setHeroVolumeFactor(factor);
      }
    };

    const onScroll = () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(updatePlaybackState);
    };

    const onVisibilityChange = () => {
      updatePlaybackState();
    };

    // Initial check
    updatePlaybackState();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    // IntersectionObserver for guaranteed viewport tracking
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]) onScroll();
        },
        {
          root: null,
          threshold: [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0],
        }
      );
      observer.observe(heroEl);
    }

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observer?.disconnect();
    };
  }, [heroRef]);

  return { isHeroInView, heroVolumeFactor };
}
