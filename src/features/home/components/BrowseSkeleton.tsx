import { Container } from '../../../components/layout/Container';
import { Skeleton } from '../../../components/primitives/Skeleton';
import './BrowseSkeleton.css';

const SKELETON_ROWS = [
  { id: 'row-0', isRanked: true, titleWidth: '11rem' },
  { id: 'row-1', isRanked: false, titleWidth: '14rem' },
  { id: 'row-2', isRanked: false, titleWidth: '12rem' },
  { id: 'row-3', isRanked: false, titleWidth: '15rem' },
];

const CARDS_PER_ROW = [0, 1, 2, 3, 4, 5];

export function BrowseSkeleton() {
  return (
    <main aria-label="Loading DAITIGN catalog" className="browse-loading" role="status">
      {/* Cinematic Hero Billboard Skeleton */}
      <div className="browse-loading__hero">
        <Container className="browse-loading__hero-container">
          <div className="browse-loading__hero-copy">
            <Skeleton className="browse-loading__hero-badge" height="1.25rem" radius="sm" width="6.5rem" />
            <Skeleton className="browse-loading__hero-title" height="3.75rem" radius="md" width="min(80vw, 24rem)" />
            <Skeleton className="browse-loading__hero-ribbon" height="1.15rem" radius="sm" width="11rem" />
            <div className="browse-loading__hero-overview">
              <Skeleton height="0.95rem" radius="sm" width="min(90vw, 36rem)" />
              <Skeleton height="0.95rem" radius="sm" width="min(75vw, 28rem)" />
            </div>
            <div className="browse-loading__hero-actions">
              <Skeleton className="browse-loading__hero-btn" height="2.65rem" radius="md" width="7.5rem" />
              <Skeleton className="browse-loading__hero-btn" height="2.65rem" radius="md" width="8.5rem" />
            </div>
          </div>
        </Container>
      </div>

      {/* Edge-to-Edge Full-Screen Rows */}
      <div className="browse-loading__catalog">
        {SKELETON_ROWS.map((row) => (
          <section className="browse-loading__row" key={row.id}>
            <Container>
              <Skeleton className="browse-loading__title" height="1.4rem" radius="sm" width={row.titleWidth} />
              <div
                className={`browse-loading__track ${
                  row.isRanked ? 'browse-loading__track--ranked' : ''
                }`}
              >
                {CARDS_PER_ROW.map((cardIndex) => (
                  <Skeleton
                    className={
                      row.isRanked
                        ? 'browse-loading__card browse-loading__card--ranked'
                        : 'browse-loading__card'
                    }
                    key={cardIndex}
                    radius="lg"
                  />
                ))}
              </div>
            </Container>
          </section>
        ))}
      </div>
    </main>
  );
}
