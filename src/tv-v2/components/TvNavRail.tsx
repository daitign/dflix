import { useEffect, useState } from 'react';
import { BrandMark } from '../../components/brand/BrandMark';
import { Icon } from '../../components/icons/Icon';
import { useTvFocus } from '../focus/TvFocusContext.tsx';
import type { Direction } from '../focus/TvFocusEngine.ts';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import {
  TV_V2_MOVIE_GENRES,
  TV_V2_TV_GENRES,
  type TvGenreItem,
} from '../catalog/tvGenreCatalog.ts';
import { TvGenreSubmenu } from './TvGenreSubmenu.tsx';
import './TvComponents.css';

export interface TvNavItem {
  icon?: string;
  id: string;
  label: string;
}

interface TvNavRailProps {
  activeTab: string;
  onSelectMovieGenre?: (genreId: string) => void;
  onSelectTab: (tabId: string) => void;
  onSelectTvGenre?: (genreId: string) => void;
  selectedMovieGenre?: string;
  selectedTvGenre?: string;
}

const NAV_ITEMS: TvNavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'shows', label: 'TV Shows' },
  { id: 'movies', label: 'Movies' },
  { id: 'my-list', label: 'My List' },
  { id: 'search', label: 'Search' },
];

export function TvNavRail({
  activeTab,
  onSelectMovieGenre,
  onSelectTab,
  onSelectTvGenre,
  selectedMovieGenre = 'all',
  selectedTvGenre = 'all',
}: TvNavRailProps) {
  useTvFocusRow({ id: 'nav-row', order: 0 });
  const { popScope, pushScope, setFocus } = useTvFocus();
  const [openSubmenuTab, setOpenSubmenuTab] = useState<'movies' | 'shows' | null>(null);

  // Close submenu if activeTab switches away from movies or shows
  useEffect(() => {
    if (activeTab !== 'movies' && activeTab !== 'shows' && openSubmenuTab) {
      popScope();
      setOpenSubmenuTab(null);
    }
  }, [activeTab, openSubmenuTab, popScope]);

  const openSubmenu = (tab: 'movies' | 'shows') => {
    if (activeTab !== tab) {
      onSelectTab(tab);
    }
    setOpenSubmenuTab(tab);
    const targetId =
      tab === 'movies'
        ? `genre-nav-movies-${selectedMovieGenre || 'all'}`
        : `genre-nav-shows-${selectedTvGenre || 'all'}`;
    pushScope('genre-submenu-scope', targetId);
  };

  const closeSubmenu = () => {
    if (openSubmenuTab) {
      popScope();
      setOpenSubmenuTab(null);
    }
  };

  const exitSubmenuToContent = () => {
    if (openSubmenuTab) {
      popScope();
      setOpenSubmenuTab(null);
      setFocus('hero-play');
    }
  };

  const handleSelectGenreItem = (type: 'movie' | 'tv', genre: TvGenreItem) => {
    if (type === 'movie') {
      onSelectMovieGenre?.(genre.id);
    } else {
      onSelectTvGenre?.(genre.id);
    }
  };

  // Derive dynamic labels
  const movieGenreObj = TV_V2_MOVIE_GENRES.find((g) => g.id === selectedMovieGenre);
  const movieLabel =
    movieGenreObj && movieGenreObj.id !== 'all' ? `Movies · ${movieGenreObj.name}` : 'Movies';

  const tvGenreObj = TV_V2_TV_GENRES.find((g) => g.id === selectedTvGenre);
  const tvLabel =
    tvGenreObj && tvGenreObj.id !== 'all' ? `TV Shows · ${tvGenreObj.name}` : 'TV Shows';

  return (
    <header className="tv-v2-nav-rail">
      <div className="tv-v2-nav-rail__brand">
        <BrandMark compact />
      </div>
      <nav aria-label="Main Navigation" className="tv-v2-nav-rail__links">
        {NAV_ITEMS.map((item, idx) => {
          const hasSubmenu = item.id === 'movies' || item.id === 'shows';
          const isSubmenuOpen = openSubmenuTab === item.id;
          const displayLabel =
            item.id === 'movies' ? movieLabel : item.id === 'shows' ? tvLabel : item.label;

          return (
            <div
              className="tv-v2-nav-btn-wrapper"
              key={item.id}
              style={{ position: 'relative' }}
            >
              <TvNavButton
                activeTab={activeTab}
                colIndex={idx}
                hasSubmenu={hasSubmenu}
                isActive={activeTab === item.id}
                isSubmenuOpen={isSubmenuOpen}
                item={{ ...item, label: displayLabel }}
                onDirection={(direction) => {
                  if (direction === 'down' && hasSubmenu) {
                    openSubmenu(item.id as 'movies' | 'shows');
                    return true;
                  }
                  return false;
                }}
                onSelect={() => {
                  if (hasSubmenu) {
                    if (isSubmenuOpen) {
                      closeSubmenu();
                    } else {
                      openSubmenu(item.id as 'movies' | 'shows');
                    }
                  } else {
                    onSelectTab(item.id);
                  }
                }}
                onSelectTab={onSelectTab}
              />

              {item.id === 'movies' && isSubmenuOpen && (
                <TvGenreSubmenu
                  genres={TV_V2_MOVIE_GENRES}
                  isOpen={true}
                  onClose={closeSubmenu}
                  onExitDownToContent={exitSubmenuToContent}
                  onSelectGenre={(genre) => handleSelectGenreItem('movie', genre)}
                  originatingNavId="nav-movies"
                  selectedGenreId={selectedMovieGenre}
                />
              )}

              {item.id === 'shows' && isSubmenuOpen && (
                <TvGenreSubmenu
                  genres={TV_V2_TV_GENRES}
                  isOpen={true}
                  onClose={closeSubmenu}
                  onExitDownToContent={exitSubmenuToContent}
                  onSelectGenre={(genre) => handleSelectGenreItem('tv', genre)}
                  originatingNavId="nav-shows"
                  selectedGenreId={selectedTvGenre}
                />
              )}
            </div>
          );
        })}
      </nav>
    </header>
  );
}

