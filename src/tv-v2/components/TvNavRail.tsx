import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '../../components/brand/BrandMark';
import { Icon } from '../../components/icons/Icon';
import { useTvFocus } from '../focus/TvFocusContext';
import type { Direction } from '../focus/TvFocusEngine';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus';
import {
  TV_V2_MOVIE_GENRES,
  TV_V2_TV_GENRES,
  type TvGenreItem,
} from '../catalog/tvGenreCatalog';
import { TvGenreSubmenu } from './TvGenreSubmenu';
import { TvNotificationsDropdown } from './TvNotificationsDropdown';
import { TvProfileDropdown, type TvProfileAction } from './TvProfileDropdown';
import type { TvNotificationItem } from '../notifications/tvNotificationCatalog';
import { PRIMARY_NAV_ITEMS, type TvNavItem } from '../navigation/tvNavConfig';
export { PRIMARY_NAV_ITEMS, type TvNavItem };
import './TvComponents.css';

export type HeaderPopup = 'movies' | 'shows' | 'notifications' | 'profile' | null;

interface TvNavRailProps {
  activeTab: string;
  hasSearchResults?: boolean;
  isSearchExpanded?: boolean;
  notifications?: TvNotificationItem[];
  onClearSearch?: () => void;
  onCollapseSearch?: () => void;
  onExpandSearch?: () => void;
  onSearchQueryChange?: (query: string) => void;
  onSelectMovieGenre?: (genreId: string) => void;
  onSelectNotification?: (notif: TvNotificationItem) => void;
  onSelectProfileAction?: (action: TvProfileAction) => void;
  onSelectTab: (tabId: string) => void;
  onSelectTvGenre?: (genreId: string) => void;
  searchQuery?: string;
  selectedMovieGenre?: string;
  selectedTvGenre?: string;
  unreadNotificationCount?: number;
}

