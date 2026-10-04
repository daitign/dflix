import { useEffect, useMemo, useState } from 'react';
import { getTmdbHomeCatalog, type HomeCatalog, type MediaItem } from '../../features/catalog';
import { searchMulti } from '../../lib/tmdb';
import { useTvFocus } from '../focus/TvFocusContext';
import { TvFooter } from '../components/TvFooter';
import { TvHero } from '../components/TvHero';
import { TvMediaRow } from '../components/TvMediaRow';
import { TvNavRail } from '../components/TvNavRail';
import {
  fetchTvGenreCatalog,
  TV_V2_MOVIE_GENRES,
  TV_V2_TV_GENRES,
  type TvGenreCatalogData,
} from '../catalog/tvGenreCatalog';
import {
  fetchTvNewPopularCatalog,
  type TvNewPopularCatalogData,
} from '../catalog/tvNewPopularCatalog';
import {
  fetchTvNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  type TvNotificationItem,
} from '../notifications/tvNotificationCatalog';
import {
  TvAccountModal,
  TvHelpModal,
  TvSettingsModal,
  TvSignOutModal,
} from '../components/TvProfileModals';
import type { TvProfileAction } from '../components/TvProfileDropdown';
import { TvSearchScreen } from './TvSearchScreen';
import { TvMyListScreen } from './TvMyListScreen';
import { TvLanguagesScreen } from './TvLanguagesScreen';
import './TvScreens.css';

interface TvHomeScreenProps {
  isInList: (id: string | number) => boolean;
  myListItems?: MediaItem[];
  onOpenDetails: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  onToggleList: (item: MediaItem) => void;
}

