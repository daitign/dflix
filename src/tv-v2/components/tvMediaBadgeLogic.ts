import type { MediaItem } from '../../features/catalog/types.ts';
import { getFreshnessBadge } from '../../features/catalog/freshness.ts';

export type TvFreshnessBadgeType = 'new-episode' | 'new-season' | 'recently-added' | 'new';
export type TvBadgeType = 'top-10' | TvFreshnessBadgeType;

/**
 * Checks whether an item qualifies for the Top 10 badge based on truthful catalog data.
 */
export function isTopTenItem(item?: MediaItem | null): boolean {
  if (!item) return false;
  return Boolean(item.inTopTen || item.badge === 'top-10');
}

/**
 * Resolves truthful freshness badge from catalog dates or precomputed item badge.
 */
export function resolveTvFreshnessBadge(item?: MediaItem | null): TvFreshnessBadgeType | null {
  if (!item) return null;

  // 1. Evaluate truthful date-based freshness
  const freshness = getFreshnessBadge(item);
  if (freshness && freshness !== 'top-10') {
    return freshness;
  }

  // 2. Fall back to pre-resolved badge on item if valid
  if (item.badge && item.badge !== 'top-10') {
    return item.badge;
  }

  return null;
}

/**
 * Returns human-readable Netflix-style label for freshness badges.
 */
export function getFreshnessLabel(type: TvFreshnessBadgeType): string {
  switch (type) {
    case 'new-episode':
      return 'New Episode';
    case 'new-season':
      return 'New Season';
    case 'recently-added':
      return 'Recently Added';
    case 'new':
      return 'New';
  }
}
