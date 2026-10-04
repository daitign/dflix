import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../../features/catalog';
import { useTvFocusRow } from '../focus/useTvFocus.ts';
import { TvMediaCard } from './TvMediaCard.tsx';
import './TvComponents.css';

interface TvMediaRowProps {
  id: string;
  isRanked?: boolean;
  items: MediaItem[];
  onFocusItem?: (item: MediaItem) => void;
  onSelectItem: (item: MediaItem) => void;
  order: number;
  title: string;
}

export function TvMediaRow({
  id,
  isRanked = false,
  items,
  onFocusItem,
  onSelectItem,
  order,
  title,
}: TvMediaRowProps) {
  useTvFocusRow({ id, order });

  const [activeColIndex, setActiveColIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Compute smooth horizontal track offset keeping expanded card visible inside safe area
  useEffect(() => {
    const updateOffset = () => {
      if (!trackRef.current) return;
      const track = trackRef.current;
      const activeEl = track.children[activeColIndex] as HTMLElement;
      if (!activeEl) return;

      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const safePadding = Math.min(64, Math.max(32, viewportWidth * 0.04));
      const maxVisibleRight = viewportWidth - (safePadding * 2);

      const activeLeft = activeEl.offsetLeft;
      const activeWidth = activeEl.offsetWidth;
      const activeRight = activeLeft + activeWidth;

      setScrollOffset((current) => {
        // Shift left if expanded card extends past right boundary
        if (activeRight - current > maxVisibleRight) {
          return Math.max(0, activeRight - maxVisibleRight);
        }
        // Shift right if active card is clipped on the left
        if (activeLeft < current) {
          return Math.max(0, activeLeft);
        }
        return current;
      });
    };

    updateOffset();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateOffset);
      return () => window.removeEventListener('resize', updateOffset);
    }
  }, [activeColIndex, items.length]);

  return (
    <section className="tv-v2-row" data-row-id={id}>
      <h3 className="tv-v2-row__title">{title}</h3>

      <div className="tv-v2-row__viewport">
        <div
          className="tv-v2-row__track"
          ref={trackRef}
          style={{ transform: `translateX(-${scrollOffset}px)` }}
        >
          {items.map((item, index) => (
            <TvMediaCard
              colIndex={index}
              isRanked={isRanked}
              item={item}
              key={item.id}
              onFocus={(focusedItem) => {
                setActiveColIndex(index);
                onFocusItem?.(focusedItem);
              }}
              onSelect={onSelectItem}
              rank={isRanked ? index + 1 : undefined}
              rowId={id}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
