import { Icon } from '../../components/icons/Icon';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus';
import './TvComponents.css';

export type TvProfileAction = 'my-list' | 'settings' | 'account' | 'help' | 'signout';

interface TvProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: TvProfileAction) => void;
}

interface ProfileMenuItem {
  action: TvProfileAction;
  icon: React.ReactNode;
  id: string;
  isDanger?: boolean;
  label: string;
}

const LogoutSvg = () => (
  <svg fill="none" height={18} viewBox="0 0 24 24" width={18}>
    <path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

const PROFILE_MENU_ITEMS: ProfileMenuItem[] = [
  { action: 'my-list', icon: <Icon name="bookmark" size={18} />, id: 'profile-item-my-list', label: 'My List' },
  { action: 'settings', icon: <Icon name="settings" size={18} />, id: 'profile-item-settings', label: 'Settings' },
  { action: 'account', icon: <Icon name="user" size={18} />, id: 'profile-item-account', label: 'Account' },
  { action: 'help', icon: <Icon name="info" size={18} />, id: 'profile-item-help', label: 'Help & Support' },
  { action: 'signout', icon: <LogoutSvg />, id: 'profile-item-signout', isDanger: true, label: 'Sign Out' },
];

export function TvProfileDropdown({
  isOpen,
  onClose,
  onSelectAction,
}: TvProfileDropdownProps) {
  if (!isOpen) return null;

  return (
    <div
      aria-label="Profile and Settings"
      className="tv-v2-profile-dropdown"
      data-testid="profile-dropdown"
      role="menu"
    >
      <div className="tv-v2-profile-dropdown__header">
        <div className="tv-v2-profile-avatar-wrap">
          <img
            alt=""
            aria-hidden="true"
            className="tv-v2-profile-avatar-img"
            src="/profile-avatar.png"
          />
        </div>
        <div className="tv-v2-profile-user-info">
          <span className="tv-v2-profile-name">Daitign</span>
          <span className="tv-v2-profile-badge">TV Premium</span>
        </div>
      </div>

      <div className="tv-v2-profile-dropdown__divider" />

      <div className="tv-v2-profile-dropdown__list">
        {PROFILE_MENU_ITEMS.map((item, index) => {
          const isBeforeSignout = item.action === 'signout';
          return (
            <div key={item.id}>
              {isBeforeSignout && <div className="tv-v2-profile-dropdown__divider" />}
              <TvProfileMenuItemRow
                index={index}
                item={item}
                onClose={onClose}
                onSelect={() => {
                  onSelectAction(item.action);
                  onClose();
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TvProfileMenuItemRow({
  index,
  item,
  onClose,
  onSelect,
}: {
  index: number;
  item: ProfileMenuItem;
  onClose: () => void;
  onSelect: () => void;
}) {
  const rowId = `profile-row-${index}`;
  useTvFocusRow({ id: rowId, order: index });

  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id: item.id,
    onBack: () => {
      onClose();
      return true;
    },
    onSelect,
    rowId,
  });

  return (
    <div
      aria-label={item.label}
      className={`tv-v2-profile-menu-item ${
        isFocused ? 'tv-v2-profile-menu-item--focused' : ''
      } ${item.isDanger ? 'tv-v2-profile-menu-item--danger' : ''}`}
      data-testid={item.id}
      data-tv-focusable="true"
      id={item.id}
      onClick={onSelect}
      role="menuitem"
      tabIndex={0}
    >
      <span aria-hidden="true" className="tv-v2-profile-menu-item__icon">
        {item.icon}
      </span>
      <span className="tv-v2-profile-menu-item__label">{item.label}</span>
    </div>
  );
}
