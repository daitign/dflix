import { Icon } from '../../components/icons/Icon';
import type { TvNotificationItem } from '../notifications/tvNotificationCatalog';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus';
import './TvComponents.css';

interface TvNotificationsDropdownProps {
  isOpen: boolean;
  notifications: TvNotificationItem[];
  onClose: () => void;
  onSelectNotification: (notif: TvNotificationItem) => void;
}

export function TvNotificationsDropdown({
  isOpen,
  notifications,
  onClose,
  onSelectNotification,
}: TvNotificationsDropdownProps) {
  if (!isOpen) return null;

  return (
    <div
      aria-label="Notifications"
      className="tv-v2-notifications-dropdown"
      data-testid="notifications-dropdown"
      role="menu"
    >
      <div className="tv-v2-dropdown-header">
        <span className="tv-v2-dropdown-title">Notifications</span>
      </div>

      <div className="tv-v2-notifications-list">
        {notifications.length === 0 ? (
          <TvEmptyNotificationItem onClose={onClose} />
        ) : (
          notifications.map((notif, index) => (
            <TvNotificationItemRow
              index={index}
              key={notif.id}
              notif={notif}
              onClose={onClose}
              onSelect={() => onSelectNotification(notif)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TvNotificationItemRow({
  index,
  notif,
  onClose,
  onSelect,
}: {
  index: number;
  notif: TvNotificationItem;
  onClose: () => void;
  onSelect: () => void;
}) {
  const rowId = `notifications-row-${index}`;
  useTvFocusRow({ id: rowId, order: index });

  const nodeId = `notif-item-${index}`;
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
      aria-label={`${notif.title}: ${notif.message}`}
      className={`tv-v2-notification-card ${
        isFocused ? 'tv-v2-notification-card--focused' : ''
      }`}
      data-testid={nodeId}
      data-tv-focusable="true"
      id={nodeId}
      onClick={onSelect}
      role="menuitem"
      tabIndex={0}
    >
      <div className="tv-v2-notification-card__thumb">
        {notif.thumbnailUrl ? (
          <img
            alt=""
            aria-hidden="true"
            className="tv-v2-notification-card__img"
            src={notif.thumbnailUrl}
          />
        ) : (
          <div className="tv-v2-notification-card__fallback">
            <Icon name="bell" size={20} />
          </div>
        )}
      </div>

      <div className="tv-v2-notification-card__body">
        <div className="tv-v2-notification-card__header">
          <span className="tv-v2-notification-card__title">{notif.title}</span>
          <span className="tv-v2-notification-card__time">{notif.time}</span>
        </div>
        <p className="tv-v2-notification-card__msg">{notif.message}</p>
      </div>
    </div>
  );
}

function TvEmptyNotificationItem({ onClose }: { onClose: () => void }) {
  const rowId = 'notifications-row-0';
  useTvFocusRow({ id: rowId, order: 0 });

  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id: 'notif-empty-item',
    onBack: () => {
      onClose();
      return true;
    },
    onSelect: onClose,
    rowId,
  });

  return (
    <div
      className={`tv-v2-notification-empty ${
        isFocused ? 'tv-v2-notification-empty--focused' : ''
      }`}
      data-testid="notif-empty-item"
      data-tv-focusable="true"
      id="notif-empty-item"
      onClick={onClose}
      role="menuitem"
      tabIndex={0}
    >
      <Icon name="bell" size={24} />
      <span>No new notifications</span>
    </div>
  );
}
