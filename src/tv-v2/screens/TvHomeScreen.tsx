import { useEffect, useMemo, useState } from 'react';
import { getTmdbHomeCatalog, type HomeCatalog, type MediaItem } from '../../features/catalog';
import { useTvFocus } from '../focus/TvFocusContext.tsx';
import { TvFooter } from '../components/TvFooter.tsx';
import { TvHero } from '../components/TvHero.tsx';
import { TvMediaRow } from '../components/TvMediaRow.tsx';
import { TvNavRail } from '../components/TvNavRail.tsx';
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
    if (tabId !== 'search') {
      setFocus(`nav-${tabId}`);
    }
  };

  // Derived content for TV Shows and Movies tabs
  const showsContent = useMemo(() => {
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

  const moviesContent = useMemo(() => {
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

  return (
    <div className="tv-v2-home-screen">
      <TvNavRail activeTab={activeTab} onSelectTab={handleSelectTab} />

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

      {activeTab === 'shows' && showsContent && (
        <main className="tv-v2-home-content">
          <TvHero
            isInList={isInList(showsContent.hero.id)}
            item={showsContent.hero}
            onOpenDetails={onOpenDetails}
            onPlay={onPlay}
            onToggleList={onToggleList}
          />

          {showsContent.topTen.length > 0 && (
            <TvMediaRow
              id="row-shows-top-10"
              isRanked
              items={showsContent.topTen}
              onSelectItem={onOpenDetails}
              order={2}
              title="Top 10 TV Shows Today"
            />
          )}

          {showsContent.rows.map((row, idx) => (
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

      {activeTab === 'movies' && moviesContent && (
        <main className="tv-v2-home-content">
          <TvHero
            isInList={isInList(moviesContent.hero.id)}
            item={moviesContent.hero}
            onOpenDetails={onOpenDetails}
            onPlay={onPlay}
            onToggleList={onToggleList}
          />

          {moviesContent.topTen.length > 0 && (
            <TvMediaRow
              id="row-movies-top-10"
              isRanked
              items={moviesContent.topTen}
              onSelectItem={onOpenDetails}
              order={2}
              title="Top 10 Movies Today"
            />
          )}

          {moviesContent.rows.map((row, idx) => (
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
