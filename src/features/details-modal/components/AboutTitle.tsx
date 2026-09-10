import type { MediaDetails } from '../types';

interface AboutTitleProps {
  details: MediaDetails;
}

export function AboutTitle({ details }: AboutTitleProps) {
  return (
    <section aria-labelledby="about-title-heading" className="about-title details-section">
      <h3 id="about-title-heading">About {details.title}</h3>
      <dl>
        {details.originalTitle && <div><dt>Original title</dt><dd>{details.originalTitle}</dd></div>}
        <div><dt>Creators</dt><dd>{details.creators.join(', ')}</dd></div>
        <div><dt>Cast</dt><dd>{details.cast.join(', ')}</dd></div>
        <div><dt>Genres</dt><dd>{details.genres.join(', ')}</dd></div>
        <div><dt>Maturity rating</dt><dd>{details.maturityRating ?? 'Not rated'}</dd></div>
      </dl>
    </section>
  );
}
