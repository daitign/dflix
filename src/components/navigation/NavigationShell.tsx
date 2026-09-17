import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { BrandMark } from '../brand/BrandMark';
import { Icon } from '../icons/Icon';
import { IconButton } from '../primitives/IconButton';
import { NAV_ITEMS, navigateTo, useCurrentRoute } from '../../lib/navigation/routes';
import { useDetailsModal } from '../../features/details-modal';
import { tmdbClient } from '../../lib/tmdb/client';
import { normalizeTmdbMixed } from '../../lib/tmdb/adapters';
import { isTVMode, registerTVBackHandler } from '../../lib/tv';
import type { MediaItem } from '../../features/catalog/types';
import './NavigationShell.css';

interface NavigationShellProps {
  children: ReactNode;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
}

export interface AppNotification {
  id: string;
  item?: MediaItem;
  message: string;
  thumbnailUrl?: string;
  time: string;
  title: string;
}

function focusFirstTVPageControl() {
  if (!isTVMode()) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('#main-content [data-tv-focusable="true"]')
        ?.focus({ preventScroll: true });
    });
  });
}

export function NavigationShell({
  children,
  onSearchChange,
  searchQuery = '',
}: NavigationShellProps) {
  const { activeId } = useCurrentRoute();
  const { openDetails } = useDetailsModal();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(searchQuery));
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const browseMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch real notifications from TMDB catalog
  useEffect(() => {
    if (isTVMode()) return;
    let active = true;
    Promise.allSettled([
      tmdbClient.getTrending(),
      tmdbClient.getNowPlayingMovies(),
      tmdbClient.getAiringTodayTv(),
    ]).then(([trendingRes, nowPlayingRes, airingTodayRes]) => {
      if (!active) return;

      const notifs: AppNotification[] = [];

      if (nowPlayingRes.status === 'fulfilled' && nowPlayingRes.value?.results?.length) {
        const item = normalizeTmdbMixed(nowPlayingRes.value.results[0]);
        if (item) {
          notifs.push({
            id: `notif-movie-${item.id}`,
            item,
            message: `${item.title} is now streaming in cinema audio and HD.`,
            thumbnailUrl: item.backdropUrl ?? item.posterUrl,
            time: '2 hours ago',
            title: 'New Arrival',
          });
        }
      }

      if (airingTodayRes.status === 'fulfilled' && airingTodayRes.value?.results?.length) {
        const item = normalizeTmdbMixed(airingTodayRes.value.results[0]);
        if (item) {
          notifs.push({
            id: `notif-tv-${item.id}`,
            item,
            message: `A brand-new episode of ${item.title} just dropped.`,
            thumbnailUrl: item.backdropUrl ?? item.posterUrl,
            time: '5 hours ago',
            title: 'New Episode',
          });
        }
      }

      if (trendingRes.status === 'fulfilled' && trendingRes.value?.results?.length) {
        const candidates = trendingRes.value.results.slice(0, 3);
        candidates.forEach((raw, idx) => {
          const item = normalizeTmdbMixed(raw);
          if (item && notifs.length < 5) {
            notifs.push({
              id: `notif-trending-${item.id}-${idx}`,
              item,
              message: `${item.title} is trending in your top recommendations.`,
              thumbnailUrl: item.backdropUrl ?? item.posterUrl,
              time: idx === 0 ? '1 day ago' : '2 days ago',
              title: idx === 0 ? 'Top 10 Today' : 'Trending Now',
            });
          }
        });
      }

      if (notifs.length > 0) {
        setNotifications(notifs);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrowseOpen || !isTVMode()) return;

    const focusFirstItem = window.requestAnimationFrame(() => {
      browseMenuRef.current
        ?.querySelector<HTMLElement>('[data-tv-focusable="true"]')
        ?.focus({ preventScroll: true });
    });
    const closeMenu = () => {
      setIsBrowseOpen(false);
      window.requestAnimationFrame(() => browseButtonRef.current?.focus({ preventScroll: true }));
      return true;
    };
    const unregisterBack = registerTVBackHandler(closeMenu);
    const menu = browseMenuRef.current;
    const handleMenuBack = () => closeMenu();
    const handleMenuActivate = (event: Event) => {
      const element = (event as CustomEvent<{ element?: HTMLElement }>).detail?.element;
      const route = element?.dataset.tvRoute;
      if (!route || !menu?.contains(element)) return;
      event.preventDefault();
      setIsBrowseOpen(false);
      navigateTo(route);
      window.scrollTo({ top: 0, behavior: 'instant' });
      focusFirstTVPageControl();
    };
    menu?.addEventListener('daitign:tv-menu-back', handleMenuBack);
    menu?.addEventListener('daitign:tv-menu-activate', handleMenuActivate);

    return () => {
      window.cancelAnimationFrame(focusFirstItem);
      unregisterBack();
      menu?.removeEventListener('daitign:tv-menu-back', handleMenuBack);
      menu?.removeEventListener('daitign:tv-menu-activate', handleMenuActivate);
    };
  }, [isBrowseOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (browseRef.current && !browseRef.current.contains(target)) {
        setIsBrowseOpen(false);
      }
      if (navRef.current && !navRef.current.contains(target)) {
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
        if (!searchQuery) setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBrowseOpen(false);
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const unreadCount = notifications.filter((n) => !readNotificationIds.has(n.id)).length;

  return (
    <div className="navigation-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header
        className={cx('top-navigation', isScrolled && 'top-navigation--scrolled')}
        ref={navRef}
      >
        <div className="container top-navigation__inner" data-tv-row>
          <div className="top-navigation__start">
            <BrandMark />

            {/* Netflix Mobile & Tablet Browse Dropdown */}
            <div className="top-navigation__browse-anchor" ref={browseRef}>
              <button
                aria-expanded={isBrowseOpen}
                aria-haspopup="true"
                aria-label="Browse categories"
                className={cx('top-navigation__browse-btn', isBrowseOpen && 'top-navigation__browse-btn--open')}
                data-tv-focusable="true"
                onClick={() => setIsBrowseOpen((prev) => !prev)}
                ref={browseButtonRef}
                type="button"
              >
                <span>Browse</span>
                <Icon
                  name={isBrowseOpen ? 'caretUp' : 'caretDown'}
                  size={10}
                />
              </button>

              {isBrowseOpen && (
                <div
                  className="netflix-browse-popover"
                  data-tv-focus-scope="menu"
                  ref={browseMenuRef}
                  role="menu"
                >
                  <div className="netflix-browse-popover__items">
                    {NAV_ITEMS.map((item) => (
                      <a
                        className={cx(
                          'netflix-browse-popover__item',
                          activeId === item.id && 'netflix-browse-popover__item--active'
                        )}
                        data-tv-focusable="true"
                        data-tv-route={item.href}
                        href={item.href}
                        key={item.id}
                        onClick={(e) => {
                          e.preventDefault();
                          setIsBrowseOpen(false);
                          navigateTo(item.href);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          focusFirstTVPageControl();
                        }}
                        role="menuitem"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <nav aria-label="Primary" className="top-navigation__links">
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  aria-current={isActive ? 'page' : undefined}
                  className={cx('top-navigation__link', isActive && 'top-navigation__link--active')}
                  data-tv-focusable="true"
                  href={item.href}
                  key={item.id}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(item.href);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="top-navigation__actions">
            <a
              className={cx(
                'top-navigation__vip-btn',
                isSearchOpen && 'top-navigation__vip-btn--hidden'
              )}
              data-tv-focusable="true"
              href="https://daitignvault.vercel.app/"
              rel="noopener noreferrer"
              target="_blank"
              title="Visit DAITIGN Vault - DV Shop"
            >
              <span className="top-navigation__vip-icon" aria-hidden="true">✦</span>
              <span className="top-navigation__vip-text">
                DV<span className="top-navigation__vip-suffix"> Shop</span>
              </span>
            </a>

            {/* Netflix Expandable Search Bar */}
            <div className={cx('netflix-search', isSearchOpen && 'netflix-search--open')}>
              <button
                aria-label={isSearchOpen ? 'Close search' : 'Search'}
                className="netflix-search__trigger"
                data-tv-focusable="true"
                onClick={() => {
                  if (isSearchOpen) {
                    setIsSearchOpen(false);
                    if (searchQuery) onSearchChange?.('');
                  } else {
                    setIsSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }
                }}
                type="button"
              >
                <Icon name="search" size={20} />
              </button>
              <input
                aria-label="Search titles, people, genres"
                className="netflix-search__input"
                data-tv-focusable="true"
                onChange={(e) => onSearchChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (searchQuery) onSearchChange?.('');
                    setIsSearchOpen(false);
                  }
                }}
                placeholder="Titles, people, genres"
                ref={searchInputRef}
                type="text"
                value={searchQuery}
              />
              {isSearchOpen && (
                <button
                  aria-label={searchQuery ? 'Clear search' : 'Close search'}
                  className="netflix-search__clear"
                  data-tv-focusable="true"
                  onClick={() => {
                    if (searchQuery) {
                      onSearchChange?.('');
                      searchInputRef.current?.focus();
                    } else {
                      setIsSearchOpen(false);
                    }
                  }}
                  type="button"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>

            {/* Notifications Dropdown with Real Catalog Notifications & Badge */}
            <div className="top-navigation__popover-anchor">
              <IconButton
                aria-expanded={isNotificationsOpen}
                aria-label="Notifications"
                className={cx(isNotificationsOpen && 'top-navigation__action--active')}
                data-tv-focusable="true"
                onClick={() => {
                  setIsNotificationsOpen((prev) => {
                    const next = !prev;
                    if (next && notifications.length > 0) {
                      setReadNotificationIds((prevIds) => {
                        const nextIds = new Set(prevIds);
                        notifications.forEach((n) => nextIds.add(n.id));
                        return nextIds;
                      });
                    }
                    return next;
                  });
                  setIsProfileOpen(false);
                }}
                tooltip="Notifications"
              >
                <Icon name="bell" />
                {unreadCount > 0 && (
                  <span aria-hidden="true" className="top-navigation__notification-badge">
                    {unreadCount}
                  </span>
                )}
              </IconButton>
              {isNotificationsOpen && (
                <div className="netflix-notifications-popover" role="dialog">
                  <div className="netflix-notifications__header">
                    <h4>Notifications</h4>
                  </div>
                  <div className="netflix-notifications__list">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div
                          className="netflix-notifications__item"
                          key={notif.id}
                          onClick={() => {
                            if (notif.item) {
                              openDetails(notif.item);
                            }
                            setIsNotificationsOpen(false);
                          }}
                        >
                          {notif.thumbnailUrl ? (
                            <img
                              alt=""
                              className="netflix-notifications__img"
                              src={notif.thumbnailUrl}
                            />
                          ) : (
                            <div className="netflix-notifications__badge" />
                          )}
                          <div className="netflix-notifications__text">
                            <strong>{notif.title}</strong>
                            <p>{notif.message}</p>
                            <span>{notif.time}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="netflix-notifications__empty">
                        No new notifications right now.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Netflix Profile Avatar & Menu */}
            <div className="top-navigation__popover-anchor">
              <button
                aria-expanded={isProfileOpen}
                aria-label="Open profile menu"
                className="profile-button"
                data-tv-focusable="true"
                onClick={() => {
                  setIsProfileOpen((prev) => !prev);
                  setIsNotificationsOpen(false);
                }}
                type="button"
              >
                <div className="profile-button__avatar">
                  <img
                    alt="DAITIGN profile"
                    className="profile-button__avatar-img"
                    src="/profile-avatar.png"
                  />
                </div>
                <Icon
                  name={isProfileOpen ? 'caretUp' : 'caretDown'}
                  size={10}
                />
              </button>
              {isProfileOpen && (
                <div className="netflix-profile-popover" role="dialog">
                  <div className="netflix-profile-popover__profiles">
                    <div className="netflix-profile-popover__item netflix-profile-popover__item--active">
                      <div className="profile-button__avatar">
                        <img
                          alt="DAITIGN"
                          className="profile-button__avatar-img"
                          src="/profile-avatar.png"
                        />
                      </div>
                      <span>DAITIGN</span>
                    </div>
                    <div className="netflix-profile-popover__item">
                      <div className="profile-button__avatar profile-button__avatar--yellow">+</div>
                      <span>Add Profile</span>
                    </div>
                  </div>
                  <div className="netflix-profile-popover__divider" />
                  <div className="netflix-profile-popover__links">
                    <a href="#manage-profiles" onClick={() => setIsProfileOpen(false)}>Manage Profiles</a>
                    <a href="#transfer-profile" onClick={() => setIsProfileOpen(false)}>Transfer Profile</a>
                    <a href="#account" onClick={() => setIsProfileOpen(false)}>Account</a>
                    <a href="#help" onClick={() => setIsProfileOpen(false)}>Help Center</a>
                  </div>
                  <div className="netflix-profile-popover__divider" />
                  <button
                    className="netflix-profile-popover__signout"
                    onClick={() => setIsProfileOpen(false)}
                    type="button"
                  >
                    Sign out of DAITIGN
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {children}

      {/* Mobile Bottom Navigation */}
      <nav aria-label="Mobile Bottom Navigation" className="mobile-bottom-nav">
        <button
          className={cx('mobile-bottom-nav__item', activeId === 'home' && 'mobile-bottom-nav__item--active')}
          onClick={() => {
            navigateTo('/');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          type="button"
        >
          <Icon name="home" size={20} />
          <span>Home</span>
        </button>

        <button
          className={cx('mobile-bottom-nav__item', isSearchOpen && 'mobile-bottom-nav__item--active')}
          onClick={() => {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 100);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          type="button"
        >
          <Icon name="search" size={20} />
          <span>Search</span>
        </button>

        <button
          className={cx('mobile-bottom-nav__item', activeId === 'my-list' && 'mobile-bottom-nav__item--active')}
          onClick={() => {
            navigateTo('/my-list');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          type="button"
        >
          <Icon name="bookmark" size={20} />
          <span>My List</span>
        </button>

        <button
          className={cx('mobile-bottom-nav__item', isProfileOpen && 'mobile-bottom-nav__item--active')}
          onClick={() => {
            setIsProfileOpen((prev) => !prev);
            setIsNotificationsOpen(false);
          }}
          type="button"
        >
          <div className="profile-button__avatar" style={{ width: '1.25rem', height: '1.25rem' }}>
            <img alt="Profile" className="profile-button__avatar-img" src="/profile-avatar.png" />
          </div>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
