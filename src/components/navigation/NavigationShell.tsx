import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { BrandMark } from '../brand/BrandMark';
import { Icon, type IconName } from '../icons/Icon';
import { IconButton } from '../primitives/IconButton';
import './NavigationShell.css';

interface NavigationShellProps {
  children: ReactNode;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
}

interface NavigationItem {
  href: string;
  icon: IconName;
  id: string;
  label: string;
}

interface BrowseItem {
  href: string;
  id: string;
  label: string;
}

const navigationItems: NavigationItem[] = [
  { href: '#home', icon: 'home', id: 'home', label: 'Home' },
  { href: '#series', icon: 'sparkles', id: 'series', label: 'Shows' },
  { href: '#movies', icon: 'grid', id: 'movies', label: 'Movies' },
  { href: '#anime', icon: 'sparkles', id: 'anime', label: 'Games' },
  { href: '#trending', icon: 'sparkles', id: 'trending', label: 'New & Popular' },
  { href: '#my-list', icon: 'bookmark', id: 'my-list', label: 'My List' },
  { href: '#top-rated-movies', icon: 'sparkles', id: 'top-rated-movies', label: 'Browse by Languages' },
];

const browseItems: BrowseItem[] = [
  { href: '#home', id: 'home', label: 'Home' },
  { href: '#series', id: 'series', label: 'Shows' },
  { href: '#movies', id: 'movies', label: 'Movies' },
  { href: '#anime', id: 'anime', label: 'Games' },
  { href: '#trending', id: 'trending', label: 'New & Popular' },
  { href: '#my-list', id: 'my-list', label: 'My List' },
  { href: '#top-rated-movies', id: 'top-rated-movies', label: 'Browse by Languages' },
];

const mockNotifications = [
  {
    id: 1,
    title: 'New Arrival',
    message: 'Watch the critically acclaimed blockbuster now trending globally.',
    time: '2 hours ago',
  },
  {
    id: 2,
    title: 'Top 10 Today',
    message: 'Explore the top trending movies and series in your region.',
    time: '1 day ago',
  },
  {
    id: 3,
    title: 'Season Premiere',
    message: 'Brand new episodes have just landed in your queue.',
    time: '3 days ago',
  },
];

