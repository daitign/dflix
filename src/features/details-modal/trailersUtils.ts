import type { TmdbVideo } from '../../lib/tmdb/types';

export const TYPE_PRIORITY: Record<string, number> = {
  trailer: 1,
  teaser: 2,
  featurette: 3,
  'behind the scenes': 4,
  clip: 5,
  bloopers: 6,
};

export const MAX_TRAILERS_COUNT = 3;

export function filterAndRankTrailers(videos: TmdbVideo[], limit = MAX_TRAILERS_COUNT): TmdbVideo[] {
  const valid = videos.filter(
    (v) => v.site?.toLowerCase() === 'youtube' && /^[A-Za-z0-9_-]{6,}$/.test(v.key),
  );

  // Deduplicate by video key
  const seen = new Set<string>();
  const unique = valid.filter((v) => {
    if (seen.has(v.key)) return false;
    seen.add(v.key);
    return true;
  });

  // Sort by priority: Official first, then type rank, then recency
  unique.sort((a, b) => {
    if (a.official !== b.official) return a.official ? -1 : 1;
    const typeRankA = TYPE_PRIORITY[a.type?.trim().toLowerCase()] ?? 99;
    const typeRankB = TYPE_PRIORITY[b.type?.trim().toLowerCase()] ?? 99;
    if (typeRankA !== typeRankB) return typeRankA - typeRankB;
    const dateA = a.published_at ? Date.parse(a.published_at) : 0;
    const dateB = b.published_at ? Date.parse(b.published_at) : 0;
    return dateB - dateA;
  });

  return unique.slice(0, limit);
}
