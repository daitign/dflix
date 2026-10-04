import type { MediaItem } from '../../features/catalog/types';
import type { MediaDetails } from '../../features/details-modal/types';
import {
  resolveTvDetailsMetadata,
  type RawMediaMetadata,
} from '../details/tvDetailsMetadata';
import './TvComponents.css';

interface TvDetailsMetadataRowProps {
  details?: MediaDetails | null;
  item: MediaItem;
}

function SpatialAudioIcon() {
  return (
    <svg
      aria-hidden="true"
      className="tv-v2-meta-icon tv-v2-meta-icon--spatial"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <circle cx="12" cy="12" fill="currentColor" r="2.5" />
      <path
        d="M7.05 7.05a7 7 0 0 0 0 9.9M16.95 7.05a7 7 0 0 1 0 9.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.22 4.22a11 11 0 0 0 0 15.56M19.78 4.22a11 11 0 0 1 0 15.56"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function TvDetailsMetadataRow({ details, item }: TvDetailsMetadataRowProps) {
  const meta = resolveTvDetailsMetadata(
    item as unknown as RawMediaMetadata,
    details as unknown as RawMediaMetadata | null,
  );

  return (
    <div
      aria-label="Title metadata"
      className="tv-v2-detail__meta-container"
      data-testid="tv-details-meta-container"
      data-tv-focusable="false"
      tabIndex={-1}
    >
      {/* Row 1: Primary Year, Duration, Technical Badges, (Rating if no descriptors) */}
      <div className="tv-v2-detail__meta-row-1" data-testid="meta-row-1">
        {meta.year && (
          <span className="tv-v2-detail__meta-text" data-testid="meta-year">
            {meta.year}
          </span>
        )}

        {meta.durationText && (
          <span className="tv-v2-detail__meta-text" data-testid="meta-duration">
            {meta.durationText}
          </span>
        )}

        {meta.qualityBadge && (
          <span
            className="tv-v2-meta-badge tv-v2-meta-badge--quality"
            data-testid="meta-badge-quality"
          >
            {meta.qualityBadge}
          </span>
        )}

        {meta.audioBadge && (
          <span className="tv-v2-meta-audio" data-testid="meta-badge-audio">
            <SpatialAudioIcon />
            <span className="tv-v2-meta-audio-label">{meta.audioBadge}</span>
          </span>
        )}

        {meta.hasAd && (
          <span
            className="tv-v2-meta-badge tv-v2-meta-badge--ad"
            data-testid="meta-badge-ad"
            title="Audio Description"
          >
            AD
          </span>
        )}

        {meta.hasCc && (
          <span
            className="tv-v2-meta-badge tv-v2-meta-badge--cc"
            data-testid="meta-badge-cc"
            title="Closed Captions"
          >
            CC
          </span>
        )}

        {!meta.hasDescriptors && meta.maturityRating && (
          <span
            className="tv-v2-meta-badge tv-v2-meta-badge--rating"
            data-testid="meta-badge-rating"
          >
            {meta.maturityRating}
          </span>
        )}
      </div>

      {/* Row 2: Content Descriptors (preceded by Rating when present) */}
      {meta.hasDescriptors && (
        <div className="tv-v2-detail__meta-row-2" data-testid="meta-row-descriptors">
          {meta.maturityRating && (
            <span
              className="tv-v2-meta-badge tv-v2-meta-badge--rating"
              data-testid="meta-badge-rating"
            >
              {meta.maturityRating}
            </span>
          )}

          <span
            className="tv-v2-detail__descriptors-text"
            data-testid="meta-descriptors-text"
          >
            {meta.descriptorsText}
          </span>
        </div>
      )}
    </div>
  );
}
