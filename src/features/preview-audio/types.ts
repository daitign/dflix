export const SOUND_PREFERENCE_STORAGE_KEY = 'daitign-preview-sound';

export interface PreviewAudioContextValue {
  /**
   * User preference: whether sound should be enabled for previews.
   * Persisted in localStorage ('daitign-preview-sound': 'on' | 'off').
   * Default: true (SOUND ON).
   */
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;

  /**
   * Browser autoplay capability state:
   * True if the browser has permitted unmuted autoplay (e.g. after a user gesture
   * or confirmed unmuted playback).
   */
  autoplaySoundAllowed: boolean;
  setAutoplaySoundAllowed: (allowed: boolean) => void;

  /**
   * Effective audio state for active preview:
   * true if user wants sound AND browser currently permits it.
   */
  isAudible: boolean;

  /**
   * Hover preview active state for audio arbitration:
   * When a hover preview card is open, isHoverActive is true,
   * signaling the Hero trailer to pause/mute so there are never
   * two simultaneous audio streams.
   */
  isHoverActive: boolean;
  setHoverActive: (active: boolean) => void;

  /**
   * Details modal active state for audio arbitration:
   * When the More Details modal is open, isModalActive is true,
   * signaling Hero and Hover previews to pause/mute so the modal
   * trailer is the sole active preview.
   */
  isModalActive: boolean;
  setModalActive: (active: boolean) => void;
}

export function shouldTrailerBeAudible({
  variant,
  isAudible,
  isHoverActive,
  isModalActive,
}: {
  variant: 'hero' | 'hover' | 'modal';
  isAudible: boolean;
  isHoverActive: boolean;
  isModalActive: boolean;
}): boolean {
  if (!isAudible) return false;
  if (variant === 'hero') return !isHoverActive && !isModalActive;
  if (variant === 'hover') return !isModalActive;
  if (variant === 'modal') return true;
  return false;
}
