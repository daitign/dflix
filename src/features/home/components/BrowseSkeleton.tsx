import { Container } from '../../../components/layout/Container';
import { Skeleton } from '../../../components/primitives/Skeleton';
import './BrowseSkeleton.css';

export function BrowseSkeleton() {
  return (
    <main aria-label="Loading DAITIGN catalog" className="browse-loading" role="status">
      <Skeleton className="browse-loading__hero" radius="lg" />
      <Container className="browse-loading__catalog">
        {[0, 1, 2, 3].map((row) => (
          <section className="browse-loading__row" key={row}>
            <Skeleton height="1.5rem" width={row === 0 ? '10rem' : '13rem'} />
            <div>
              {[0, 1, 2, 3, 4].map((card) => (
                <Skeleton className={row === 0 ? 'browse-loading__ranked' : 'browse-loading__card'} key={card} radius="lg" />
              ))}
            </div>
          </section>
        ))}
      </Container>
    </main>
  );
}
