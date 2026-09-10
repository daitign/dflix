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

  return (
    <section aria-label="Title details" className="details-metadata">
      <div className="details-metadata__primary">
        <div aria-label="Title information" className="details-metadata__facts">
          {details.year && <span>{details.year}</span>}
          {details.maturityRating && <span className="details-metadata__rating">{details.maturityRating}</span>}
          {length && <span>{length}</span>}
          <span className="details-metadata__quality">{details.quality}</span>
        </div>
        <p className="details-metadata__synopsis">{details.overview}</p>
      </div>
      <dl className="details-metadata__credits">
        <div>
          <dt>Cast</dt>
          <dd>{details.cast.join(', ')}</dd>
        </div>
        <div>
          <dt>Genres</dt>
          <dd>{details.genres.join(', ')}</dd>
        </div>
        <div>
          <dt>{details.type === 'movie' ? 'Creators' : 'Created by'}</dt>
          <dd>{details.creators.join(', ')}</dd>
        </div>
        <div>
          <dt>This title is</dt>
          <dd>{details.descriptors.join(', ')}</dd>
        </div>
      </dl>
    </section>
  );
}