export function TvHomeScreen({
  isInList,
  myListItems = [],
  onOpenDetails,
  onPlay,
  onToggleList,
}: TvHomeScreenProps) {
  const { ensureInitialFocus, popScope, pushScope, setFocus } = useTvFocus();
  const [catalog, setCatalog] = useState<HomeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');

  // Search states for in-header Netflix search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Genre states for Movies and TV Shows
  const [selectedMovieGenre, setSelectedMovieGenre] = useState('all');
  const [selectedTvGenre, setSelectedTvGenre] = useState('all');
  const [movieGenreCatalog, setMovieGenreCatalog] = useState<TvGenreCatalogData | null>(null);
  const [tvGenreCatalog, setTvGenreCatalog] = useState<TvGenreCatalogData | null>(null);

  // New & Popular catalog
  const [newPopularCatalog, setNewPopularCatalog] = useState<TvNewPopularCatalogData | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<TvNotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Profile modal state
  const [activeProfileModal, setActiveProfileModal] = useState<
    'settings' | 'account' | 'help' | 'signout' | null
  >(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getTmdbHomeCatalog()
      .then((data) => {
        if (active) {
          setCatalog(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Catalog unavailable');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch real notifications
  useEffect(() => {
    let active = true;
    fetchTvNotifications()
      .then((items) => {
        if (active) {
          setNotifications(items);
          setUnreadNotifCount(getUnreadNotificationCount(items));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Fetch New & Popular when tab is activated
  useEffect(() => {
    if (activeTab === 'new-popular' && !newPopularCatalog) {
      fetchTvNewPopularCatalog().then((data) => {
        if (data) setNewPopularCatalog(data);
      });
    }
  }, [activeTab, newPopularCatalog]);

  useEffect(() => {
    if (!loading && catalog) {
      ensureInitialFocus('nav-home');
    }
  }, [loading, catalog, ensureInitialFocus]);

  // Debounced search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      searchMulti(trimmed)
        .then((items) => {
          const filtered = items.filter(
            (item) => item && item.title && (item.posterUrl || item.backdropUrl)
          );
          setSearchResults(filtered);
        })
        .catch(() => {
          setSearchResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenSearch = () => {
    setIsSearchExpanded(true);
    setActiveTab('search');
    setFocus('nav-search');
  };

  const handleCloseSearch = () => {
    setIsSearchExpanded(false);
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('home');
    setFocus('nav-search');
  };

  const handleSelectTab = (tabId: string) => {
    if (tabId === 'search') {
      handleOpenSearch();
      return;
    }

    if (isSearchExpanded) {
      setIsSearchExpanded(false);
      setSearchQuery('');
      setSearchResults([]);
    }

    setActiveTab(tabId);
    if (tabId === 'home') {
      setSelectedMovieGenre('all');
      setSelectedTvGenre('all');
    }
    setFocus(`nav-${tabId}`);
  };

  const handleSelectNotification = (notif: TvNotificationItem) => {
    markNotificationAsRead(notif.id);
    setUnreadNotifCount(getUnreadNotificationCount(notifications));
    if (notif.item) {
      onOpenDetails(notif.item);
    }
  };

  const handleSelectProfileAction = (action: TvProfileAction) => {
    if (action === 'my-list') {
      handleSelectTab('my-list');
      return;
    }
    if (action === 'settings') {
      pushScope('profile-settings-scope', 'profile-settings-item-1');
      setActiveProfileModal('settings');
      return;
    }
    if (action === 'account') {
      pushScope('profile-account-scope', 'profile-account-close-btn');
      setActiveProfileModal('account');
      return;
    }
    if (action === 'help') {
      pushScope('profile-help-scope', 'profile-help-close-btn');
      setActiveProfileModal('help');
      return;
    }
    if (action === 'signout') {
      pushScope('profile-signout-scope', 'profile-signout-btn-0');
      setActiveProfileModal('signout');
      return;
    }
  };

  const handleCloseProfileModal = () => {
    popScope();
    setActiveProfileModal(null);
    setFocus('nav-profile');
  };

  // Baseline content for TV Shows and Movies tabs
  const showsBaseline = useMemo(() => {
    if (!catalog) return null;
    const hero =
      catalog.rows.find((r) => r.id === 'series')?.items[0] ||
      (catalog.hero.type === 'tv' ? catalog.hero : catalog.hero);
    const topTen = catalog.topTen.filter((item) => item.type === 'tv');
    const rows = catalog.rows.filter(
      (r) =>
        r.id === 'series' ||
        r.id === 'top-rated-tv' ||
        r.id === 'on-the-air' ||
        r.id === 'airing-today' ||
        r.id === 'anime'
    );
    return { hero, rows, topTen };
  }, [catalog]);

  const moviesBaseline = useMemo(() => {
    if (!catalog) return null;
    const hero =
      catalog.rows.find((r) => r.id === 'movies')?.items[0] ||
      (catalog.hero.type === 'movie' ? catalog.hero : catalog.hero);
    const topTen = catalog.topTen.filter((item) => item.type === 'movie');
    const rows = catalog.rows.filter(
      (r) =>
        r.id === 'movies' ||
        r.id === 'top-rated-movies' ||
        r.id === 'upcoming'
    );
    return { hero, rows, topTen };
  }, [catalog]);

  // Fetch genre-filtered catalogs on genre change
  useEffect(() => {
    if (selectedMovieGenre === 'all') {
      setMovieGenreCatalog(null);
      return;
    }

    let active = true;
    fetchTvGenreCatalog('movie', selectedMovieGenre, moviesBaseline)
      .then((data) => {
        if (active && data) {
          setMovieGenreCatalog(data);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [selectedMovieGenre, moviesBaseline]);

  useEffect(() => {
    if (selectedTvGenre === 'all') {
      setTvGenreCatalog(null);
      return;
    }

    let active = true;
    fetchTvGenreCatalog('tv', selectedTvGenre, showsBaseline)
      .then((data) => {
        if (active && data) {
          setTvGenreCatalog(data);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [selectedTvGenre, showsBaseline]);

  // Effective content
  const effectiveMovies =
    selectedMovieGenre !== 'all' && movieGenreCatalog ? movieGenreCatalog : moviesBaseline;
  const effectiveShows =
    selectedTvGenre !== 'all' && tvGenreCatalog ? tvGenreCatalog : showsBaseline;

  if (loading) {
    return (
      <div className="tv-v2-loading-screen">
        <div className="tv-v2-loading-spinner" />
        <span>Loading DAITIGN TV…</span>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="tv-v2-error-screen">
        <h2>Unable to load catalog</h2>
        <p>{error || 'An error occurred while loading content.'}</p>
        <button
          className="tv-v2-error-retry-btn"
          onClick={() => window.location.reload()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  const movieGenreName = TV_V2_MOVIE_GENRES.find((g) => g.id === selectedMovieGenre)?.name;
  const tvGenreName = TV_V2_TV_GENRES.find((g) => g.id === selectedTvGenre)?.name;

  const getMovieGenreHeading = (genreName?: string) => {
    if (!genreName || genreName === 'All Movies') return '';
    if (genreName.toLowerCase().includes('movie')) return genreName;
    return `${genreName} Movies`;
  };

  const getTvGenreHeading = (genreName?: string) => {
    if (!genreName || genreName === 'All TV Shows') return '';
    const lower = genreName.toLowerCase();
    if (lower.includes('series') || lower.includes('tv') || lower.includes('shows')) {
      return genreName;
    }
    return `${genreName} TV Shows`;
  };

  const movieGenreHeading = selectedMovieGenre !== 'all' ? getMovieGenreHeading(movieGenreName) : '';
  const tvGenreHeading = selectedTvGenre !== 'all' ? getTvGenreHeading(tvGenreName) : '';

  return (
    <div className="tv-v2-home-screen">
      <TvNavRail
        activeTab={activeTab}
        hasSearchResults={searchResults.length > 0}
        isSearchExpanded={isSearchExpanded}
        notifications={notifications}
        onClearSearch={() => setSearchQuery('')}
        onCollapseSearch={handleCloseSearch}
        onExpandSearch={handleOpenSearch}
        onSearchQueryChange={setSearchQuery}
        onSelectMovieGenre={(genreId) => setSelectedMovieGenre(genreId)}
        onSelectNotification={handleSelectNotification}
        onSelectProfileAction={handleSelectProfileAction}
        onSelectTab={handleSelectTab}
        onSelectTvGenre={(genreId) => setSelectedTvGenre(genreId)}
        searchQuery={searchQuery}
        selectedMovieGenre={selectedMovieGenre}
        selectedTvGenre={selectedTvGenre}
        unreadNotificationCount={unreadNotifCount}
      />

      {activeTab === 'search' && (
        <TvSearchScreen
          isSearching={isSearching}
          onClose={handleCloseSearch}
          onOpenDetails={onOpenDetails}
          query={searchQuery}
          results={searchResults}
        />
      )}

      {activeTab === 'my-list' && (
        <TvMyListScreen
          items={myListItems}
          onExplore={() => {
            setActiveTab('home');
            setFocus('nav-home');
          }}
          onOpenDetails={onOpenDetails}
        />
      )}

      {activeTab === 'languages' && (
        <TvLanguagesScreen
          onOpenDetails={onOpenDetails}
          onReturnToNav={() => setFocus('nav-languages')}
        />
      )}

      {activeTab === 'new-popular' && (
        <main className="tv-v2-home-content">
          {newPopularCatalog ? (
            <>
              <TvHero
                isInList={isInList(newPopularCatalog.hero.id)}
                item={newPopularCatalog.hero}
                onOpenDetails={onOpenDetails}
                onPlay={onPlay}
                onToggleList={onToggleList}
              />

              {newPopularCatalog.topTen && newPopularCatalog.topTen.length > 0 && (
                <TvMediaRow
                  id="row-new-top-10"
                  isRanked
                  items={newPopularCatalog.topTen}
                  onSelectItem={onOpenDetails}
                  order={2}
                  title="Top 10 Today"
                />
              )}

              {newPopularCatalog.rows.map((row, idx) => (
                <TvMediaRow
                  id={`row-${row.id}`}
                  items={row.items}
                  key={row.id}
                  onSelectItem={onOpenDetails}
                  order={idx + 3}
                  title={row.title}
                />
              ))}

              <TvFooter onBackToTop={() => setFocus('nav-new-popular')} />
            </>
          ) : (
            <div className="tv-v2-loading-screen">
              <div className="tv-v2-loading-spinner" />
              <span>Loading New & Popular…</span>
            </div>
          )}
        </main>
      )}

      {activeTab === 'shows' && effectiveShows && (
        <main className="tv-v2-home-content">
          <TvHero
            isInList={isInList(effectiveShows.hero.id)}
            item={effectiveShows.hero}
            onOpenDetails={onOpenDetails}
            onPlay={onPlay}
            onToggleList={onToggleList}
          />

          {tvGenreHeading && (
            <div className="tv-v2-genre-context" data-testid="tv-genre-context-heading">
              <h2 className="tv-v2-genre-context__title">{tvGenreHeading}</h2>
            </div>
          )}

          {effectiveShows.topTen.length > 0 && (
            <TvMediaRow
              id="row-shows-top-10"
              isRanked
              items={effectiveShows.topTen}
              onSelectItem={onOpenDetails}
              order={2}
              title={
                selectedTvGenre !== 'all' && tvGenreName
                  ? `Top 10 in ${tvGenreName}`
                  : 'Top 10 TV Shows Today'
              }
            />
          )}

          {effectiveShows.rows.map((row, idx) => (
            <TvMediaRow
              id={`row-${row.id}`}
              items={row.items}
              key={row.id}
              onSelectItem={onOpenDetails}
              order={idx + 3}
              title={row.title}
            />
          ))}

          <TvFooter onBackToTop={() => setFocus('nav-shows')} />
        </main>
      )}

      {activeTab === 'movies' && effectiveMovies && (
        <main className="tv-v2-home-content">
          <TvHero
            isInList={isInList(effectiveMovies.hero.id)}
            item={effectiveMovies.hero}
            onOpenDetails={onOpenDetails}
            onPlay={onPlay}
            onToggleList={onToggleList}
          />

          {movieGenreHeading && (
            <div className="tv-v2-genre-context" data-testid="tv-genre-context-heading">
              <h2 className="tv-v2-genre-context__title">{movieGenreHeading}</h2>
            </div>
          )}

          {effectiveMovies.topTen.length > 0 && (
            <TvMediaRow
              id="row-movies-top-10"
              isRanked
              items={effectiveMovies.topTen}
              onSelectItem={onOpenDetails}
              order={2}
              title={
                selectedMovieGenre !== 'all' && movieGenreName
                  ? `Top 10 in ${movieGenreName}`
                  : 'Top 10 Movies Today'
              }
            />
          )}

          {effectiveMovies.rows.map((row, idx) => (
            <TvMediaRow
              id={`row-${row.id}`}
              items={row.items}
              key={row.id}
              onSelectItem={onOpenDetails}
              order={idx + 3}
              title={row.title}
            />
          ))}

          <TvFooter onBackToTop={() => setFocus('nav-movies')} />
        </main>
      )}

      {activeTab === 'home' && (
        <main className="tv-v2-home-content">
          <TvHero
            isInList={isInList(catalog.hero.id)}
            item={catalog.hero}
            onOpenDetails={onOpenDetails}
            onPlay={onPlay}
            onToggleList={onToggleList}
          />

          {catalog.topTen && catalog.topTen.length > 0 && (
            <TvMediaRow
              id="row-top-10"
              isRanked
              items={catalog.topTen}
              onSelectItem={onOpenDetails}
              order={2}
              title="Top 10 Today"
            />
          )}

          {catalog.rows.map((row, idx) => (
            <TvMediaRow
              id={`row-${row.id}`}
              items={row.items}
              key={row.id}
              onSelectItem={onOpenDetails}
              order={idx + 3}
              title={row.title}
            />
          ))}

          <TvFooter onBackToTop={() => setFocus('nav-home')} />
        </main>
      )}

      {/* Global Modals for Profile Actions */}
      <TvSettingsModal
        isOpen={activeProfileModal === 'settings'}
        onClose={handleCloseProfileModal}
      />

      <TvAccountModal
        isOpen={activeProfileModal === 'account'}
        onClose={handleCloseProfileModal}
      />

      <TvHelpModal
        isOpen={activeProfileModal === 'help'}
        onClose={handleCloseProfileModal}
      />

      <TvSignOutModal
        isOpen={activeProfileModal === 'signout'}
        onClose={handleCloseProfileModal}
        onConfirmSignOut={() => {
          handleSelectTab('home');
        }}
      />
    </div>
  );
}
