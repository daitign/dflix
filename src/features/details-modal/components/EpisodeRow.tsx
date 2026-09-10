import { ResponsiveImage } from '../../../components/primitives/ResponsiveImage';
import type { EpisodeData } from '../types';

interface EpisodeRowProps {
  episode: EpisodeData;
  onPlay: (episode: EpisodeData) => void;
}

export function EpisodeRow({ episode, onPlay }: EpisodeRowProps) {
  return (
    <li className="episode-row">
      <button aria-label={`Play episode ${episode.episodeNumber}: ${episode.title}`} onClick={() => onPlay(episode)} type="button">
        <span aria-hidden="true" className="episode-row__number">{episode.episodeNumber}</span>
        <span className="episode-row__still">
          <ResponsiveImage
            alt=""
            loading="lazy"
            sizes="(max-width: 480px) 8.5rem, 11rem"
            sources={episode.still ? [{ srcSet: episode.still.srcSet, type: 'image/webp' }] : []}
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
            {episode.runtime && <span>{episode.runtime}m</span>}
          </span>
          <span className="episode-row__overview">{episode.overview}</span>
        </span>
      </button>
    </li>
  );
}
