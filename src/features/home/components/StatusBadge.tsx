import type React from 'react';
import { getFreshnessBadge, type MediaBadge, type MediaItem } from '../../catalog';
import { navigateToWatch } from '../../../lib/navigation/watchRoutes';
import './StatusBadge.css';

export interface FreshnessBadgeProps {
  className?: string;
  isPortrait?: boolean;
  layout?: 'stacked' | 'inline';
  item?: MediaItem;
  status?: MediaBadge;
}

export type StatusBadgeProps = FreshnessBadgeProps;

export function StatusBadge({
  className = '',
  isPortrait = false,
  layout,
  item,
  status,
}: FreshnessBadgeProps) {
  // Defensive guard: resolve badge strictly through getFreshnessBadge when item is present
  const badgeType = item ? getFreshnessBadge(item) : (status && status !== 'top-10' ? status : undefined);
  if (!badgeType) return null;

  const resolvedLayout: 'stacked' | 'inline' = layout ?? (isPortrait ? 'stacked' : 'inline');

  const handleWatchNow = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!item) return;

    const hasEp = item.lastEpisodeNumber !== undefined && item.lastEpisodeNumber > 0;
    const hasSeason = item.lastEpisodeSeasonNumber !== undefined && item.lastEpisodeSeasonNumber > 0;

    const episodeOptions = hasEp && hasSeason
      ? {
          episode: item.lastEpisodeNumber,
          season: item.lastEpisodeSeasonNumber,
          episodeLabel: item.lastEpisodeName ?? `S${item.lastEpisodeSeasonNumber} E${item.lastEpisodeNumber}`,
        }
      : undefined;

    navigateToWatch(item, episodeOptions);
  };

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  // 1. Series / Anime with new episode: [ New Episode ] + [ Watch Now ] CTA
  if (badgeType === 'new-episode') {
    if (resolvedLayout === 'stacked') {
      return (
        <div className={`netflix-badge netflix-badge--stacked ${className}`.trim()}>
          <span className="netflix-badge__segment netflix-badge__segment--red netflix-badge__segment--stacked-top">
            New Episode
          </span>
          <span
            aria-label={`Watch ${item?.title ?? 'episode'} now`}
            className="netflix-badge__segment netflix-badge__segment--white netflix-badge__segment--stacked-bottom netflix-badge__cta"
            onClick={handleWatchNow}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleWatchNow(e);
              }
            }}
            onMouseDown={stopPropagation}
            onPointerDown={stopPropagation}
            role="button"
            tabIndex={0}
          >
            Watch Now
          </span>
        </div>
      );
    }

    // Inline horizontal presentation (normal media cards)
    return (
      <div className={`netflix-badge netflix-badge--inline ${className}`.trim()}>
        <span className="netflix-badge__segment netflix-badge__segment--red netflix-badge__segment--inline-left">
          New Episode
        </span>
        <span
          aria-label={`Watch ${item?.title ?? 'episode'} now`}
          className="netflix-badge__segment netflix-badge__segment--white netflix-badge__segment--inline-right netflix-badge__cta"
          onClick={handleWatchNow}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleWatchNow(e);
            }
          }}
          onMouseDown={stopPropagation}
          onPointerDown={stopPropagation}
          role="button"
          tabIndex={0}
        >
          Watch Now
        </span>
      </div>
    );
  }

  // Single badge styling for other states (New Season, Recently Added, New)
  const portraitClass = resolvedLayout === 'stacked' ? ' netflix-badge--portrait' : '';

  // 2. Series with new season: Solid red badge [ New Season ]
  if (badgeType === 'new-season') {
    return (
      <div className={`netflix-badge netflix-badge--solid-red${portraitClass} ${className}`.trim()}>
        <span className="netflix-badge__text">New Season</span>
      </div>
    );
  }

  // 3. Newly released movie (<= 14 days): Solid red badge [ New ]
  if (badgeType === 'new') {
    return (
      <div className={`netflix-badge netflix-badge--solid-red${portraitClass} ${className}`.trim()}>
        <span className="netflix-badge__text">New</span>
      </div>
    );
  }

  // 4. Recently added movie / TV series (<= 30 days): Solid red badge [ Recently Added ]
  if (badgeType === 'recently-added') {
    return (
      <div className={`netflix-badge netflix-badge--solid-red${portraitClass} ${className}`.trim()}>
        <span className="netflix-badge__text">Recently Added</span>
      </div>
    );
  }

  return null;
}

export const FreshnessBadge = StatusBadge;
export const FreshnessBadgeWithCTA = StatusBadge;


