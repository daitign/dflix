/**
 * TV Safe Area and Resolution Constants.
 * In TV design, overscan boundaries (Title Safe and Action Safe) define
 * where interactive UI must reside. Video and full-bleed artwork extend
 * edge-to-edge (100vw, 100vh), while UI overlays are inset by safe areas.
 */

export interface TvSafeArea {
  horizontalPercent: number; // e.g. 5%
  verticalPercent: number;   // e.g. 4%
  horizontalPx: number;      // calculated px at 1080p
  verticalPx: number;        // calculated px at 1080p
}

export const TV_SAFE_AREA: TvSafeArea = {
  horizontalPercent: 5,
  verticalPercent: 4.5,
  horizontalPx: 96,
  verticalPx: 48,
};

export const TV_RESOLUTIONS = {
  HD_720P: { width: 1280, height: 720 },
  FHD_1080P: { width: 1920, height: 1080 },
  UHD_4K: { width: 3840, height: 2160 },
} as const;

export function getTvViewportDimensions(): { width: number; height: number } {
  if (typeof window === 'undefined') return TV_RESOLUTIONS.FHD_1080P;
  return {
    width: window.innerWidth || TV_RESOLUTIONS.FHD_1080P.width,
    height: window.innerHeight || TV_RESOLUTIONS.FHD_1080P.height,
  };
}
