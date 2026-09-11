import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface HeroPlaybackConditions {
  isLowBandwidth: boolean;
  prefersReducedMotion: boolean;
  saveData: boolean;
  viewportWidth: number;
}

export function shouldAutoplayHeroTrailer({
  isLowBandwidth,
  prefersReducedMotion,
  saveData,
  viewportWidth,
}: HeroPlaybackConditions): boolean {
  if (prefersReducedMotion) return false;
  if (saveData) return false;
  if (isLowBandwidth) return false;
  // Preserve mobile data & battery on ultra-compact mobile screens (< 480px)
  if (viewportWidth < 480) return false;
  return true;
}

function getHeroEligibility(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } };
  const connection = nav.connection;
  const isLowBandwidth = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
  const saveData = connection?.saveData === true;
  const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

  return shouldAutoplayHeroTrailer({
    isLowBandwidth,
    prefersReducedMotion,
    saveData,
    viewportWidth: window.innerWidth,
  });
}

export function useHeroPlaybackEligibility(): boolean {
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setIsEligible(getHeroEligibility());

    update();
    reducedMotion.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      reducedMotion.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isEligible;
}
