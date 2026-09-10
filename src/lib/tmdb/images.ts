import type { MediaArtwork } from '../../features/catalog';

const TMDB_IMAGE_ORIGIN = 'https://image.tmdb.org/t/p';

export type TmdbImageKind = 'backdrop' | 'logo' | 'poster' | 'profile' | 'still';
export type TmdbImageSize =
  | 'original'
  | 'w185'
  | 'w300'
  | 'w342'
  | 'w500'
  | 'w780'
  | 'w1280';

const fallbackByKind: Record<TmdbImageKind, string> = {
  backdrop: '/media/fallback-landscape.svg',
  logo: '/media/fallback-landscape.svg',
  poster: '/media/fallback-poster.svg',
  profile: '/media/fallback-avatar.svg',
  still: '/media/fallback-landscape.svg',
};

const sizesByKind: Record<TmdbImageKind, readonly [TmdbImageSize, TmdbImageSize]> = {
  backdrop: ['w780', 'w1280'],
  logo: ['w300', 'w500'],
  poster: ['w342', 'w500'],
  profile: ['w185', 'w342'],
  still: ['w300', 'w780'],
};

export function getTmdbImageUrl(
  path: string | null | undefined,
  size: TmdbImageSize,
  kind: TmdbImageKind = 'backdrop',
) {
  if (!path) return fallbackByKind[kind];
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_ORIGIN}/${size}${safePath}`;
}

export function getTmdbArtwork(
  path: string | null | undefined,
  kind: TmdbImageKind,
): MediaArtwork {
  const [small, large] = sizesByKind[kind];
  if (!path) {
    const fallback = fallbackByKind[kind];
    return { fallback, srcSet: fallback, type: 'image/svg+xml' };
  }

  return {
    fallback: getTmdbImageUrl(path, large, kind),
    srcSet: `${getTmdbImageUrl(path, small, kind)} ${small.slice(1)}w, ${getTmdbImageUrl(path, large, kind)} ${large.slice(1)}w`,
  };
}
