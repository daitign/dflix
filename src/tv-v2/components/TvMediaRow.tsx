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
  const [cardStride, setCardStride] = useState(isRanked ? 260 : 200);

  // Compute dynamic stride from rendered cards so smooth horizontal track scrolling perfectly matches CSS clamp sizing
  useEffect(() => {
    if (trackRef.current && trackRef.current.children.length > 1) {
      const first = trackRef.current.children[0] as HTMLElement;
      const second = trackRef.current.children[1] as HTMLElement;
      if (first && second) {
        const stride = second.offsetLeft - first.offsetLeft;
        if (stride > 0) setCardStride(stride);
      }
    }
  }, [items.length, isRanked]);

  const offset = Math.max(0, (activeColIndex - 1) * cardStride);

  return (
    <section className="tv-v2-row" data-row-id={id}>
      <h3 className="tv-v2-row__title">{title}</h3>

      <div className="tv-v2-row__viewport">
        <div
          className="tv-v2-row__track"
          ref={trackRef}
          style={{ transform: `translateX(-${offset}px)` }}
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
