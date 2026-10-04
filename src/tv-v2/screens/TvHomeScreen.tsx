import { useEffect, useMemo, useState } from 'react';
import { getTmdbHomeCatalog, type HomeCatalog, type MediaItem } from '../../features/catalog';
import { useTvFocus } from '../focus/TvFocusContext.tsx';
import { TvFooter } from '../components/TvFooter.tsx';
import { TvHero } from '../components/TvHero.tsx';
import { TvMediaRow } from '../components/TvMediaRow.tsx';
import { TvNavRail } from '../components/TvNavRail.tsx';
import {
  fetchTvGenreCatalog,
  TV_V2_MOVIE_GENRES,
  TV_V2_TV_GENRES,
  type TvGenreCatalogData,
} from '../catalog/tvGenreCatalog.ts';
import { TvSearchScreen } from './TvSearchScreen.tsx';
import { TvMyListScreen } from './TvMyListScreen.tsx';
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
  const { ensureInitialFocus, setFocus } = useTvFocus();
  const [catalog, setCatalog] = useState<HomeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');

  // Genre states for Movies and TV Shows
  const [selectedMovieGenre, setSelectedMovieGenre] = useState('all');
  const [selectedTvGenre, setSelectedTvGenre] = useState('all');
  const [movieGenreCatalog, setMovieGenreCatalog] = useState<TvGenreCatalogData | null>(null);
  const [tvGenreCatalog, setTvGenreCatalog] = useState<TvGenreCatalogData | null>(null);

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

  useEffect(() => {
    if (!loading && catalog) {
      ensureInitialFocus('nav-home');
    }
  }, [loading, catalog, ensureInitialFocus]);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'home') {
      // Returning home resets genre state
      setSelectedMovieGenre('all');
      setSelectedTvGenre('all');
    }
    if (tabId !== 'search') {
      setFocus(`nav-${tabId}`);
    }
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
        onSelectMovieGenre={(genreId) => setSelectedMovieGenre(genreId)}
        onSelectTab={handleSelectTab}
        onSelectTvGenre={(genreId) => setSelectedTvGenre(genreId)}
        selectedMovieGenre={selectedMovieGenre}
        selectedTvGenre={selectedTvGenre}
      />

      {activeTab === 'search' && (
        <TvSearchScreen
          onClose={() => {
            setActiveTab('home');
            setFocus('nav-search');
          }}
          onOpenDetails={onOpenDetails}
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
    </div>
  );
}