export function NavigationShell({
  children,
  onSearchChange,
  searchQuery = '',
}: NavigationShellProps) {
  const [activeSection, setActiveSection] = useState('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(searchQuery));
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
      if (window.scrollY < 180) {
        setActiveSection('home');
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  useEffect(() => {
    const sections = navigationItems
      .map((item) => (item.href === '#home' ? document.querySelector('#main-content') : document.querySelector(item.href)))
      .filter((section): section is Element => section !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < 180) {
          setActiveSection('home');
          return;
        }
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        if (visible[0]?.target.id) {
          const targetId = visible[0].target.id;
          const matchedItem = navigationItems.find(
            (i) => i.id === targetId || (i.id === 'home' && targetId === 'main-content'),
          );
          if (matchedItem) {
            setActiveSection(matchedItem.id);
          }
        }
      },
      { rootMargin: '-18% 0px -68%', threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="navigation-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header
        className={cx('top-navigation', isScrolled && 'top-navigation--scrolled')}
        ref={navRef}
      >
        <div className="container top-navigation__inner">
          <div className="top-navigation__start">
            <BrandMark />

            {/* Netflix Mobile & Tablet Browse Dropdown */}
            <div className="top-navigation__browse-anchor" ref={browseRef}>
              <button
                aria-expanded={isBrowseOpen}
                aria-haspopup="true"
                aria-label="Browse categories"
                className={cx('top-navigation__browse-btn', isBrowseOpen && 'top-navigation__browse-btn--open')}
                onClick={() => setIsBrowseOpen((prev) => !prev)}
                type="button"
              >
                <span>Browse</span>
                <Icon
                  name={isBrowseOpen ? 'caretUp' : 'caretDown'}
                  size={10}
                />
              </button>

              {isBrowseOpen && (
                <div className="netflix-browse-popover" role="menu">
                  <div className="netflix-browse-popover__items">
                    {browseItems.map((item) => (
                      <a
                        className={cx(
                          'netflix-browse-popover__item',
                          activeSection === item.id && 'netflix-browse-popover__item--active'
                        )}
                        href={item.href}
                        key={item.label}
                        onClick={(e) => {
                          setIsBrowseOpen(false);
                          if (item.href === '#home') {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            window.history.pushState(null, '', '#home');
                            setActiveSection('home');
                            return;
                          }
                          const target = document.querySelector(item.href);
                          if (target) {
                            e.preventDefault();
                            target.scrollIntoView({ behavior: 'smooth' });
                            window.history.pushState(null, '', item.href);
                            setActiveSection(item.id);
                          }
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
            {navigationItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  aria-current={isActive ? 'page' : undefined}
                  className={cx('top-navigation__link', isActive && 'top-navigation__link--active')}
                  href={item.href}
                  key={item.label}
                  onClick={(e) => {
                    if (item.href === '#home') {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      window.history.pushState(null, '', '#home');
                      setActiveSection('home');
                      return;
                    }
                    const target = document.querySelector(item.href);
                    if (target) {
                      e.preventDefault();
                      target.scrollIntoView({ behavior: 'smooth' });
                      window.history.pushState(null, '', item.href);
                      setActiveSection(item.id);
                    }
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="top-navigation__actions">
            {/* Netflix Expandable Search Bar */}
            <div className={cx('netflix-search', isSearchOpen && 'netflix-search--open')}>
              <button
                aria-label="Search"
                className="netflix-search__trigger"
                onClick={() => {
                  setIsSearchOpen((prev) => !prev);
                  if (!isSearchOpen) {
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
                onChange={(e) => onSearchChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (searchQuery) onSearchChange?.('');
                    else setIsSearchOpen(false);
                  }
                }}
                placeholder="Titles, people, genres"
                ref={searchInputRef}
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  aria-label="Clear search"
                  className="netflix-search__clear"
                  onClick={() => {
                    onSearchChange?.('');
                    searchInputRef.current?.focus();
                  }}
                  type="button"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>

            {/* Notifications Dropdown with Netflix 6 Counter Badge */}
            <div className="top-navigation__popover-anchor">
              <IconButton
                aria-expanded={isNotificationsOpen}
                aria-label="Notifications"
                className={cx(isNotificationsOpen && 'top-navigation__action--active')}
                onClick={() => {
                  setIsNotificationsOpen((prev) => !prev);
                  setIsProfileOpen(false);
                }}
                tooltip="Notifications"
              >
                <Icon name="bell" />
                <span aria-hidden="true" className="top-navigation__notification-badge">6</span>
              </IconButton>
              {isNotificationsOpen && (
                <div className="netflix-notifications-popover" role="dialog">
                  <div className="netflix-notifications__header">
                    <h4>Notifications</h4>
                  </div>
                  <div className="netflix-notifications__list">
                    {mockNotifications.map((notif) => (
                      <div className="netflix-notifications__item" key={notif.id}>
                        <div className="netflix-notifications__badge" />
                        <div className="netflix-notifications__text">
                          <strong>{notif.title}</strong>
                          <p>{notif.message}</p>
                          <span>{notif.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Netflix Kids Profile Button */}
            <button
              aria-label="Kids experience"
              className="top-navigation__kids-btn"
              onClick={() => {
                const target = document.querySelector('#anime') || document.querySelector('#trending');
                target?.scrollIntoView({ behavior: 'smooth' });
              }}
              type="button"
            >
              <div className="top-navigation__kids-icon">
                <svg
                  aria-hidden="true"
                  className="top-navigation__kids-svg"
                  fill="none"
                  height="100%"
                  viewBox="0 0 32 32"
                  width="100%"
                >
                  <defs>
                    <linearGradient id="netflix-kids-grad" x1="0" x2="0" y1="0" y2="32" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#0071eb" />
                      <stop offset="100%" stopColor="#004db3" />
                    </linearGradient>
                  </defs>
                  <rect fill="url(#netflix-kids-grad)" height="32" rx="4" width="32" />
                  <circle cx="10" cy="12" fill="#ffffff" r="2" />
                  <circle cx="22" cy="12" fill="#ffffff" r="2" />
                  <path d="M10 18.5C12 22 20 22 22 18.5" stroke="#ffffff" strokeLinecap="round" strokeWidth="2.2" />
                  <rect fill="#e50914" height="8" rx="3" width="14" x="16" y="22" />
                  <text
                    dominantBaseline="middle"
                    fill="#ffffff"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontSize="5.5"
                    fontWeight="900"
                    textAnchor="middle"
                    x="23"
                    y="26.5"
                  >
                    kids
                  </text>
                </svg>
              </div>
              <span className="top-navigation__kids-label">Kids</span>
            </button>

            {/* Netflix Profile Avatar & Menu */}
            <div className="top-navigation__popover-anchor">
              <button
                aria-expanded={isProfileOpen}
                aria-label="Open profile menu"
                className="profile-button"
                onClick={() => {
                  setIsProfileOpen((prev) => !prev);
                  setIsNotificationsOpen(false);
                }}
                type="button"
              >
                <div className="profile-button__avatar">
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="100%"
                    viewBox="0 0 32 32"
                    width="100%"
                  >
                    <rect fill="#e5a00d" height="32" rx="4" width="32" />
                    <circle cx="10" cy="12" fill="#ffffff" r="2" />
                    <circle cx="22" cy="12" fill="#ffffff" r="2" />
                    <path d="M10 18.5C12 22 20 22 22 18.5" stroke="#ffffff" strokeLinecap="round" strokeWidth="2.2" />
                  </svg>
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
                      <div className="profile-button__avatar profile-button__avatar--red">☺</div>
                      <span>User</span>
                    </div>
                    <div className="netflix-profile-popover__item">
                      <div className="profile-button__avatar profile-button__avatar--green">★</div>
                      <span>Kids</span>
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
                    Sign out of Netflix
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