export function TvNavRail({
  activeTab,
  hasSearchResults = false,
  isSearchExpanded,
  notifications = [],
  onClearSearch,
  onCollapseSearch,
  onExpandSearch,
  onSearchQueryChange,
  onSelectMovieGenre,
  onSelectNotification,
  onSelectProfileAction,
  onSelectTab,
  onSelectTvGenre,
  searchQuery = '',
  selectedMovieGenre = 'all',
  selectedTvGenre = 'all',
  unreadNotificationCount = 0,
}: TvNavRailProps) {
  useTvFocusRow({ id: 'nav-row', order: 0 });
  const { popScope, pushScope, setFocus } = useTvFocus();
  const [openPopup, setOpenPopup] = useState<HeaderPopup>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close genre submenu if tab switches away from movies or shows
  useEffect(() => {
    if (activeTab !== 'movies' && activeTab !== 'shows') {
      if (openPopup === 'movies' || openPopup === 'shows') {
        popScope();
        setOpenPopup(null);
      }
    }
  }, [activeTab, openPopup, popScope]);

  const closeCurrentPopup = () => {
    if (openPopup) {
      popScope();
      setOpenPopup(null);
    }
  };

  const openSubmenu = (tab: 'movies' | 'shows') => {
    if (openPopup && openPopup !== tab) {
      popScope();
    }
    if (isSearchExpanded) {
      onCollapseSearch?.();
    }
    if (activeTab !== tab) {
      onSelectTab(tab);
    }
    setOpenPopup(tab);
    const targetId =
      tab === 'movies'
        ? `genre-nav-movies-${selectedMovieGenre || 'all'}`
        : `genre-nav-shows-${selectedTvGenre || 'all'}`;
    pushScope('genre-submenu-scope', targetId);
  };

  const openNotifications = () => {
    if (openPopup && openPopup !== 'notifications') {
      popScope();
    }
    if (isSearchExpanded) {
      onCollapseSearch?.();
    }
    setOpenPopup('notifications');
    const initialId = notifications.length > 0 ? 'notif-item-0' : 'notif-empty-item';
    pushScope('notifications-scope', initialId);
  };

  const openProfile = () => {
    if (openPopup && openPopup !== 'profile') {
      popScope();
    }
    if (isSearchExpanded) {
      onCollapseSearch?.();
    }
    setOpenPopup('profile');
    pushScope('profile-scope', 'profile-item-my-list');
  };

  const exitSubmenuToContent = () => {
    if (openPopup) {
      popScope();
      setOpenPopup(null);
      setFocus('hero-play');
    }
  };

  const handleSelectGenreItem = (type: 'movie' | 'tv', genre: TvGenreItem) => {
    if (type === 'movie') {
      onSelectMovieGenre?.(genre.id);
    } else {
      onSelectTvGenre?.(genre.id);
    }
    closeCurrentPopup();
  };

  return (
    <header className={`tv-v2-nav-rail ${isScrolled ? 'tv-v2-nav-rail--scrolled' : ''}`}>
      <div className="tv-v2-nav-rail__brand" data-testid="nav-brand">
        <BrandMark className="tv-v2-brand-mark" />
      </div>

      <nav aria-label="Main Navigation" className="tv-v2-nav-rail__links">
        {PRIMARY_NAV_ITEMS.map((item, idx) => {
          const hasSubmenu = item.id === 'movies' || item.id === 'shows';
          const isSubmenuOpen = openPopup === item.id;

          return (
            <div
              className="tv-v2-nav-btn-wrapper"
              key={item.id}
              style={{ position: 'relative' }}
            >
              <TvNavButton
                activeTab={activeTab}
                colIndex={idx}
                hasSubmenu={hasSubmenu}
                isActive={activeTab === item.id}
                isSubmenuOpen={isSubmenuOpen}
                item={item}
                onDirection={(direction) => {
                  if (direction === 'down' && hasSubmenu) {
                    openSubmenu(item.id as 'movies' | 'shows');
                    return true;
                  }
                  if (direction === 'right' && item.id === 'my-list') {
                    setFocus('nav-search');
                    return true;
                  }
                  return false;
                }}
                onSelect={() => {
                  if (hasSubmenu) {
                    if (isSubmenuOpen) {
                      closeCurrentPopup();
                    } else {
                      openSubmenu(item.id as 'movies' | 'shows');
                    }
                  } else {
                    closeCurrentPopup();
                    onSelectTab(item.id);
                  }
                }}
                onSelectTab={onSelectTab}
              />

              {item.id === 'movies' && isSubmenuOpen && (
                <TvGenreSubmenu
                  genres={TV_V2_MOVIE_GENRES}
                  isOpen={true}
                  onClose={closeCurrentPopup}
                  onExitDownToContent={exitSubmenuToContent}
                  onSelectGenre={(genre) => handleSelectGenreItem('movie', genre)}
                  originatingNavId="nav-movies"
                  selectedGenreId={selectedMovieGenre}
                />
              )}

              {item.id === 'shows' && isSubmenuOpen && (
                <TvGenreSubmenu
                  genres={TV_V2_TV_GENRES}
                  isOpen={true}
                  onClose={closeCurrentPopup}
                  onExitDownToContent={exitSubmenuToContent}
                  onSelectGenre={(genre) => handleSelectGenreItem('tv', genre)}
                  originatingNavId="nav-shows"
                  selectedGenreId={selectedTvGenre}
                />
              )}
            </div>
          );
        })}
      </nav>

      <div className="tv-v2-nav-rail__actions">
        {/* Search Control */}
        <TvNavSearch
          activeTab={activeTab}
          colIndex={PRIMARY_NAV_ITEMS.length}
          hasResults={hasSearchResults}
          isExpanded={isSearchExpanded ?? (activeTab === 'search')}
          onClear={onClearSearch ?? (() => {})}
          onCollapse={
            onCollapseSearch ??
            (() => {
              if (activeTab === 'search') onSelectTab('home');
            })
          }
          onExpand={() => {
            closeCurrentPopup();
            if (onExpandSearch) onExpandSearch();
            else onSelectTab('search');
          }}
          onQueryChange={onSearchQueryChange ?? (() => {})}
          onSelectTab={onSelectTab}
          query={searchQuery}
        />

        {/* Notifications Control */}
        <TvNavNotifications
          colIndex={PRIMARY_NAV_ITEMS.length + 1}
          isOpen={openPopup === 'notifications'}
          notifications={notifications}
          onClose={closeCurrentPopup}
          onOpen={openNotifications}
          onSelectNotification={(notif) => {
            onSelectNotification?.(notif);
            closeCurrentPopup();
          }}
          unreadCount={unreadNotificationCount}
        />

        {/* Profile Control */}
        <TvNavProfile
          colIndex={PRIMARY_NAV_ITEMS.length + 2}
          isOpen={openPopup === 'profile'}
          onClose={closeCurrentPopup}
          onOpen={openProfile}
          onSelectAction={(action) => {
            onSelectProfileAction?.(action);
            closeCurrentPopup();
          }}
        />
      </div>
    </header>
  );
}

