import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import type { MediaItem } from '../../features/catalog';
import { searchMulti } from '../../lib/tmdb';
import { useTvFocus } from '../focus/TvFocusContext.tsx';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import { TvMediaCard } from '../components/TvMediaCard.tsx';
import './TvScreens.css';

interface TvSearchScreenProps {
  onClose: () => void;
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

export function TvSearchScreen({
  onClose,
  onOpenDetails,
}: TvSearchScreenProps) {
  const { setFocus } = useTvFocus();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Register the Search Input Row at order 1 (directly below nav-row order 0)
  useTvFocusRow({ id: 'search-input-row', order: 1 });

  const handleInputBack = useCallback(() => {
    onClose();
    setFocus('nav-search');
    return true;
  }, [onClose, setFocus]);

  const { isFocused: isInputFocused } = useTvFocusNode({
    colIndex: 0,
    id: 'search-input',
    onBack: handleInputBack,
    onFocus: () => {
      inputRef.current?.focus();
      if (typeof window !== 'undefined' && window.AndroidTVBridge?.showKeyboard) {
        try {
          window.AndroidTVBridge.showKeyboard();
        } catch {}
      }
    },
    onSelect: () => {
      inputRef.current?.focus();
    },
    rowId: 'search-input-row',
  });

  // Focus search-input immediately when Search screen mounts
  useEffect(() => {
    setFocus('search-input');
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      if (typeof window !== 'undefined' && window.AndroidTVBridge?.showKeyboard) {
        try {
          window.AndroidTVBridge.showKeyboard();
        } catch {}
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [setFocus]);

  // Debounced search query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      searchMulti(trimmed)
        .then((items) => {
          const filtered = items.filter(
            (item) => item && item.title && (item.posterUrl || item.backdropUrl)
          );
          setResults(filtered);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const resultRows = chunkArray(results, ITEMS_PER_ROW);

  return (
    <div className="tv-v2-search-screen">
      <div className="tv-v2-search-header" data-row-id="search-input-row">
        <div
          className={`tv-v2-search-input-box ${
            isInputFocused ? 'tv-v2-search-input-box--focused' : ''
          }`}
          onClick={() => {
            setFocus('search-input');
            inputRef.current?.focus();
          }}
        >
          <Icon name="search" size={24} />
          <input
            autoComplete="off"
            className="tv-v2-search-input"
            data-testid="search-input"
            data-tv-focusable="true"
            id="search-input"
            inputMode="search"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, TV shows, anime..."
            ref={inputRef}
            type="search"
            value={query}
          />
          {query.length > 0 && (
            <button
              className="tv-v2-search-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                setFocus('search-input');
                inputRef.current?.focus();
              }}
              tabIndex={-1}
              type="button"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="tv-v2-search-results">
        {isSearching && (
          <div className="tv-v2-search-status">
            <div className="tv-v2-loading-spinner" />
            <span>Searching titles…</span>
          </div>
        )}

        {!isSearching && query.trim() && results.length === 0 && (
          <div className="tv-v2-search-empty">
            <Icon name="search" size={48} />
            <h3>No titles found for &ldquo;{query}&rdquo;</h3>
            <p>Try searching for a different movie, series, actor, or genre.</p>
          </div>
        )}

        {!isSearching && !query.trim() && (
          <div className="tv-v2-search-prompt">
            <p>Use your remote or soft keyboard to search DAITIGN TV</p>
          </div>
        )}

        {resultRows.map((rowItems, rowIdx) => (
          <SearchRow
            items={rowItems}
            key={`search-row-${rowIdx}`}
            onBackToSearch={() => setFocus('search-input')}
            onSelectItem={onOpenDetails}
            order={rowIdx + 2}
            rowIdx={rowIdx}
            startIndex={rowIdx * ITEMS_PER_ROW}
          />
        ))}
      </div>
    </div>
  );
}

function SearchRow({
  items,
  onBackToSearch,
  onSelectItem,
  order,
  rowIdx,
  startIndex,
}: {
  items: MediaItem[];
  onBackToSearch: () => void;
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
              item={item}
              key={item.id}
              onBack={() => {
                onBackToSearch();
                return true;
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
