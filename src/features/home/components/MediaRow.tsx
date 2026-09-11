import { CarouselShell } from '../../../components/layout/CarouselShell';
import { Container } from '../../../components/layout/Container';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import type { MediaItem, MediaRowModel } from '../../catalog';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { MediaCard } from './MediaCard';
import { RankedMediaCard } from './RankedMediaCard';
import './MediaRow.css';

interface MediaRowProps {
  items?: MediaItem[];
  mode?: 'standard' | 'ranked' | 'continue';
  row?: MediaRowModel;
  title?: string;
}

export function MediaRow({ items, mode = 'standard', row, title }: MediaRowProps) {
  const resolvedItems = items ?? row?.items ?? [];
  const resolvedTitle = title ?? row?.title ?? '';
  const isRanked = mode === 'ranked';
  const isContinue = mode === 'continue';

  if (resolvedItems.length === 0) return null;

  return (
    <section
      className={`media-row media-row--${row?.emphasis ?? (isRanked ? 'featured' : 'standard')}${isRanked ? ' media-row--ranked' : ''}`}
      id={row?.id}
    >
      <Container>
        <SectionHeader title={resolvedTitle} />
        <CarouselShell
          aria-label={resolvedTitle}
          className={isRanked ? 'carousel-shell--ranked' : undefined}
          itemWidth={
            isRanked
              ? 'max-content'
              : 'calc((100% - ((var(--items-per-page, 6) - 1) * var(--carousel-gap, 4px))) / var(--items-per-page, 6))'
          }
          mobileItemWidth={
            isRanked
              ? 'max-content'
              : 'calc((100% - ((var(--items-per-page, 6) - 1) * var(--carousel-gap, 4px))) / var(--items-per-page, 6))'
          }
          navigationMode="page"
        >
          {resolvedItems.map((item, index) => {
            if (isRanked) return <RankedMediaCard item={item} key={item.id} rank={index + 1} />;
            if (isContinue) return <ContinueWatchingCard item={item} key={item.id} />;
            return <MediaCard item={item} key={item.id} />;
          })}
        </CarouselShell>
      </Container>
    </section>
  );
}
