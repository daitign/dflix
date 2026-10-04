export interface TvNavItem {
  icon?: string;
  id: string;
  label: string;
}

export const PRIMARY_NAV_ITEMS: TvNavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'shows', label: 'TV Shows' },
  { id: 'movies', label: 'Movies' },
  { id: 'new-popular', label: 'New & Popular' },
  { id: 'my-list', label: 'My List' },
  { id: 'languages', label: 'Browse by Languages' },
];
