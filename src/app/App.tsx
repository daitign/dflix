import { useCallback, useEffect, useState } from 'react';
import { Button, Container, NavigationShell } from '../components';
import { getTmdbHomeCatalog, type HomeCatalog } from '../features/catalog';
import { DetailsModalProvider } from '../features/details-modal';
import { BrowseSkeleton, HeroBanner, MediaRow } from '../features/home';
import { HoverPreviewProvider } from '../features/hover-preview';
import { WatchPage } from '../features/watch';
import { parseWatchPath, type WatchNavigationState } from '../lib/navigation/watchRoutes';
import './App.css';

function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="catalog-error" id="main-content">
      <div>
        <span aria-hidden="true" className="catalog-error__mark">D</span>
        <p className="catalog-error__eyebrow">DAITIGN CATALOG</p>
        <h1>The screening room is between reels.</h1>
        <p>{message}</p>
        <Button onClick={onRetry} variant="secondary">Try the catalog again</Button>
      </div>
    </main>
  );
}

function BrowseExperience() {
  const [catalog, setCatalog] = useState<HomeCatalog | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
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
    return () => { active = false; };
  }, [attempt]);

  const content = isLoading
    ? <BrowseSkeleton />
    : error || !catalog
      ? <CatalogError message={error || 'No titles are available right now.'} onRetry={retry} />
      : <BrowseCatalog catalog={catalog} />;

  return (
    <DetailsModalProvider>
      <HoverPreviewProvider>
        <NavigationShell>{content}</NavigationShell>
      </HoverPreviewProvider>
    </DetailsModalProvider>
  );
}

function BrowseCatalog({ catalog }: { catalog: HomeCatalog }) {
  const curatedRows = catalog.rows.slice(0, 5);
  const discoveryRows = catalog.rows.slice(5);

  return (
    <>
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
          <div aria-hidden="true" id="my-list" />
        </div>
      </main>

      <footer className="browse-footer">
        <Container className="browse-footer__inner">
          <div>
            <strong>DAITIGN Stream</strong>
            <span>Curated cinema, quietly delivered.</span>
          </div>
          <span className="browse-footer__phase">Real catalog and playback · Phase 5</span>
        </Container>
      </footer>
    </>
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
