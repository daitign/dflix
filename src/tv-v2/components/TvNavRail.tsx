import { BrandMark } from '../../components/brand/BrandMark';
import { Icon } from '../../components/icons/Icon';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import './TvComponents.css';

export interface TvNavItem {
  icon?: string;
  id: string;
  label: string;
}

interface TvNavRailProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

const NAV_ITEMS: TvNavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'shows', label: 'TV Shows' },
  { id: 'movies', label: 'Movies' },
  { id: 'my-list', label: 'My List' },
  { id: 'search', label: 'Search' },
];

export function TvNavRail({ activeTab, onSelectTab }: TvNavRailProps) {
  useTvFocusRow({ id: 'nav-row', order: 0 });

  return (
    <header className="tv-v2-nav-rail">
      <div className="tv-v2-nav-rail__brand">
        <BrandMark compact />
      </div>
      <nav aria-label="Main Navigation" className="tv-v2-nav-rail__links">
        {NAV_ITEMS.map((item, idx) => (
          <TvNavButton
            activeTab={activeTab}
            colIndex={idx}
            isActive={activeTab === item.id}
            item={item}
            key={item.id}
            onSelect={() => onSelectTab(item.id)}
            onSelectTab={onSelectTab}
          />
        ))}
      </nav>
    </header>
  );
}

function TvNavButton({
  activeTab,
  colIndex,
  isActive,
  item,
  onSelect,
  onSelectTab,
}: {
  activeTab: string;
  colIndex: number;
  isActive: boolean;
  item: TvNavItem;
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
    onSelect,
    rowId: 'nav-row',
  });

  return (
    <div
      aria-current={isActive ? 'page' : undefined}
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
    </div>
  );
}
