import { Icon } from '../../components/icons/Icon';
import type { MediaItem } from '../../features/catalog';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import { TvMediaCard } from '../components/TvMediaCard.tsx';
import './TvScreens.css';

interface TvMyListScreenProps {
  items: MediaItem[];
  onExplore: () => void;
  onOpenDetails: (item: MediaItem) => void;
}

const ITEMS_PER_ROW = 5;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function TvMyListScreen({
  items,
  onExplore,
  onOpenDetails,
}: TvMyListScreenProps) {
  if (items.length === 0) {
    return <MyListEmptyState onExplore={onExplore} />;
  }

  const rows = chunkArray(items, ITEMS_PER_ROW);

  return (
    <div className="tv-v2-my-list-screen">
      <div className="tv-v2-my-list-header">
        <h1>My List</h1>
        <span>{items.length} {items.length === 1 ? 'title' : 'titles'} saved</span>
      </div>

      <div className="tv-v2-my-list-content">
        {rows.map((rowItems, rowIdx) => (
          <MyListRow
            items={rowItems}
            key={`my-list-row-${rowIdx}`}
            onSelectItem={onOpenDetails}
            order={rowIdx + 1}
            rowIdx={rowIdx}
            startIndex={rowIdx * ITEMS_PER_ROW}
          />
        ))}
      </div>
    </div>
  );
}

function MyListRow({
  items,
  onSelectItem,
  order,
  rowIdx,
  startIndex,
}: {
  items: MediaItem[];
  onSelectItem: (item: MediaItem) => void;
  order: number;
  rowIdx: number;
  startIndex: number;
}) {
  const rowId = `my-list-row-${rowIdx}`;
  useTvFocusRow({ id: rowId, order });

  return (
    <div className="tv-v2-search-row" data-row-id={rowId}>
      <div className="tv-v2-search-row__grid">
        {items.map((item, colIdx) => {
          const globalIdx = startIndex + colIdx;
          return (
            <TvMediaCard
              colIndex={colIdx}
              customNodeId={`my-list-item-${globalIdx}`}
              item={item}
              key={item.id}
              onSelect={onSelectItem}
              rowId={rowId}
            />
          );
        })}
      </div>
    </div>
  );
}

function MyListEmptyState({ onExplore }: { onExplore: () => void }) {
  useTvFocusRow({ id: 'my-list-empty-row', order: 1 });

  const { isFocused } = useTvFocusNode({
    colIndex: 3,
    id: 'my-list-explore-btn',
    onSelect: onExplore,
    rowId: 'my-list-empty-row',
  });

  return (
    <div className="tv-v2-my-list-empty-screen">
      <div className="tv-v2-my-list-empty-card" data-row-id="my-list-empty-row">
        <Icon name="plus" size={56} />
        <h2>Your list is empty</h2>
        <p>Explore movies and TV shows to add them to your personal watchlist.</p>
        <button
          className={`tv-v2-explore-btn ${isFocused ? 'tv-v2-explore-btn--focused' : ''}`}
          data-testid="my-list-explore-btn"
          data-tv-focusable="true"
          id="my-list-explore-btn"
          onClick={onExplore}
          type="button"
        >
          Explore Titles
        </button>
      </div>
    </div>
  );
}