function TvNavButton({
  activeTab,
  colIndex,
  hasSubmenu,
  isActive,
  isSubmenuOpen,
  item,
  onDirection,
  onSelect,
  onSelectTab,
}: {
  activeTab: string;
  colIndex: number;
  hasSubmenu?: boolean;
  isActive: boolean;
  isSubmenuOpen?: boolean;
  item: TvNavItem;
  onDirection?: (direction: Direction) => boolean | void;
  onSelect: () => void;
  onSelectTab: (tabId: string) => void;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id: `nav-${item.id}`,
    onBack: () => {
      if (activeTab !== 'home') {
        onSelectTab('home');
        return true;
      }
      return false;
    },
    onDirection,
    onSelect,
    rowId: 'nav-row',
  });

  return (
    <div
      aria-current={isActive ? 'page' : undefined}
      aria-expanded={hasSubmenu ? isSubmenuOpen : undefined}
      aria-haspopup={hasSubmenu ? 'menu' : undefined}
      aria-selected={isActive}
      className={`tv-v2-nav-btn ${isFocused ? 'tv-v2-nav-btn--focused' : ''} ${
        isActive ? 'tv-v2-nav-btn--active' : ''
      }`}
      data-testid={`nav-${item.id}`}
      data-tv-focusable="true"
      id={`nav-${item.id}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <span className="tv-v2-nav-btn__label">{item.label}</span>
      {hasSubmenu && (
        <span aria-hidden="true" className="tv-v2-nav-btn__chevron">
          {isSubmenuOpen ? '▴' : '▾'}
        </span>
      )}
    </div>
  );
}

function TvNavSearch({
  activeTab,
  colIndex,
  hasResults,
  isExpanded,
  onClear,
  onCollapse,
  onExpand,
  onQueryChange,
  onSelectTab,
  query,
}: {
  activeTab: string;
  colIndex: number;
  hasResults: boolean;
  isExpanded: boolean;
  onClear: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  onQueryChange: (query: string) => void;
  onSelectTab: (tabId: string) => void;
  query: string;
}) {
  const { setFocus } = useTvFocus();
  const inputRef = useRef<HTMLInputElement>(null);

  const { isFocused } = useTvFocusNode({
    colIndex,
    id: 'nav-search',
    onBack: () => {
      if (isExpanded) {
        onCollapse();
        return true;
      }
      if (activeTab !== 'home') {
        onSelectTab('home');
        return true;
      }
      return false;
    },
    onDirection: (direction) => {
      if (isExpanded) {
        if (direction === 'down') {
          if (hasResults) {
            setFocus('search-result-0');
            return true;
          }
          return true;
        }
        if (direction === 'up') {
          return true;
        }
        if (direction === 'left') {
          const input = inputRef.current;
          if (input && document.activeElement === input) {
            if (input.selectionStart !== null && input.selectionStart > 0) {
              return true;
            }
          }
          setFocus('nav-my-list');
          return true;
        }
        if (direction === 'right') {
          const input = inputRef.current;
          if (input && document.activeElement === input) {
            if (input.selectionEnd !== null && input.selectionEnd < (input.value?.length ?? 0)) {
              return true;
            }
          }
          setFocus('nav-notifications');
          return true;
        }
      } else {
        if (direction === 'right') {
          setFocus('nav-notifications');
          return true;
        }
        if (direction === 'left') {
          setFocus('nav-my-list');
          return true;
        }
        if (direction === 'down') {
          setFocus('hero-play');
          return true;
        }
      }
      return false;
    },
    onSelect: () => {
      if (!isExpanded) {
        onExpand();
      } else {
        inputRef.current?.focus();
      }
    },
    rowId: 'nav-row',
  });

  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        if (typeof window !== 'undefined' && window.AndroidTVBridge?.showKeyboard) {
          try {
            window.AndroidTVBridge.showKeyboard();
          } catch {}
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  return (
    <div className="tv-v2-nav-search-container">
      <div
        aria-expanded={isExpanded}
        className={`tv-v2-nav-search ${
          isExpanded ? 'tv-v2-nav-search--expanded' : 'tv-v2-nav-search--collapsed'
        } ${isFocused ? 'tv-v2-nav-search--focused' : ''} ${
          activeTab === 'search' ? 'tv-v2-nav-search--active' : ''
        }`}
        data-testid="nav-search"
        data-tv-focusable="true"
        id="nav-search"
        onClick={() => {
          if (!isExpanded) {
            onExpand();
          } else {
            inputRef.current?.focus();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span aria-hidden="true" className="tv-v2-nav-search__icon">
          <Icon name="search" size={isExpanded ? 20 : 24} />
        </span>

        {isExpanded && (
          <input
            autoComplete="off"
            className="tv-v2-nav-search__input"
            data-testid="search-input"
            id="search-input"
            inputMode="search"
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Titles, people, genres"
            ref={inputRef}
            type="search"
            value={query}
          />
        )}

        {isExpanded && query.length > 0 && (
          <button
            aria-label="Clear search"
            className="tv-v2-nav-search__clear"
            data-testid="search-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              inputRef.current?.focus();
            }}
            tabIndex={-1}
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function TvNavNotifications({
  colIndex,
  isOpen,
  notifications,
  onClose,
  onOpen,
  onSelectNotification,
  unreadCount,
}: {
  colIndex: number;
  isOpen: boolean;
  notifications: TvNotificationItem[];
  onClose: () => void;
  onOpen: () => void;
  onSelectNotification: (notif: TvNotificationItem) => void;
  unreadCount: number;
}) {
  const { setFocus } = useTvFocus();
  const { isFocused } = useTvFocusNode({
    colIndex,
    id: 'nav-notifications',
    onBack: () => {
      if (isOpen) {
        onClose();
        return true;
      }
      return false;
    },
    onDirection: (direction) => {
      if (direction === 'left') {
        setFocus('nav-search');
        return true;
      }
      if (direction === 'right') {
        setFocus('nav-profile');
        return true;
      }
      if (direction === 'down' && !isOpen) {
        setFocus('hero-play');
        return true;
      }
      return false;
    },
    onSelect: () => {
      if (isOpen) onClose();
      else onOpen();
    },
    rowId: 'nav-row',
  });

  return (
    <div className="tv-v2-dropdown-anchor" style={{ position: 'relative' }}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className={`tv-v2-nav-action-btn ${isFocused ? 'tv-v2-nav-action-btn--focused' : ''}`}
        data-testid="nav-notifications"
        data-tv-focusable="true"
        id="nav-notifications"
        onClick={() => (isOpen ? onClose() : onOpen())}
        type="button"
      >
        <Icon name="bell" size={24} />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="tv-v2-notif-badge" data-testid="notification-badge">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <TvNotificationsDropdown
          isOpen={true}
          notifications={notifications}
          onClose={onClose}
          onSelectNotification={onSelectNotification}
        />
      )}
    </div>
  );
}

function TvNavProfile({
  colIndex,
  isOpen,
  onClose,
  onOpen,
  onSelectAction,
}: {
  colIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onSelectAction: (action: TvProfileAction) => void;
}) {
  const { setFocus } = useTvFocus();
  const { isFocused } = useTvFocusNode({
    colIndex,
    id: 'nav-profile',
    onBack: () => {
      if (isOpen) {
        onClose();
        return true;
      }
      return false;
    },
    onDirection: (direction) => {
      if (direction === 'left') {
        setFocus('nav-notifications');
        return true;
      }
      if (direction === 'right') {
        return true;
      }
      if (direction === 'down' && !isOpen) {
        setFocus('hero-play');
        return true;
      }
      return false;
    },
    onSelect: () => {
      if (isOpen) onClose();
      else onOpen();
    },
    rowId: 'nav-row',
  });

  return (
    <div className="tv-v2-dropdown-anchor" style={{ position: 'relative' }}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Profile and Settings"
        className={`tv-v2-nav-action-btn ${isFocused ? 'tv-v2-nav-action-btn--focused' : ''}`}
        data-testid="nav-profile"
        data-tv-focusable="true"
        id="nav-profile"
        onClick={() => (isOpen ? onClose() : onOpen())}
        type="button"
      >
        <div className="tv-v2-profile-avatar-pill" data-testid="profile-avatar">
          <img alt="DV Profile" src="/profile-avatar.png" />
        </div>
        <span aria-hidden="true" className="tv-v2-profile-chevron">
          {isOpen ? '▴' : '▾'}
        </span>
      </button>

      {isOpen && (
        <TvProfileDropdown
          isOpen={true}
          onClose={onClose}
          onSelectAction={onSelectAction}
        />
      )}
    </div>
  );
}
