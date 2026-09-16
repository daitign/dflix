import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../icons/Icon';
import { isTVMode } from '../../lib/tv';
import './CarouselShell.css';

interface CarouselShellProps {
  'aria-label': string;
  children: ReactNode;
  className?: string;
  itemWidth?: string;
  mobileItemWidth?: string;
  navigationMode?: 'item-aligned' | 'page';
}

export function CarouselShell({
  'aria-label': ariaLabel,
  children,
  className,
  itemWidth = 'clamp(14rem, 24vw, 21rem)',
  mobileItemWidth = '47vw',
  navigationMode = 'page',
}: CarouselShellProps) {
  const tvMode = isTVMode();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const updateControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    if (navigationMode === 'item-aligned') {
      const items = Array.from(track.children) as HTMLElement[];
      const lastItem = items.at(-1);
      const paddingRight = Number.parseFloat(getComputedStyle(track).paddingRight) || 0;
      const visibleRight = track.scrollLeft + track.clientWidth - paddingRight;

      setCanScrollBack(track.scrollLeft > 4);
      setCanScrollForward(Boolean(lastItem && lastItem.offsetLeft + lastItem.offsetWidth > visibleRight + 4));

      const pages = Math.max(1, Math.ceil(track.scrollWidth / (track.clientWidth || 1)));
      setPageCount(Math.min(6, pages));
      setCurrentPage(Math.min(pages - 1, Math.round(track.scrollLeft / (track.clientWidth || 1))));
      return;
    }

    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollBack(track.scrollLeft > 4);
    setCanScrollForward(maxScroll > 4 && track.scrollLeft < maxScroll - 4);

    const pages = Math.max(1, Math.ceil(track.scrollWidth / (track.clientWidth || 1)));
    setPageCount(Math.min(6, pages));
    setCurrentPage(Math.min(pages - 1, Math.round(track.scrollLeft / (track.clientWidth || 1))));
  }, [navigationMode]);

  useEffect(() => {
    if (tvMode) return;
    const track = trackRef.current;
    if (!track) return;

    updateControls();
    const observer = new ResizeObserver(updateControls);
    observer.observe(track);
    Array.from(track.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [children, tvMode, updateControls]);

  const move = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    if (navigationMode === 'item-aligned') {
      const items = Array.from(track.children) as HTMLElement[];
      if (items.length < 2) return;

      const styles = getComputedStyle(track);
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const firstOffset = items[0].offsetLeft;
      const step = items[1].offsetLeft - firstOffset;
      if (step <= 0) return;

      const visibleCount = Math.max(1, Math.floor((track.clientWidth - paddingLeft) / step));
      const lastItem = items.at(-1)!;
      const lastRight = lastItem.offsetLeft + lastItem.offsetWidth;
      const endIndex = Math.max(
        0,
        Math.min(items.length - 1, Math.ceil((lastRight - (track.clientWidth - paddingRight)) / step)),
      );
      const currentIndex = Math.max(0, Math.round(track.scrollLeft / step));
      const proposedIndex = currentIndex + direction * visibleCount;
      const targetIndex = direction > 0
        ? (items.length - proposedIndex <= visibleCount + 1 ? endIndex : Math.min(endIndex, proposedIndex))
        : (currentIndex <= visibleCount + 1 ? 0 : Math.max(0, proposedIndex));

      const targetLeft = targetIndex === 0 ? 0 : paddingLeft + targetIndex * step;
      track.scrollTo({ left: targetLeft, behavior: 'smooth' });
      return;
    }

    const styles = getComputedStyle(track);
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const pageWidth = Math.max(100, track.clientWidth - (paddingLeft + paddingRight));
    track.scrollBy({ left: direction * pageWidth, behavior: 'smooth' });
  };

  return (
    <section aria-label={ariaLabel} className={cx('carousel-shell', className)} role="region">
      {/* Netflix Pagination Indicators */}
      {!tvMode && pageCount > 1 && (
        <div aria-hidden="true" className="carousel-shell__pagination">
          {Array.from({ length: pageCount }).map((_, index) => (
            <span
              className={cx(
                'carousel-shell__indicator',
                index === currentPage && 'carousel-shell__indicator--active',
              )}
              key={index}
            />
          ))}
        </div>
      )}

      {/* Netflix Left Paddle Handle */}
      {!tvMode && canScrollBack && (
        <button
          aria-label={`Previous items in ${ariaLabel}`}
          className="carousel-shell__paddle carousel-shell__paddle--left"
          onClick={() => move(-1)}
          type="button"
        >
          <Icon name="chevronLeft" size={32} />
        </button>
      )}

      {/* Track */}
      <div
        className="carousel-shell__track"
        data-tv-row
        data-tv-row-scroll
        onKeyDown={(event) => {
          if (document.documentElement.classList.contains('daitign-tv')) return;
          if (event.key === 'ArrowLeft') move(-1);
          if (event.key === 'ArrowRight') move(1);
        }}
        onWheel={(event) => {
          if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          event.currentTarget.scrollBy({ left: event.deltaY, behavior: 'smooth' });
        }}
        onScroll={tvMode ? undefined : updateControls}
        ref={trackRef}
        style={{
          '--carousel-item-width': itemWidth,
          '--carousel-mobile-item-width': mobileItemWidth,
        } as CSSProperties}
        tabIndex={-1}
      >
        {Children.map(children, (child) => (
          <div className="carousel-shell__item">{child}</div>
        ))}
      </div>

      {/* Netflix Right Paddle Handle */}
      {!tvMode && canScrollForward && (
        <button
          aria-label={`Next items in ${ariaLabel}`}
          className="carousel-shell__paddle carousel-shell__paddle--right"
          onClick={() => move(1)}
          type="button"
        >
          <Icon name="chevronRight" size={32} />
        </button>
      )}
    </section>
  );
}
