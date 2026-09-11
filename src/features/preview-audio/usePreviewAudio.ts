import { useContext } from 'react';
import { PreviewAudioContext } from './PreviewAudioContext';
import type { PreviewAudioContextValue } from './types';

export function usePreviewAudio(): PreviewAudioContextValue {
  const context = useContext(PreviewAudioContext);
  if (!context) {
    throw new Error('usePreviewAudio must be used within a PreviewAudioProvider.');
  }
  return context;
}
