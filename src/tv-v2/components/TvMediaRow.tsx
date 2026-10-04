import { useState } from 'react';
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

  // Compute horizontal transform offset to smoothly keep active card in viewport
  // Standard card width is ~180px plus ~24px gap.
  const cardWidth = isRanked ? 260 : 190;
  const gap = 24;
  const offset = Math.max(0, (activeColIndex - 1) * (cardWidth + gap));

  return (
    <section className="tv-v2-row" data-row-id={id}>
      <h3 className="tv-v2-row__title">{title}</h3>

      <div className="tv-v2-row__viewport">
        <div
          className="tv-v2-row__track"
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
