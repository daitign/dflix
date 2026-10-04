import { useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus';
import './TvComponents.css';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TvSettingsModal({ isOpen, onClose }: BaseModalProps) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [streamQuality, setStreamQuality] = useState('4K Ultra HD');

  if (!isOpen) return null;

  return (
    <div className="tv-v2-modal-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="tv-v2-modal-card">
        <div className="tv-v2-modal-header">
          <div className="tv-v2-modal-title-wrap">
            <Icon name="settings" size={24} />
            <h2>Settings</h2>
          </div>
          <TvModalCloseButton onClose={onClose} scopePrefix="profile-settings" />
        </div>

        <div className="tv-v2-modal-body">
          <TvSettingsRow
            index={1}
            label="Preview Sound"
            onToggle={() => setAudioEnabled((prev) => !prev)}
            scopePrefix="profile-settings"
            value={audioEnabled ? 'Enabled' : 'Muted'}
          />
          <TvSettingsRow
            index={2}
            label="Playback Quality"
            onToggle={() =>
              setStreamQuality((prev) =>
                prev === '4K Ultra HD' ? '1080p Full HD' : '4K Ultra HD'
              )
            }
            scopePrefix="profile-settings"
            value={streamQuality}
          />
          <TvSettingsRow
            index={3}
            label="TV Navigation Sounds"
            onToggle={() => {}}
            scopePrefix="profile-settings"
            value="Default"
          />
        </div>
      </div>
    </div>
  );
}