function TvNavButton({
  activeTab,
  colIndex,
  hasSubmenu,
  isActive,
  isSubmenuOpen,
  item,
  onDirection,
  onSelect,
  onSelectTab,
}: {
  activeTab: string;
  colIndex: number;
  hasSubmenu?: boolean;
  isActive: boolean;
  isSubmenuOpen?: boolean;
  item: TvNavItem;
  onDirection?: (direction: Direction) => boolean | void;
  onSelect: () => void;
  onSelectTab: (tabId: string) => void;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id: `nav-${item.id}`,
    onBack: () => {
      if (activeTab !== 'home') {
        onSelectTab('home');
        return true;
      }
      return false;
    },
    onDirection,
    onSelect,
    rowId: 'nav-row',
  });

  return (
    <div
      aria-current={isActive ? 'page' : undefined}
      aria-expanded={hasSubmenu ? isSubmenuOpen : undefined}
      aria-haspopup={hasSubmenu ? 'menu' : undefined}
      aria-selected={isActive}
      className={`tv-v2-nav-btn ${isFocused ? 'tv-v2-nav-btn--focused' : ''} ${
        isActive ? 'tv-v2-nav-btn--active' : ''
      }`}
      data-testid={`nav-${item.id}`}
      data-tv-focusable="true"
      id={`nav-${item.id}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      {item.id === 'search' && <Icon name="search" size={16} />}
      <span>{item.label}</span>
      {hasSubmenu && (
        <span
          className="tv-v2-nav-btn__caret"
          style={{
            display: 'inline-block',
            fontSize: '0.75em',
            marginLeft: '0.35em',
            opacity: 0.85,
            transform: isSubmenuOpen ? 'translateY(-1px)' : 'translateY(1px)',
            transition: 'transform 120ms ease',
          }}
        >
          {isSubmenuOpen ? '▴' : '▾'}
        </span>
      )}
    </div>
  );
}
