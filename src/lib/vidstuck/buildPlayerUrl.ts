import type { VidStuckPlayerOptions } from './types';

export const VIDSTUCK_ORIGIN = 'https://vidstuck.xyz';
export const DAITIGN_PLAYER_COLOR = 'd9b56d';

export const DAITIGN_PLAYER_DEFAULTS = {
  autoplayNextEpisode: true,
  branding: 'DAITIGN',
  color: DAITIGN_PLAYER_COLOR,
  episodeSelector: true,
  nextEpisode: true,
  overlay: true,
  subtitle: 'english',
} as const;

function requirePositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
}

export function buildVidStuckUrl(options: VidStuckPlayerOptions) {
  requirePositiveInteger(options.tmdbId, 'TMDB ID');
  if (options.type === 'tv') {
    requirePositiveInteger(options.season ?? 0, 'Season');
    requirePositiveInteger(options.episode ?? 0, 'Episode');
  }

  const config = { ...DAITIGN_PLAYER_DEFAULTS, ...options };
  const path = options.type === 'movie'
    ? `/embed/movie/${options.tmdbId}`
    : `/embed/tv/${options.tmdbId}/${options.season}/${options.episode}`;
  const url = new URL(path, VIDSTUCK_ORIGIN);
  const parameters: Array<[string, boolean | number | string | undefined]> = [
    ['branding', config.branding],
    ['server', config.server],
    ['subtitle', config.subtitle],
    ['overlay', config.overlay],
  ];
  if (options.type === 'tv') {
    parameters.push(
      ['nextEpisode', config.nextEpisode],
      ['episodeSelector', config.episodeSelector],
      ['autoplayNextEpisode', config.autoplayNextEpisode],
    );
  }
  parameters.push(
    ['color', config.color],
    ['progress', config.progress],
  );
  parameters.forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}
