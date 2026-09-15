import type { SeasonData } from '../types';
import { Icon } from '../../../components/icons/Icon';

interface SeasonSelectorProps {
  onChange: (seasonNumber: number) => void;
  seasons: SeasonData[];
  value: number;
}

export function SeasonSelector({ onChange, seasons, value }: SeasonSelectorProps) {
  return (
    <label className="season-selector">
      <span className="season-selector__label">Choose a season</span>
      <div className="season-selector__wrap">
        <select data-tv-focusable="true" onChange={(event) => onChange(Number(event.target.value))} value={value}>
          {seasons.map((season) => (
            <option key={season.seasonNumber} value={season.seasonNumber}>
              {season.name} · {season.episodeCount} episodes
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="season-selector__chevron">
          <Icon name="chevronDown" size={16} />
        </span>
      </div>
    </label>
  );
}
