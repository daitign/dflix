import { useEffect, useState } from 'react';
import { isTVMode } from '../../lib/tv';

const MIN_AUTOPLAY_WIDTH = 1024;
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface PreviewPlaybackConditions {
  hasFinePointer: boolean;
  prefersReducedMotion: boolean;
  viewportWidth: number;
}

export function shouldAutoplayHoverPreview({
  hasFinePointer,
  prefersReducedMotion,
  viewportWidth,
}: PreviewPlaybackConditions) {
  return viewportWidth >= MIN_AUTOPLAY_WIDTH
    && hasFinePointer
    && !prefersReducedMotion;
}

function getEligibility() {
  // Android TV WebViews can inherit the television's global animator setting
  // as reduced motion. TV previews are an explicit ten-foot UI feature, so TV
  // mode must be resolved before applying browser accessibility heuristics.
  if (isTVMode()) return true;
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;
  return shouldAutoplayHoverPreview({
    hasFinePointer: window.matchMedia(FINE_POINTER_QUERY).matches,
    prefersReducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
    viewportWidth: window.innerWidth,
  });
}

export function usePreviewPlaybackEligibility() {
  const [isEligible, setIsEligible] = useState(() => (typeof window !== 'undefined' ? getEligibility() : false));

  useEffect(() => {
    const finePointer = window.matchMedia(FINE_POINTER_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setIsEligible(getEligibility());

    update();
    finePointer.addEventListener('change', update);
    reducedMotion.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      finePointer.removeEventListener('change', update);
      reducedMotion.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isEligible;
}
