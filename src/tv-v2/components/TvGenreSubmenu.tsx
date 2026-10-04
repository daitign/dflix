import { useMemo } from 'react';
import type { Direction } from '../focus/TvFocusEngine.ts';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import type { TvGenreItem } from '../catalog/tvGenreCatalog.ts';
import './TvGenreSubmenu.css';

interface TvGenreSubmenuProps {
  genres: TvGenreItem[];
  isOpen: boolean;
  onClose: () => void;
  onExitDownToContent?: () => void;
  onSelectGenre: (genre: TvGenreItem) => void;
  originatingNavId: string;
  selectedGenreId: string;
}

export function TvGenreSubmenu({
  genres,
  isOpen,
  onClose,
  onExitDownToContent,
  onSelectGenre,
  originatingNavId,
  selectedGenreId,
}: TvGenreSubmenuProps) {
  // 3-column compact grid
  const COLS = 3;
  const rowChunks = useMemo(() => {
    const chunks: TvGenreItem[][] = [];
    for (let i = 0; i < genres.length; i += COLS) {
      chunks.push(genres.slice(i, i + COLS));
    }
    return chunks;
  }, [genres]);

  if (!isOpen) return null;

  return (
    <div
      aria-label="Genre Selection"
      aria-orientation="vertical"
      className="tv-v2-genre-submenu-container"
      role="menu"
    >
      <div className="tv-v2-genre-submenu">
        {rowChunks.map((rowItems, rowIndex) => (
          <TvGenreSubmenuRow
            isLastRow={rowIndex === rowChunks.length - 1}
            isNextRowMissingCol={(colIdx) => {
              if (rowIndex === rowChunks.length - 1) return true;
              const nextRow = rowChunks[rowIndex + 1];
              return !nextRow || colIdx >= nextRow.length;
            }}
            items={rowItems}
            key={`row-${rowIndex}`}
            onClose={onClose}
            onExitDownToContent={onExitDownToContent}
            onSelectGenre={onSelectGenre}
            originatingNavId={originatingNavId}
            rowIndex={rowIndex}
            selectedGenreId={selectedGenreId}
          />
        ))}
      </div>
    </div>
  );
}

interface TvGenreSubmenuRowProps {
  isLastRow: boolean;
  isNextRowMissingCol: (colIdx: number) => boolean;
  items: TvGenreItem[];
  onClose: () => void;
  onExitDownToContent?: () => void;
  onSelectGenre: (genre: TvGenreItem) => void;
  originatingNavId: string;
  rowIndex: number;
  selectedGenreId: string;
}

function TvGenreSubmenuRow({
  isLastRow,
  isNextRowMissingCol,
  items,
  onClose,
  onExitDownToContent,
  onSelectGenre,
  originatingNavId,
  rowIndex,
  selectedGenreId,
}: TvGenreSubmenuRowProps) {
  const rowId = `genre-submenu-row-${rowIndex}`;
  useTvFocusRow({ id: rowId, order: rowIndex });

  return (
    <div className="tv-v2-genre-row" role="row">
      {items.map((genre, colIndex) => {
        const isBottomForColumn = isLastRow || isNextRowMissingCol(colIndex);
        return (
          <TvGenreSubmenuItem
            colIndex={colIndex}
            genre={genre}
            isBottomForColumn={isBottomForColumn}
            isSelected={genre.id === selectedGenreId}
            isTopRow={rowIndex === 0}
            key={genre.id}
            onClose={onClose}
            onExitDownToContent={onExitDownToContent}
            onSelectGenre={onSelectGenre}
            originatingNavId={originatingNavId}
            rowId={rowId}
          />
        );
      })}
    </div>
  );
}

interface TvGenreSubmenuItemProps {
  colIndex: number;
  genre: TvGenreItem;
  isBottomForColumn: boolean;
  isSelected: boolean;
  isTopRow: boolean;
  onClose: () => void;
  onExitDownToContent?: () => void;
  onSelectGenre: (genre: TvGenreItem) => void;
  originatingNavId: string;
  rowId: string;
}

function TvGenreSubmenuItem({
  colIndex,
  genre,
  isBottomForColumn,
  isSelected,
  isTopRow,
  onClose,
  onExitDownToContent,
  onSelectGenre,
  originatingNavId,
  rowId,
}: TvGenreSubmenuItemProps) {
  const nodeId = `genre-${originatingNavId}-${genre.id}`;

  const { isFocused } = useTvFocusNode({
    colIndex,
    id: nodeId,
    onBack: () => {
      onClose();
      return true;
    },
    onDirection: (direction: Direction) => {
      if (direction === 'up' && isTopRow) {
        onClose();
        return true;
      }
      if (direction === 'down' && isBottomForColumn) {
        if (onExitDownToContent) {
          onExitDownToContent();
          return true;
        }
      }
      return false;
    },
    onSelect: () => {
      onSelectGenre(genre);
    },
    rowId,
  });

  return (
    <div
      aria-checked={isSelected}
      aria-selected={isFocused}
      className={`tv-v2-genre-item ${isFocused ? 'tv-v2-genre-item--focused' : ''} ${
        isSelected ? 'tv-v2-genre-item--selected' : ''
      }`}
      data-testid={nodeId}
      data-tv-focusable="true"
      id={nodeId}
      onClick={() => onSelectGenre(genre)}
      role="menuitemradio"
      tabIndex={0}
    >
      <span className="tv-v2-genre-item__label">{genre.name}</span>
      {isSelected && <span aria-hidden="true" className="tv-v2-genre-item__check">✓</span>}
    </div>
  );
}
