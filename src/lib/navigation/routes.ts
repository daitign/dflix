import { useEffect, useState } from 'react';
import type { IconName } from '../../components/icons/Icon';

export type NavRouteId =
  | 'home'
  | 'shows'
  | 'movies'
  | 'games'
  | 'new-popular'
  | 'my-list'
  | 'languages';

export interface NavRouteItem {
  href: string;
  icon: IconName;
  id: NavRouteId;
  label: string;
}

export const NAV_ITEMS: NavRouteItem[] = [
  { href: '/', icon: 'home', id: 'home', label: 'Home' },
  { href: '/shows', icon: 'sparkles', id: 'shows', label: 'Shows' },
  { href: '/movies', icon: 'grid', id: 'movies', label: 'Movies' },
  { href: '/games', icon: 'sparkles', id: 'games', label: 'Games' },
  { href: '/new-popular', icon: 'sparkles', id: 'new-popular', label: 'New & Popular' },
  { href: '/my-list', icon: 'bookmark', id: 'my-list', label: 'My List' },
  { href: '/languages', icon: 'sparkles', id: 'languages', label: 'Browse by Languages' },
];

export function getActiveNavId(pathname: string): NavRouteId {
  const cleanPath = pathname.replace(/\/$/, '') || '/';
  if (cleanPath === '/shows') return 'shows';
  if (cleanPath === '/movies') return 'movies';
  if (cleanPath === '/games') return 'games';
  if (cleanPath === '/new-popular') return 'new-popular';
  if (cleanPath === '/my-list') return 'my-list';
  if (cleanPath === '/languages') return 'languages';
  return 'home';
}

export function navigateTo(path: string, options: { replace?: boolean } = {}) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;

  if (options.replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

export function useCurrentRoute() {
  const [pathname, setPathname] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeId = getActiveNavId(pathname);

  return {
    activeId,
    pathname,
  };
}
