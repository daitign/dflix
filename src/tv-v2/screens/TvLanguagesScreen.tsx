import { useEffect, useMemo, useState } from 'react';
import type { MediaItem } from '../../features/catalog/types';
import { useTvFocus } from '../focus/TvFocusContext';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus';
import {
  fetchTvLanguageCatalog,
  TV_LANGUAGES,
  TV_PREFERENCE_MODES,
  type TvLanguageOption,
  type TvPreferenceMode,
} from '../catalog/tvLanguagesCatalog';
import { TvMediaCard } from '../components/TvMediaCard';
import { getSearchItemsPerRow } from './tvSearchLayout';
import './TvScreens.css';

interface TvLanguagesScreenProps {
  onOpenDetails: (item: MediaItem) => void;
  onReturnToNav?: () => void;
}

export function TvLanguagesScreen({
  onOpenDetails,
  onReturnToNav,
}: TvLanguagesScreenProps) {
  const { popScope, pushScope, setFocus } = useTvFocus();

  const [selectedMode, setSelectedMode] = useState<TvPreferenceMode>(TV_PREFERENCE_MODES[0]);
  const [selectedLang, setSelectedLang] = useState<TvLanguageOption>(TV_LANGUAGES[0]);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch items whenever language or mode changes
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    fetchTvLanguageCatalog(selectedLang.code, selectedMode.id)
      .then((data) => {
        if (active) {
          setItems(data);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedLang, selectedMode]);

  const itemsPerRow = useMemo(() => getSearchItemsPerRow(), []);
  const rowChunks = useMemo(() => {
    const chunks: MediaItem[][] = [];
    for (let i = 0; i < items.length; i += itemsPerRow) {
      chunks.push(items.slice(i, i + itemsPerRow));
    }
    return chunks;
  }, [items, itemsPerRow]);

  const openModeDropdown = () => {
    setIsLangOpen(false);
    setIsModeOpen(true);
    pushScope('lang-mode-scope', 'lang-mode-opt-0');
  };

  const closeModeDropdown = () => {
    if (isModeOpen) {
      popScope();
      setIsModeOpen(false);
    }
  };

  const openLangDropdown = () => {
    setIsModeOpen(false);
    setIsLangOpen(true);
    pushScope('lang-select-scope', 'lang-select-opt-0');
  };

  const closeLangDropdown = () => {
    if (isLangOpen) {
      popScope();
      setIsLangOpen(false);
    }
  };

  // Preference row (order 1)
  useTvFocusRow({ id: 'lang-pref-row', order: 1 });

  // Mode button
  const { isFocused: isModeFocused } = useTvFocusNode({
    colIndex: 0,
    id: 'lang-mode-btn',
    onBack: () => {
      if (onReturnToNav) {
        onReturnToNav();
        return true;
      }
      return false;
    },
    onDirection: (direction) => {
      if (direction === 'up') {
        if (onReturnToNav) {
          onReturnToNav();
          return true;
        }
      }
      if (direction === 'down') {
        if (items.length > 0) {
          setFocus('lang-result-0');
          return true;
        }
      }
      return false;
    },
    onSelect: () => {
      if (isModeOpen) closeModeDropdown();
      else openModeDropdown();
    },
    rowId: 'lang-pref-row',
  });

  // Language button
  const { isFocused: isLangFocused } = useTvFocusNode({
    colIndex: 1,
    id: 'lang-select-btn',
    onBack: () => {
      if (onReturnToNav) {
        onReturnToNav();
        return true;
      }
      return false;
    },
    onDirection: (direction) => {
      if (direction === 'up') {
        if (onReturnToNav) {
          onReturnToNav();
          return true;
        }
      }
      if (direction === 'down') {
        if (items.length > 0) {
          setFocus('lang-result-0');
          return true;
        }
      }
      return false;
    },
    onSelect: () => {
      if (isLangOpen) closeLangDropdown();
      else openLangDropdown();
    },
    rowId: 'lang-pref-row',
  });

  return (
    <main className="tv-v2-languages-screen" id="main-content">
      {/* Top Header */}
      <div className="tv-v2-languages-header">
        <h1 className="tv-v2-languages-title">Browse by Languages</h1>

        <div className="tv-v2-languages-preferences">
          <span className="tv-v2-languages-pref-label">Select Your Preferences</span>

          <div className="tv-v2-languages-selectors">
            {/* Mode selector */}
            <div className="tv-v2-dropdown-anchor">
              <button
                aria-expanded={isModeOpen}
                aria-haspopup="menu"
                className={`tv-v2-lang-pill-btn ${
                  isModeFocused ? 'tv-v2-lang-pill-btn--focused' : ''
                }`}
                data-testid="lang-mode-btn"
                data-tv-focusable="true"
                id="lang-mode-btn"
                onClick={() => {
                  if (isModeOpen) closeModeDropdown();
                  else openModeDropdown();
                }}
                type="button"
              >
                <span>{selectedMode.label}</span>
                <span className="tv-v2-lang-pill-chevron">{isModeOpen ? '▴' : '▾'}</span>
              </button>

              {isModeOpen && (
                <div
                  aria-label="Mode options"
                  className="tv-v2-lang-floating-menu"
                  data-testid="lang-mode-menu"
                  role="menu"
                >
                  {TV_PREFERENCE_MODES.map((mode, idx) => (
                    <TvModeOptionRow
                      index={idx}
                      isSelected={selectedMode.id === mode.id}
                      key={mode.id}
                      mode={mode}
                      onClose={closeModeDropdown}
                      onSelect={() => {
                        setSelectedMode(mode);
                        closeModeDropdown();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Language selector */}
            <div className="tv-v2-dropdown-anchor">
              <button
                aria-expanded={isLangOpen}
                aria-haspopup="menu"
                className={`tv-v2-lang-pill-btn ${
                  isLangFocused ? 'tv-v2-lang-pill-btn--focused' : ''
                }`}
                data-testid="lang-select-btn"
                data-tv-focusable="true"
                id="lang-select-btn"
                onClick={() => {
                  if (isLangOpen) closeLangDropdown();
                  else openLangDropdown();
                }}
                type="button"
              >
                <span>{selectedLang.name}</span>
                <span className="tv-v2-lang-pill-chevron">{isLangOpen ? '▴' : '▾'}</span>
              </button>

              {isLangOpen && (
                <div
                  aria-label="Language options"
                  className="tv-v2-lang-floating-menu"
                  data-testid="lang-select-menu"
                  role="menu"
                >
                  {TV_LANGUAGES.map((lang, idx) => (
                    <TvLanguageOptionRow
                      index={idx}
                      isSelected={selectedLang.id === lang.id}
                      key={lang.id}
                      lang={lang}
                      onClose={closeLangDropdown}
                      onSelect={() => {
                        setSelectedLang(lang);
                        closeLangDropdown();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Results Grid */}
      <div className="tv-v2-languages-content">
        {isLoading ? (
          <div className="tv-v2-languages-loading">
            <div className="tv-v2-loading-spinner" />
            <span>Loading {selectedLang.name} titles…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="tv-v2-languages-empty">
            <p>No titles found for {selectedLang.name}. Try another language.</p>
          </div>
        ) : (
          <div className="tv-v2-languages-grid" role="grid">
            {rowChunks.map((chunk, rowIndex) => (
              <TvLanguageGridRow
                items={chunk}
                key={`lang-grid-row-${rowIndex}`}
                onOpenDetails={onOpenDetails}
                onReturnToSelectors={() => setFocus('lang-select-btn')}
                rowIndex={rowIndex}
                startIndex={rowIndex * itemsPerRow}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TvModeOptionRow({
  index,
  isSelected,
  mode,
  onClose,
  onSelect,
}: {
  index: number;
  isSelected: boolean;
  mode: TvPreferenceMode;
  onClose: () => void;
  onSelect: () => void;
}) {
  const rowId = `lang-mode-row-${index}`;
  useTvFocusRow({ id: rowId, order: index });

  const nodeId = `lang-mode-opt-${index}`;
  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id: nodeId,
    onBack: () => {
      onClose();
      return true;
    },
    onSelect,
    rowId,
  });

  return (
    <div
      aria-selected={isSelected}
      className={`tv-v2-lang-floating-item ${
        isFocused ? 'tv-v2-lang-floating-item--focused' : ''
      } ${isSelected ? 'tv-v2-lang-floating-item--active' : ''}`}
      data-testid={nodeId}
      data-tv-focusable="true"
      id={nodeId}
      onClick={onSelect}
      role="menuitem"
      tabIndex={0}
    >
      <span>{mode.label}</span>
      {isSelected && <span className="tv-v2-lang-checkmark">✓</span>}
    </div>
  );
}

function TvLanguageOptionRow({
  index,
  isSelected,
  lang,
  onClose,
  onSelect,
}: {
  index: number;
  isSelected: boolean;
  lang: TvLanguageOption;
  onClose: () => void;
  onSelect: () => void;
}) {
  const rowId = `lang-select-row-${index}`;
  useTvFocusRow({ id: rowId, order: index });

  const nodeId = `lang-select-opt-${index}`;
  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id: nodeId,
    onBack: () => {
      onClose();
      return true;
    },
    onSelect,
    rowId,
  });

  return (
    <div
      aria-selected={isSelected}
      className={`tv-v2-lang-floating-item ${
        isFocused ? 'tv-v2-lang-floating-item--focused' : ''
      } ${isSelected ? 'tv-v2-lang-floating-item--active' : ''}`}
      data-testid={nodeId}
      data-tv-focusable="true"
      id={nodeId}
      onClick={onSelect}
      role="menuitem"
      tabIndex={0}
    >
      <span>{lang.name}</span>
      {isSelected && <span className="tv-v2-lang-checkmark">✓</span>}
    </div>
  );
}

function TvLanguageGridRow({
  items,
  onOpenDetails,
  onReturnToSelectors,
  rowIndex,
  startIndex,
}: {
  items: MediaItem[];
  onOpenDetails: (item: MediaItem) => void;
  onReturnToSelectors: () => void;
  rowIndex: number;
  startIndex: number;
}) {
  const rowId = `lang-results-row-${rowIndex}`;
  useTvFocusRow({ id: rowId, order: rowIndex + 10 });

  return (
    <div className="tv-v2-search-row" data-row-id={rowId} role="row">
      <div className="tv-v2-search-row__grid">
        {items.map((item, colIndex) => {
          const itemIndex = startIndex + colIndex;
          const nodeId = `lang-result-${itemIndex}`;

          return (
            <TvMediaCard
              colIndex={colIndex}
              customNodeId={nodeId}
              disablePreview={true}
              item={item}
              key={nodeId}
              onDirection={(direction) => {
                if (rowIndex === 0 && direction === 'up') {
                  onReturnToSelectors();
                  return true;
                }
                return false;
              }}
              onSelect={() => onOpenDetails(item)}
              rowId={rowId}
            />
          );
        })}
      </div>
    </div>
  );
}
