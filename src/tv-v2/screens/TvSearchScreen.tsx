import { useEffect, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import type { MediaItem } from '../../features/catalog';
import { useTvFocus } from '../focus/TvFocusContext.tsx';
import type { Direction } from '../focus/TvFocusEngine.ts';
import { useTvFocusRow } from '../focus/useTvFocus.ts';
import { TvMediaCard } from '../components/TvMediaCard.tsx';
import { getSearchItemsPerRow } from './tvSearchLayout.ts';
import './TvScreens.css';

export { getSearchItemsPerRow };

export interface TvSearchScreenProps {
  isSearching: boolean;
  onClose: () => void;
  onOpenDetails: (item: MediaItem) => void;
  query: string;
  results: MediaItem[];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function TvSearchScreen({
  isSearching,
  onClose,
  onOpenDetails,
  query,
  results,
}: TvSearchScreenProps) {
  const { setFocus } = useTvFocus();
  const [itemsPerRow, setItemsPerRow] = useState(getSearchItemsPerRow);

  useEffect(() => {
    const handleResize = () => {
      setItemsPerRow(getSearchItemsPerRow());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resultRows = chunkArray(results, itemsPerRow);

  return (
    <div className="tv-v2-search-screen">
      {isSearching && (
        <div className="tv-v2-search-status">
          <div className="tv-v2-loading-spinner" />
          <span>Searching titles…</span>
        </div>
      )}

      {!isSearching && query.trim() && results.length === 0 && (
        <div className="tv-v2-search-empty">
          <Icon name="search" size={48} />
          <h3>No titles found</h3>
          <p>Try another title, person, or genre.</p>
        </div>
      )}

      {!isSearching && !query.trim() && (
        <div className="tv-v2-search-prompt">
          <p>Use your remote or soft keyboard to search DAITIGN TV</p>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="tv-v2-search-heading">
          Search Results {query.trim() && <>for <strong>&ldquo;{query.trim()}&rdquo;</strong></>}
        </div>
      )}

      <div className="tv-v2-search-results">
        {resultRows.map((rowItems, rowIdx) => (
          <SearchRow
            items={rowItems}
            key={`search-row-${rowIdx}`}
            onBack={onClose}
            onReturnToSearch={() => setFocus('nav-search')}
            onSelectItem={onOpenDetails}
            order={rowIdx + 1}
            rowIdx={rowIdx}
            startIndex={rowIdx * itemsPerRow}
          />
        ))}
      </div>
    </div>
  );
}

function SearchRow({
  items,
  onBack,
  onReturnToSearch,
  onSelectItem,
  order,
  rowIdx,
  startIndex,
}: {
  items: MediaItem[];
  onBack: () => void;
  onReturnToSearch: () => void;
  onSelectItem: (item: MediaItem) => void;
  order: number;
  rowIdx: number;
  startIndex: number;
}) {
  const rowId = `search-row-${rowIdx}`;
  useTvFocusRow({ id: rowId, order });

  return (
    <div className="tv-v2-search-row" data-row-id={rowId}>
      <div className="tv-v2-search-row__grid">
        {items.map((item, colIdx) => {
          const globalIdx = startIndex + colIdx;
          return (
            <TvMediaCard
              colIndex={colIdx}
              customNodeId={`search-result-${globalIdx}`}
              disablePreview={true}
              item={item}
              key={item.id}
              onBack={() => {
                onBack();
                return true;
              }}
              onDirection={(direction: Direction) => {
                if (rowIdx === 0 && direction === 'up') {
                  onReturnToSearch();
                  return true;
                }
                return false;
              }}
              onSelect={onSelectItem}
              rowId={rowId}
            />
          );
        })}
      </div>
    </div>
  );
}
