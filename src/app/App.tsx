import { Container, NavigationShell } from '../components';
import { getMockHomeCatalog } from '../features/catalog';
import { HeroBanner, MediaRow } from '../features/home';
import { DetailsModalProvider } from '../features/details-modal';
import { HoverPreviewProvider } from '../features/hover-preview';
import './App.css';

function App() {
  const catalog = getMockHomeCatalog();
  const curatedRows = catalog.rows.slice(0, 6);
  const discoveryRows = catalog.rows.slice(6);

  return (
    <DetailsModalProvider>
      <HoverPreviewProvider>
        <NavigationShell>
          <main className="browse-page" id="main-content">
            <HeroBanner item={catalog.hero} />

            <div className="browse-catalog">
              <div className="top-ten-feature">
                <MediaRow items={catalog.topTen} mode="ranked" title="Top 10 Today" />
              </div>

              {curatedRows.map((row) => (
                <MediaRow
                  key={row.id}
                  mode={row.id === 'continue' ? 'continue' : 'standard'}
                  row={row}
                />
              ))}

              <Container>
                <div className="discovery-divider">
                  <span>Explore the collection</span>
                  <p>Stories for every kind of night.</p>
                </div>
              </Container>

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
              <span className="browse-footer__phase">Cinematic details system · Phase 4</span>
            </Container>
          </footer>
        </NavigationShell>
      </HoverPreviewProvider>
    </DetailsModalProvider>
  );
}

export { App };
