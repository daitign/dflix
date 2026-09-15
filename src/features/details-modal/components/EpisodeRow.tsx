import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { EpisodeData } from '../types';

interface EpisodeRowProps {
  episode: EpisodeData;
  onPlay: (episode: EpisodeData) => void;
}

function formatAirDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function EpisodeRow({ episode, onPlay }: EpisodeRowProps) {
  const airDate = formatAirDate(episode.airDate);
  return (
    <li className="episode-row">
      <button aria-label={`Play episode ${episode.episodeNumber}: ${episode.title}`} data-tv-focusable="true" onClick={() => onPlay(episode)} type="button">
        <span aria-hidden="true" className="episode-row__number">{episode.episodeNumber}</span>
        <span className="episode-row__still">
          <ResponsiveImage
            alt=""
            loading="lazy"
            sizes="(max-width: 480px) 8.5rem, 11rem"
            sources={episode.still ? [{ srcSet: episode.still.srcSet, type: episode.still.type }] : []}
            src={episode.still?.fallback ?? episode.stillUrl ?? ''}
          />
          {episode.progress !== undefined && (
            <span aria-label={`${episode.progress}% watched`} className="episode-row__progress" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={episode.progress}>
              <span style={{ width: `${episode.progress}%` }} />
            </span>
          )}
        </span>
        <span className="episode-row__copy">
          <span className="episode-row__heading">
            <strong>{episode.title}</strong>
            {(airDate || episode.runtime) && <span>{[airDate, episode.runtime ? `${episode.runtime}m` : null].filter(Boolean).join(' · ')}</span>}
          </span>
          <span className="episode-row__overview">{episode.overview}</span>
        </span>
      </button>
    </li>
  );
}
