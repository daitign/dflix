import type { SeasonData } from '../types';

interface SeasonSelectorProps {
  onChange: (seasonNumber: number) => void;
  seasons: SeasonData[];
  value: number;
}

export function SeasonSelector({ onChange, seasons, value }: SeasonSelectorProps) {
  return (
    <label className="season-selector">
      <span className="season-selector__label">Choose a season</span>
      <select onChange={(event) => onChange(Number(event.target.value))} value={value}>
        {seasons.map((season) => (
          <option key={season.seasonNumber} value={season.seasonNumber}>
            {season.name} · {season.episodeCount} episodes
          </option>
        ))}
      </select>
    </label>
  );
}
