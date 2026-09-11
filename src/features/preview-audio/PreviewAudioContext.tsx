import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { SOUND_PREFERENCE_STORAGE_KEY, type PreviewAudioContextValue } from './types';

export { SOUND_PREFERENCE_STORAGE_KEY };

export const PreviewAudioContext = createContext<PreviewAudioContextValue | null>(null);

function getInitialSoundPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(SOUND_PREFERENCE_STORAGE_KEY);
    if (stored === 'off') return false;
    if (stored === 'on') return true;
  } catch {
    // LocalStorage unavailable
  }
  // DAITIGN default preference is SOUND ON
  return true;
}

function hasBrowserUserGesture(): boolean {
  if (typeof navigator !== 'undefined' && 'userActivation' in navigator) {
    const activation = (navigator as unknown as { userActivation?: { hasBeenActive?: boolean } }).userActivation;
    if (activation?.hasBeenActive) return true;
  }
  return false;
}

export function PreviewAudioProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(getInitialSoundPreference);
  const [autoplaySoundAllowed, setAutoplaySoundAllowed] = useState<boolean>(hasBrowserUserGesture);
  const [isHoverActive, setHoverActive] = useState<boolean>(false);
  const [isModalActive, setModalActive] = useState<boolean>(false);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      window.localStorage.setItem(SOUND_PREFERENCE_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // ignore storage error
    }
    // Explicitly enabling sound represents user intent/gesture
    if (enabled) {
      setAutoplaySoundAllowed(true);
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(!soundEnabled);
  }, [setSoundEnabled, soundEnabled]);

  // Listen for user interactions (click, pointerdown, keydown, touchstart)
  useEffect(() => {
    if (autoplaySoundAllowed) return;

    const handleUserInteraction = () => {
      setAutoplaySoundAllowed(true);
      removeListeners();
    };

    const options: AddEventListenerOptions = { capture: true, passive: true };
    const removeListeners = () => {
      window.removeEventListener('pointerdown', handleUserInteraction, options);
      window.removeEventListener('keydown', handleUserInteraction, options);
      window.removeEventListener('click', handleUserInteraction, options);
      window.removeEventListener('touchstart', handleUserInteraction, options);
    };

    window.addEventListener('pointerdown', handleUserInteraction, options);
    window.addEventListener('keydown', handleUserInteraction, options);
    window.addEventListener('click', handleUserInteraction, options);
    window.addEventListener('touchstart', handleUserInteraction, options);

    return removeListeners;
  }, [autoplaySoundAllowed]);

  const isAudible = soundEnabled && autoplaySoundAllowed;

  const value = useMemo<PreviewAudioContextValue>(
    () => ({
      soundEnabled,
      setSoundEnabled,
      toggleSound,
      autoplaySoundAllowed,
      setAutoplaySoundAllowed,
      isAudible,
      isHoverActive,
      setHoverActive,
      isModalActive,
      setModalActive,
    }),
    [soundEnabled, setSoundEnabled, toggleSound, autoplaySoundAllowed, isAudible, isHoverActive, isModalActive],
  );

  return (
    <PreviewAudioContext.Provider value={value}>
      {children}
    </PreviewAudioContext.Provider>
  );
}
