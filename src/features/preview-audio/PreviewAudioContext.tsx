import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { SOUND_PREFERENCE_STORAGE_KEY, type PreviewAudioContextValue } from './types';

export { SOUND_PREFERENCE_STORAGE_KEY };

export const PreviewAudioContext = createContext<PreviewAudioContextValue | null>(null);

export function isMobileTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 47.999rem)').matches ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
  );
}

function getInitialSoundPreference(): boolean {
  if (typeof window === 'undefined') return true;
  // Mobile touch devices default to muted to ensure reliable autoplay across iOS & Android
  if (isMobileTouchDevice()) return false;
  try {
    const stored = window.localStorage.getItem(SOUND_PREFERENCE_STORAGE_KEY);
    if (stored === 'off') return false;
    if (stored === 'on') return true;
  } catch {
    // LocalStorage unavailable
  }
  // DAITIGN desktop default preference is SOUND ON
  return true;
}

export function PreviewAudioProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(getInitialSoundPreference);
  const [autoplaySoundAllowed, setAutoplaySoundAllowed] = useState<boolean>(true);
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

  // Listen for user interactions (click, pointerdown, keydown, touchstart, wheel, scroll)
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
      window.removeEventListener('wheel', handleUserInteraction, options);
      window.removeEventListener('scroll', handleUserInteraction, options);
    };

    window.addEventListener('pointerdown', handleUserInteraction, options);
    window.addEventListener('keydown', handleUserInteraction, options);
    window.addEventListener('click', handleUserInteraction, options);
    window.addEventListener('touchstart', handleUserInteraction, options);
    window.addEventListener('wheel', handleUserInteraction, options);
    window.addEventListener('scroll', handleUserInteraction, options);

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
