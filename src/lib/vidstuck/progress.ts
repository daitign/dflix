import type { VidStuckProgressEvent, VidStuckMediaType } from './types';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

export function parseVidStuckProgress(
  data: unknown,
  expectedTmdbId?: number,
): VidStuckProgressEvent | null {
  let payload: unknown = data;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      return null;
    }
  }

  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Record<string, unknown>;
  if (candidate.type !== 'movie' && candidate.type !== 'tv') return null;
  if (typeof candidate.id !== 'number' && typeof candidate.id !== 'string') return null;
  if (!isFiniteNumber(candidate.progress) || candidate.progress < 0) return null;
  if (!isFiniteNumber(candidate.timestamp) || candidate.timestamp < 0) return null;
  if (!isFiniteNumber(candidate.duration) || candidate.duration < 0) return null;
  if (expectedTmdbId && String(candidate.id) !== String(expectedTmdbId)) return null;
  if (candidate.season !== undefined && !isPositiveInteger(candidate.season)) return null;
  if (candidate.episode !== undefined && !isPositiveInteger(candidate.episode)) return null;

  return {
    duration: candidate.duration,
    episode: candidate.episode as number | undefined,
    id: candidate.id,
    progress: candidate.progress,
    season: candidate.season as number | undefined,
    timestamp: candidate.timestamp,
    type: candidate.type as VidStuckMediaType,
  };
}
