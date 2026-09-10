import { useEffect, type RefObject } from 'react';
import { parseVidStuckProgress, VIDSTUCK_ORIGIN, type VidStuckProgressEvent } from '../../lib/vidstuck';

interface UseVidStuckProgressOptions {
  expectedTmdbId: number;
  frameRef: RefObject<HTMLIFrameElement | null>;
  onProgress?: (event: VidStuckProgressEvent) => void;
}

export function useVidStuckProgress({ expectedTmdbId, frameRef, onProgress }: UseVidStuckProgressOptions) {
  useEffect(() => {
    const handleMessage = (message: MessageEvent<unknown>) => {
      if (message.origin !== VIDSTUCK_ORIGIN) return;
      if (frameRef.current?.contentWindow && message.source !== frameRef.current.contentWindow) return;
      const progressEvent = parseVidStuckProgress(message.data, expectedTmdbId);
      if (!progressEvent) return;
      onProgress?.(progressEvent);
      if (import.meta.env.DEV) console.debug('[DAITIGN player progress]', progressEvent);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [expectedTmdbId, frameRef, onProgress]);
}
