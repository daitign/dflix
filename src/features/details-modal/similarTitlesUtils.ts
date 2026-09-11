import type { MediaBadge, MediaItem } from '../catalog/types';

export function getDurationLabel(item: MediaItem): string {
  if (item.type === 'tv') {
    if (item.seasons) return `${item.seasons} Season${item.seasons === 1 ? '' : 's'}`;
    if (item.episodeLabel) return item.episodeLabel;
    const epCount = 6 + (Math.abs(Number(item.tmdbId) || 0) % 10);
    return `${epCount} Episodes`;
  }

  if (item.runtime && item.runtime > 0) {
    const hours = Math.floor(item.runtime / 60);
    const minutes = item.runtime % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  // Realistic deterministic runtime for movies (86m - 138m)
  const idNum = Math.abs(Number(item.tmdbId) || 0);
  const runtime = 86 + (idNum % 53);
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return `${hours}h ${minutes}m`;
}

export function getMaturityLabel(item: MediaItem): string {
  if (item.maturityRating) return item.maturityRating;
  if (item.rating && item.rating !== 'NR') return item.rating;

  const genres = item.genres ?? [];
  const hasGenre = (name: string) => genres.some((g) => g.toLowerCase().includes(name.toLowerCase()));

  if (hasGenre('animation') || hasGenre('family') || hasGenre('kids')) {
    return '7+';
  }
  if (hasGenre('horror') || hasGenre('crime')) {
    return '18+';
  }
  if (hasGenre('action') || hasGenre('thriller') || hasGenre('war')) {
    return '16+';
  }
  if (hasGenre('comedy') || hasGenre('fantasy') || hasGenre('sci-fi') || hasGenre('adventure')) {
    return '13+';
  }

  const ratings = ['7+', '13+', '16+', '16+', '18+'];
  const idNum = Math.abs(Number(item.tmdbId) || 0);
  return ratings[idNum % ratings.length];
}

export function hasSpatialAudio(item: MediaItem): boolean {
  const idNum = Math.abs(Number(item.tmdbId) || 0);
  const isModern = (item.year ?? 2020) >= 2004;
  return isModern && (idNum % 3 === 0);
}

export function getStatusBadgeLabel(badge?: MediaBadge): string | null {
  if (!badge) return null;
  switch (badge) {
    case 'new-episode':
      return 'New Episode';
    case 'new-season':
      return 'New Season';
    case 'recently-added':
      return 'Recently Added';
    case 'new':
      return 'New';
    default:
      return null;
  }
}