function TvSettingsRow({
  index,
  label,
  onToggle,
  scopePrefix,
  value,
}: {
  index: number;
  label: string;
  onToggle: () => void;
  scopePrefix: string;
  value: string;
}) {
  const rowId = `${scopePrefix}-row-${index}`;
  useTvFocusRow({ id: rowId, order: index });

  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id: `${scopePrefix}-item-${index}`,
    onBack: () => false,
    onSelect: onToggle,
    rowId,
  });

  return (
    <div
      className={`tv-v2-modal-setting-row ${
        isFocused ? 'tv-v2-modal-setting-row--focused' : ''
      }`}
      data-testid={`${scopePrefix}-item-${index}`}
      data-tv-focusable="true"
      id={`${scopePrefix}-item-${index}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
    >
      <span className="tv-v2-modal-setting-label">{label}</span>
      <span className="tv-v2-modal-setting-value">{value} ▾</span>
    </div>
  );
}

export function TvAccountModal({ isOpen, onClose }: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="tv-v2-modal-backdrop" role="dialog" aria-modal="true" aria-label="Account">
      <div className="tv-v2-modal-card">
        <div className="tv-v2-modal-header">
          <div className="tv-v2-modal-title-wrap">
            <Icon name="user" size={24} />
            <h2>Account Details</h2>
          </div>
          <TvModalCloseButton onClose={onClose} scopePrefix="profile-account" />
        </div>

        <div className="tv-v2-modal-body">
          <div className="tv-v2-modal-info-block">
            <span className="tv-v2-modal-info-label">Membership Tier</span>
            <span className="tv-v2-modal-info-val">DAITIGN TV Premium 4K</span>
          </div>
          <div className="tv-v2-modal-info-block">
            <span className="tv-v2-modal-info-label">Profile</span>
            <span className="tv-v2-modal-info-val">Primary User (Daitign)</span>
          </div>
          <div className="tv-v2-modal-info-block">
            <span className="tv-v2-modal-info-label">Video Playback Engine</span>
            <span className="tv-v2-modal-info-val">VidStuck Cinema Player + Android TV Native</span>
          </div>
          <div className="tv-v2-modal-info-block">
            <span className="tv-v2-modal-info-label">Connected Device</span>
            <span className="tv-v2-modal-info-val">Android TV / 4K Ultra HD</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TvHelpModal({ isOpen, onClose }: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="tv-v2-modal-backdrop" role="dialog" aria-modal="true" aria-label="Help and Support">
      <div className="tv-v2-modal-card">
        <div className="tv-v2-modal-header">
          <div className="tv-v2-modal-title-wrap">
            <Icon name="info" size={24} />
            <h2>TV Remote Shortcuts & Help</h2>
          </div>
          <TvModalCloseButton onClose={onClose} scopePrefix="profile-help" />
        </div>

        <div className="tv-v2-modal-body">
          <div className="tv-v2-modal-shortcut-row">
            <span className="tv-v2-modal-shortcut-key">D-Pad Arrows</span>
            <span className="tv-v2-modal-shortcut-desc">Navigate media rows, categories, and controls</span>
          </div>
          <div className="tv-v2-modal-shortcut-row">
            <span className="tv-v2-modal-shortcut-key">OK / Enter</span>
            <span className="tv-v2-modal-shortcut-desc">Open details modal or start instant playback</span>
          </div>
          <div className="tv-v2-modal-shortcut-row">
            <span className="tv-v2-modal-shortcut-key">Back Button</span>
            <span className="tv-v2-modal-shortcut-desc">Close popups, modals, or return to previous tab</span>
          </div>
          <div className="tv-v2-modal-shortcut-row">
            <span className="tv-v2-modal-shortcut-key">Player Controls</span>
            <span className="tv-v2-modal-shortcut-desc">Arrow keys reveal player controls; auto-hides after 5s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TvSignOutModal({
  isOpen,
  onClose,
  onConfirmSignOut,
}: BaseModalProps & { onConfirmSignOut: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="tv-v2-modal-backdrop" role="dialog" aria-modal="true" aria-label="Sign Out">
      <div className="tv-v2-modal-card tv-v2-modal-card--compact">
        <div className="tv-v2-modal-header">
          <div className="tv-v2-modal-title-wrap">
            <svg fill="none" height={24} viewBox="0 0 24 24" width={24}>
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            <h2>Sign Out of DAITIGN</h2>
          </div>
        </div>

        <div className="tv-v2-modal-body">
          <p className="tv-v2-modal-signout-msg">
            Are you sure you want to sign out? Your saved Watchlist and playback progress are stored locally on this device.
          </p>

          <div className="tv-v2-modal-actions-row">
            <TvSignOutButton
              colIndex={0}
              isPrimary
              label="Cancel"
              onClick={onClose}
            />
            <TvSignOutButton
              colIndex={1}
              isDanger
              label="Sign Out"
              onClick={() => {
                onConfirmSignOut();
                onClose();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TvModalCloseButton({
  onClose,
  scopePrefix,
}: {
  onClose: () => void;
  scopePrefix: string;
}) {
  const rowId = `${scopePrefix}-row-0`;
  useTvFocusRow({ id: rowId, order: 0 });

  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id: `${scopePrefix}-close-btn`,
    onBack: () => {
      onClose();
      return true;
    },
    onSelect: onClose,
    rowId,
  });

  return (
    <button
      aria-label="Close modal"
      className={`tv-v2-modal-close-btn ${
        isFocused ? 'tv-v2-modal-close-btn--focused' : ''
      }`}
      data-testid={`${scopePrefix}-close-btn`}
      data-tv-focusable="true"
      id={`${scopePrefix}-close-btn`}
      onClick={onClose}
      type="button"
    >
      <Icon name="close" size={20} />
    </button>
  );
}

function TvSignOutButton({
  colIndex,
  isDanger,
  isPrimary,
  label,
  onClick,
}: {
  colIndex: number;
  isDanger?: boolean;
  isPrimary?: boolean;
  label: string;
  onClick: () => void;
}) {
  const rowId = 'profile-signout-row-0';
  useTvFocusRow({ id: rowId, order: 0 });

  const nodeId = `profile-signout-btn-${colIndex}`;
  const { isFocused } = useTvFocusNode({
    colIndex,
    id: nodeId,
    onBack: () => false,
    onSelect: onClick,
    rowId,
  });

  return (
    <button
      className={`tv-v2-modal-action-btn ${
        isFocused ? 'tv-v2-modal-action-btn--focused' : ''
      } ${isPrimary ? 'tv-v2-modal-action-btn--primary' : ''} ${
        isDanger ? 'tv-v2-modal-action-btn--danger' : ''
      }`}
      data-testid={nodeId}
      data-tv-focusable="true"
      id={nodeId}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
