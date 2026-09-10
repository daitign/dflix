import type { EpisodeData, SeasonData } from '../types';
import { EpisodeRow } from './EpisodeRow';

interface EpisodeListProps {
  onPlayEpisode: (episode: EpisodeData) => void;
  season: SeasonData & { episodes: EpisodeData[] };
}

export function EpisodeList({ onPlayEpisode, season }: EpisodeListProps) {
  return (
    <ol aria-label={`Episodes in ${season.name}`} className="episode-list" key={season.seasonNumber}>
      {season.episodes.map((episode) => (
        <EpisodeRow episode={episode} key={episode.id} onPlay={onPlayEpisode} />
      ))}
    </ol>
  );
}
