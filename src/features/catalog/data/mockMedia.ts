import type { MediaArtwork, MediaBadge, MediaItem, MediaType } from '../types';

const artworkByKey = {
  meridian: '/media/last-meridian',
  crossing: '/media/night-crossing',
  signal: '/media/white-signal',
  rain: '/media/after-rain',
  dust: '/media/dust-protocol',
  house: '/media/the-still-house',
  archive: '/media/celestial-archive',
} as const;

type ArtworkKey = keyof typeof artworkByKey;

function artwork(key: ArtworkKey): MediaArtwork {
  const base = artworkByKey[key];
  return {
    fallback: `${base}-640.webp`,
    srcSet: `${base}-640.webp 640w, ${base}-960.webp 960w`,
  };
}

interface MockMediaInput {
  art: ArtworkKey;
  badge?: MediaBadge;
  episodeLabel?: string;
  genres: string[];
  id: string;
  overview: string;
  progress?: number;
  rating: string;
  runtime?: number;
  seasons?: number;
  title: string;
  type: MediaType;
  year: number;
}

function defineMedia(input: MockMediaInput): MediaItem {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    overview: input.overview,
    year: input.year,
    rating: input.rating,
    genres: input.genres,
    runtime: input.runtime,
    seasons: input.seasons,
    badge: input.badge,
    progress: input.progress,
    episodeLabel: input.episodeLabel,
    backdrop: artwork(input.art),
    backdropUrl: artwork(input.art).fallback,
  };
}

