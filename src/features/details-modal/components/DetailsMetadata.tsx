import { SpatialAudioBadge } from '../../../components/primitives/SpatialAudioBadge';
import type { MediaDetails } from '../types';

interface DetailsMetadataProps {
  details: MediaDetails;
}

function formatRuntime(minutes?: number) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

export function DetailsMetadata({ details }: DetailsMetadataProps) {
  const seasonCount = details.seasons?.length;
  const length = seasonCount
    ? `${seasonCount} Season${seasonCount === 1 ? '' : 's'}`
    : formatRuntime(details.runtime);
  const matchPercentage = Math.max(
    75,
    Math.min(99, Math.round((details.voteAverage && details.voteAverage > 0 ? details.voteAverage : 8.4) * 10 + 2)),
  );

  return (
    <section aria-label="Title details" className="details-metadata">
      <div className="details-metadata__primary">
        <div aria-label="Title information" className="details-metadata__facts">
          <span className="details-metadata__match">{matchPercentage}% Match</span>
          {details.year && <span>{details.year}</span>}
          {details.maturityRating && <span className="details-metadata__rating">{details.maturityRating}</span>}
          {length && <span>{length}</span>}
          <span className="details-metadata__quality">{details.quality}</span>
          <SpatialAudioBadge />
        </div>
        <p className="details-metadata__synopsis">{details.overview}</p>
      </div>
      <dl className="details-metadata__credits">
        <div>
          <dt>Cast</dt>
          <dd>{details.cast.join(', ') || 'Not available'}</dd>
        </div>
        <div>
          <dt>Genres</dt>
          <dd>{details.genres.join(', ') || 'Not available'}</dd>
        </div>
        <div>
          <dt>{details.type === 'movie' ? 'Creators' : 'Created by'}</dt>
          <dd>{details.creators.join(', ') || 'Not available'}</dd>
        </div>
        <div>
          <dt>This title is</dt>
          <dd>{details.descriptors.join(', ') || 'Not available'}</dd>
        </div>
      </dl>
    </section>
  );
}
