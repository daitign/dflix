import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Container, NavigationShell } from '../components';
import { getTmdbHomeCatalog, type HomeCatalog, type MediaItem } from '../features/catalog';
import { DetailsModalProvider } from '../features/details-modal';
import { BrowseSkeleton, HeroBanner, MediaCard, MediaRow } from '../features/home';
import { HoverPreviewProvider } from '../features/hover-preview';
import { PreviewAudioProvider } from '../features/preview-audio';
import { MyListPage, MyListProvider } from '../features/my-list';
import { ShowsPage } from '../features/shows';
import { MoviesPage } from '../features/movies';
import { GamesPage } from '../features/games';
import { NewPopularPage } from '../features/new-popular';
import { LanguagesPage } from '../features/languages';
import { WatchPage } from '../features/watch';
import { useCurrentRoute } from '../lib/navigation/routes';
import { parseWatchPath, type WatchNavigationState } from '../lib/navigation/watchRoutes';
import { searchMulti } from '../lib/tmdb';
import './App.css';

function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="catalog-error" id="main-content">
      <div>
        <span aria-hidden="true" className="catalog-error__mark">N</span>
        <p className="catalog-error__eyebrow">NETFLIX STREAM</p>
        <h1>Unable to load the catalog.</h1>
        <p>{message}</p>
        <Button onClick={onRetry} variant="primary">Try Again</Button>
      </div>
    </main>
  );
}

function NetflixFooter() {
  return (
    <footer className="netflix-footer">
      <Container className="netflix-footer__inner">
        <p className="netflix-footer__questions">Questions? Call 1-800-012-3456</p>
        <div className="netflix-footer__links">
          <a href="#faq">FAQ</a>
          <a href="#help">Help Center</a>
          <a href="#account">Account</a>
          <a href="#media-center">Media Center</a>
          <a href="#investor-relations">Investor Relations</a>
          <a href="#jobs">Jobs</a>
          <a href="#ways-to-watch">Ways to Watch</a>
          <a href="#terms">Terms of Use</a>
          <a href="#privacy">Privacy</a>
          <a href="#cookie-preferences">Cookie Preferences</a>
          <a href="#corporate-information">Corporate Information</a>
          <a href="#contact-us">Contact Us</a>
          <a href="#speed-test">Speed Test</a>
          <a href="#legal-notices">Legal Notices</a>
          <a href="#only-on-netflix">Only on Netflix</a>
        </div>
        <button className="netflix-footer__service-code" type="button">
          Service Code
        </button>
        <p className="netflix-footer__copyright">© 1997-2026 Netflix, Inc. · DAITIGN Stream</p>
      </Container>
    </footer>
  );
}

function SearchResultsView({
  isSearching,
  query,
  results,
}: {
  isSearching: boolean;
  query: string;
  results: MediaItem[];
}) {
  return (
    <main className="search-results-page" id="main-content">
      <Container>
        <header className="search-results__header">
          <h2>Results for <em>"{query}"</em></h2>
          {isSearching && <span className="search-results__loading-dot" />}
        </header>

        {results.length > 0 ? (
          <div className="search-results__grid">
            {results.map((item) => (
              <MediaCard item={item} key={item.id} />
            ))}
          </div>
        ) : !isSearching ? (
          <div className="search-results__empty">
            <p>Your search for "{query}" did not find any matches.</p>
            <ul>
              <li>Try different keywords</li>
              <li>Looking for a movie or TV show? Try using its title</li>
              <li>Try a genre, like comedy, romance, sports, or drama</li>
            </ul>
          </div>
        ) : null}
      </Container>
    </main>
  );
}

