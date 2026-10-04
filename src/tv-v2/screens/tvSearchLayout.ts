export function getSearchItemsPerRow(): number {
  if (typeof window === 'undefined') return 7;
  const width = window.innerWidth;
  if (width >= 2560) return 8; // 4K: 8 cards
  if (width >= 1600) return 7; // 1080p: 7 cards
  return 6; // 720p: 6 cards
}
