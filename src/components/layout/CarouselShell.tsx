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
import { CarouselControls } from './CarouselControls';
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
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(true);

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
      return;
    }

    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollBack(track.scrollLeft > 4);
    setCanScrollForward(maxScroll > 4 && track.scrollLeft < maxScroll - 4);
  }, [navigationMode]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateControls();
    const observer = new ResizeObserver(updateControls);
    observer.observe(track);
    Array.from(track.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [children, updateControls]);

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

    track.scrollBy({ left: direction * track.clientWidth * 0.82, behavior: 'smooth' });
  };

  return (
    <section aria-label={ariaLabel} className={cx('carousel-shell', className)} role="region">
      <CarouselControls
        canGoNext={canScrollForward}
        canGoPrevious={canScrollBack}
        label={ariaLabel}
        onNext={() => move(1)}
        onPrevious={() => move(-1)}
      />
      <div
        className="carousel-shell__track"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') move(-1);
          if (event.key === 'ArrowRight') move(1);
        }}
        onWheel={(event) => {
          if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          event.currentTarget.scrollBy({ left: event.deltaY, behavior: 'smooth' });
        }}
        onScroll={updateControls}
        ref={trackRef}
        style={{
          '--carousel-item-width': itemWidth,
          '--carousel-mobile-item-width': mobileItemWidth,
        } as CSSProperties}
        tabIndex={0}
      >
        {Children.map(children, (child) => (
          <div className="carousel-shell__item">{child}</div>
        ))}
      </div>
    </section>
  );
}