function BrowseExperience() {
  const { activeId } = useCurrentRoute();

  const [catalog, setCatalog] = useState<HomeCatalog | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    if (activeId === 'home' || searchQuery) {
      if (!catalog) {
        setIsLoading(true);
        setError('');
        getTmdbHomeCatalog()
          .then((nextCatalog) => {
            if (active) setCatalog(nextCatalog);
          })
          .catch((reason) => {
            if (!active) return;
            setCatalog(null);
            setError(reason instanceof Error ? reason.message : 'The catalog service is temporarily unavailable.');
          })
          .finally(() => {
            if (active) setIsLoading(false);
          });
      }
    } else {
      setIsLoading(false);
    }
    return () => {
      active = false;
    };
  }, [attempt, activeId, searchQuery, catalog]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(() => {
      searchMulti(trimmed)
        .then((items) => {
          setSearchResults(items);
        })
        .catch(() => {
          if (catalog) {
            const pool = [
              catalog.hero,
              ...catalog.topTen,
              ...catalog.rows.flatMap((r) => r.items),
            ];
            const lower = trimmed.toLowerCase();
            const matched = pool.filter((i) =>
              i.title.toLowerCase().includes(lower)
              || i.genres?.some((g) => g.toLowerCase().includes(lower)),
            );
            setSearchResults(matched);
          }
        })
        .finally(() => setIsSearching(false));
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchQuery, catalog]);

  const hasSearch = Boolean(searchQuery.trim());

  let pageContent: ReactNode;
  if (hasSearch) {
    pageContent = (
      <SearchResultsView
        isSearching={isSearching}
        query={searchQuery}
        results={searchResults}
      />
    );
  } else {
    switch (activeId) {
      case 'shows':
        pageContent = <ShowsPage />;
        break;
      case 'movies':
        pageContent = <MoviesPage />;
        break;
      case 'games':
        pageContent = <GamesPage />;
        break;
      case 'new-popular':
        pageContent = <NewPopularPage />;
        break;
      case 'my-list':
        pageContent = <MyListPage />;
        break;
      case 'languages':
        pageContent = <LanguagesPage />;
        break;
      case 'home':
      default:
        if (isLoading) {
          pageContent = <BrowseSkeleton />;
        } else if (error || !catalog) {
          pageContent = <CatalogError message={error || 'No titles are available right now.'} onRetry={retry} />;
        } else {
          pageContent = <BrowseCatalog catalog={catalog} />;
        }
        break;
    }
  }

  return (
    <MyListProvider>
      <PreviewAudioProvider>
        <DetailsModalProvider>
          <HoverPreviewProvider>
            <NavigationShell onSearchChange={setSearchQuery} searchQuery={searchQuery}>
              {pageContent}
              <NetflixFooter />
            </NavigationShell>
          </HoverPreviewProvider>
        </DetailsModalProvider>
      </PreviewAudioProvider>
    </MyListProvider>
  );
}

function BrowseCatalog({ catalog }: { catalog: HomeCatalog }) {
  const curatedRows = catalog.rows.slice(0, 5);
  const discoveryRows = catalog.rows.slice(5);

  return (
    <main className="browse-page" id="main-content">
      <HeroBanner item={catalog.hero} />

      <div className="browse-catalog">
        <div className="top-ten-feature">
          <MediaRow items={catalog.topTen} mode="ranked" title="Top 10 Today" />
        </div>

        {curatedRows.map((row) => <MediaRow key={row.id} row={row} />)}

        {discoveryRows.length > 0 && (
          <Container>
            <div className="discovery-divider">
              <span>Explore the collection</span>
              <p>Stories for every kind of night.</p>
            </div>
          </Container>
        )}

        {discoveryRows.map((row) => <MediaRow key={row.id} row={row} />)}
      </div>
    </main>
  );
}

function App() {
  const [, setRouteRevision] = useState(0);

  useEffect(() => {
    const syncRoute = () => setRouteRevision((value) => value + 1);
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const watchRoute = parseWatchPath(window.location.pathname);
  if (watchRoute) {
    const state = window.history.state as { daitignWatch?: WatchNavigationState } | null;
    return <WatchPage navigationState={state?.daitignWatch} route={watchRoute} />;
  }

  return <BrowseExperience />;
}

export { App };