export const mockMediaItems: MediaItem[] = [
  defineMedia({
    art: 'meridian',
    badge: 'top-10',
    genres: ['Sci-Fi', 'Drama'],
    id: 'last-meridian',
    overview: 'At the edge of a permanent eclipse, an astronomer discovers a signal that has been waiting longer than humanity.',
    rating: '13+',
    runtime: 128,
    title: 'The Last Meridian',
    type: 'movie',
    year: 2026,
  }),
  defineMedia({ art: 'crossing', badge: 'trending', genres: ['Thriller', 'Mystery'], id: 'night-crossing', overview: 'A final coastal train carries nine passengers and one impossible secret.', rating: '16+', runtime: 112, title: 'Night Crossing', type: 'movie', year: 2026 }),
  defineMedia({ art: 'signal', badge: 'new-episode', episodeLabel: 'S1:E5 · The Relay', genres: ['Mystery', 'Drama'], id: 'white-signal', overview: 'A mountain research team hears a transmission beneath the ice.', progress: 64, rating: '13+', seasons: 1, title: 'White Signal', type: 'tv', year: 2026 }),
  defineMedia({ art: 'rain', badge: 'new-season', episodeLabel: 'S2:E1 · Blue Hour', genres: ['Drama', 'Romance'], id: 'after-rain', overview: 'Two lives cross again on a hillside street after twelve years apart.', progress: 18, rating: '13+', seasons: 2, title: 'After the Rain', type: 'tv', year: 2025 }),
  defineMedia({ art: 'dust', badge: 'trending', genres: ['Action', 'Thriller'], id: 'dust-protocol', overview: 'A courier races the weather and a closing border across the salt basin.', rating: '16+', runtime: 104, title: 'Dust Protocol', type: 'movie', year: 2026 }),
  defineMedia({ art: 'house', genres: ['Horror', 'Mystery'], id: 'still-house', overview: 'The room that lights itself remembers every visitor.', rating: '18+', runtime: 98, title: 'The Still House', type: 'movie', year: 2025 }),
  defineMedia({ art: 'archive', badge: 'new-episode', episodeLabel: 'S1:E7 · The Open Gate', genres: ['Fantasy', 'Adventure'], id: 'celestial-archive', overview: 'A courier must return a book that rewrites the road beneath their feet.', progress: 42, rating: '13+', seasons: 1, title: 'Celestial Archive', type: 'anime', year: 2026 }),
  defineMedia({ art: 'crossing', genres: ['Crime', 'Drama'], id: 'velvet-tide', overview: 'A quiet port city keeps its promises in salt and shadow.', rating: '16+', runtime: 119, title: 'Velvet Tide', type: 'movie', year: 2024 }),
  defineMedia({ art: 'signal', badge: 'recently-added', genres: ['Thriller', 'Sci-Fi'], id: 'north-of-silence', overview: 'Three scientists wake to find winter moving backward.', rating: '16+', seasons: 2, title: 'North of Silence', type: 'tv', year: 2025 }),
  defineMedia({ art: 'rain', genres: ['Comedy', 'Drama'], id: 'seventh-floor', overview: 'Six neighbors share one elevator and far too many opinions.', rating: '13+', seasons: 3, title: 'The Seventh Floor', type: 'tv', year: 2024 }),
  defineMedia({ art: 'archive', genres: ['Fantasy', 'Drama'], id: 'paper-moons', overview: 'A mapmaker draws moons that begin appearing over the city.', rating: '13+', runtime: 106, title: 'Paper Moons', type: 'anime', year: 2025 }),
  defineMedia({ art: 'house', badge: 'recently-added', genres: ['Horror', 'Drama'], id: 'black-cedar', overview: 'Every tree bears the same initials, including hers.', rating: '18+', seasons: 1, title: 'Black Cedar', type: 'tv', year: 2026 }),
  defineMedia({ art: 'rain', episodeLabel: 'S1:E3 · Small Hours', genres: ['Drama', 'Comedy'], id: 'hours-between', overview: 'An overnight radio host becomes the confidant of an awake city.', progress: 77, rating: '13+', seasons: 1, title: 'The Hours Between', type: 'tv', year: 2025 }),
  defineMedia({ art: 'dust', genres: ['Action', 'Crime'], id: 'redline-west', overview: 'One road, two rivals, and a city running out of time.', rating: '16+', runtime: 101, title: 'Redline West', type: 'movie', year: 2025 }),
  defineMedia({ art: 'meridian', badge: 'recently-added', genres: ['Sci-Fi', 'Adventure'], id: 'orbit-fall', overview: 'A damaged station makes one final pass over a sleeping Earth.', rating: '13+', runtime: 121, title: 'Orbitfall', type: 'movie', year: 2025 }),
  defineMedia({ art: 'crossing', episodeLabel: 'S2:E4 · Low Water', genres: ['Crime', 'Mystery'], id: 'silent-harbor', overview: 'A harbor detective follows a case no one officially opened.', progress: 31, rating: '16+', seasons: 2, title: 'Silent Harbor', type: 'tv', year: 2024 }),
  defineMedia({ art: 'rain', badge: 'new-episode', genres: ['Drama', 'Mystery'], id: 'glass-season', overview: 'A family returns to the house they left unfinished.', rating: '13+', seasons: 1, title: 'Glass Season', type: 'tv', year: 2026 }),
  defineMedia({ art: 'house', genres: ['Horror', 'Thriller'], id: 'ashen-room', overview: 'The hotel has no thirteenth floor—until midnight.', rating: '18+', runtime: 94, title: 'The Ashen Room', type: 'movie', year: 2025 }),
  defineMedia({ art: 'signal', badge: 'new-season', genres: ['Sci-Fi', 'Thriller'], id: 'long-shadow', overview: 'A telescope sees tomorrow, but only during storms.', rating: '16+', seasons: 3, title: 'The Long Shadow', type: 'tv', year: 2026 }),
  defineMedia({ art: 'dust', genres: ['Comedy', 'Action'], id: 'wrong-exit', overview: 'A meticulous accountant takes one spectacularly incorrect turn.', rating: '13+', runtime: 96, title: 'The Wrong Exit', type: 'movie', year: 2024 }),
  defineMedia({ art: 'archive', badge: 'trending', genres: ['Anime', 'Sci-Fi'], id: 'violet-engine', overview: 'An apprentice mechanic repairs memories inside a celestial machine.', rating: '13+', seasons: 2, title: 'Violet Engine', type: 'anime', year: 2025 }),
  defineMedia({ art: 'rain', genres: ['Comedy', 'Romance'], id: 'borrowed-sunday', overview: 'Two strangers accidentally share the same borrowed apartment.', rating: '13+', seasons: 1, title: 'Borrowed Sunday', type: 'tv', year: 2025 }),
  defineMedia({ art: 'meridian', genres: ['Sci-Fi', 'Drama'], id: 'far-side', overview: 'A voice from the far side of the moon knows every name on Earth.', rating: '13+', runtime: 116, title: 'Far Side of Morning', type: 'movie', year: 2024 }),
  defineMedia({ art: 'signal', genres: ['Drama', 'Adventure'], id: 'summit-line', overview: 'A rescue crew climbs after the mountain closes for winter.', rating: '13+', runtime: 109, title: 'The Summit Line', type: 'movie', year: 2025 }),
];
