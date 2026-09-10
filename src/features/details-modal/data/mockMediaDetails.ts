import type { MediaItem } from '../../catalog';
import { mockMediaItems } from '../../catalog/data/mockMedia';
import type { EpisodeData, MediaDetails, SeasonData } from '../types';

const castGroups = [
  ['Mara Reyes', 'Theo Laurent', 'Nia Okafor', 'Emil Voss'],
  ['Sora Han', 'Jonas Vale', 'Amara Bell', 'Rafael Cruz'],
  ['Aya Mori', 'Dante Flores', 'Noor Haddad', 'Elias North'],
] as const;

const creatorGroups = [
  ['Celeste Aragon', 'Miko Santillan'],
  ['Iris Solano', 'Leon Mercer'],
  ['Anika Sato', 'Gabriel Reyes'],
] as const;

const episodeNames = [
  'A Light in the Distance',
  'The Quiet Frequency',
  'Lines We Leave Behind',
  'Nocturne for an Empty City',
  'Where the Weather Turns',
  'The Last Open Door',
  'Signal at Blue Hour',
  'A Map of Returning',
] as const;

function createEpisode(item: MediaItem, seasonNumber: number, episodeNumber: number): EpisodeData {
  const progress = seasonNumber === 1 && episodeNumber <= 3
    ? [100, 72, 24][episodeNumber - 1]
    : undefined;

  return {
    episodeNumber,
    id: `${item.id}-s${seasonNumber}-e${episodeNumber}`,
    overview: episodeNumber === 1
      ? `A new chapter begins as the hidden edges of ${item.title} finally come into view.`
      : `An unexpected discovery changes the course of the story and draws its characters deeper into the unknown.`,
    progress,
    runtime: 42 + ((episodeNumber + seasonNumber) % 4) * 3,
    still: item.backdrop,
    stillUrl: item.backdropUrl,
    title: episodeNames[(episodeNumber + seasonNumber - 2) % episodeNames.length],
    watched: progress === 100,
  };
}

function createSeasons(item: MediaItem): SeasonData[] | undefined {
  if (item.type === 'movie') return undefined;
  const seasonCount = Math.max(1, item.seasons ?? 1);

  return Array.from({ length: seasonCount }, (_, seasonIndex) => {
    const seasonNumber = seasonIndex + 1;
    const episodes = Array.from({ length: 6 }, (_, episodeIndex) => (
      createEpisode(item, seasonNumber, episodeIndex + 1)
    ));

    return {
      episodeCount: episodes.length,
      episodes,
      name: `Season ${seasonNumber}`,
      seasonNumber,
      year: (item.year ?? 2026) - seasonCount + seasonNumber,
    };
  });
}

function getSimilar(item: MediaItem): MediaItem[] {
  const primaryGenre = item.genres?.[0];
  const matching = mockMediaItems.filter((candidate) => (
    candidate.id !== item.id && primaryGenre && candidate.genres?.includes(primaryGenre)
  ));
  const remaining = mockMediaItems.filter((candidate) => (
    candidate.id !== item.id && !matching.some((match) => match.id === candidate.id)
  ));
  return [...matching, ...remaining].slice(0, 6);
}

function toMediaDetails(item: MediaItem, index: number): MediaDetails {
  const groupIndex = index % castGroups.length;
  const isSeries = item.type !== 'movie';

  return {
    backdrop: item.backdrop,
    backdropUrl: item.backdropUrl,
    cast: [...castGroups[groupIndex]],
    creators: [...creatorGroups[groupIndex]],
    descriptors: isSeries
      ? ['Atmospheric', 'Character-driven', 'Suspenseful']
      : ['Cinematic', 'Visually striking', 'Slow-burn'],
    genres: item.genres ?? [],
    id: item.id,
    maturityRating: item.rating,
    originalTitle: item.type === 'anime' ? `${item.title} · Original Series` : undefined,
    overview: item.overview ?? 'A DAITIGN original story.',
    quality: index % 4 === 0 ? '4K' : 'HD',
    runtime: item.runtime,
    seasons: createSeasons(item),
    similar: getSimilar(item),
    title: item.title,
    tmdbId: item.tmdbId,
    type: item.type,
    year: item.year,
  };
}

const mockDetailsById = new Map(
  mockMediaItems.map((item, index) => [item.id, toMediaDetails(item, index)]),
);

export function getMockMediaDetailsById(mediaId: MediaItem['id']): MediaDetails | null {
  return mockDetailsById.get(mediaId) ?? null;
}
