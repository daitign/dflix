import { useEffect, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import type { MediaItem } from '../../features/catalog';
import type { MediaDetails } from '../../features/details-modal/types';
import { getMediaDetails, getMediaIdentity } from '../../lib/tmdb';
import { getMediaVideos, selectPreviewVideoCandidates } from '../../lib/tmdb/videos';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import { tvPreviewManager } from '../previews/TvPreviewManager.ts';
import { TvPreviewPlayer } from '../previews/TvPreviewPlayer.tsx';
import './TvScreens.css';

interface TvDetailScreenProps {
  isInList: boolean;
  item: MediaItem;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: { episodeNumber: number; seasonNumber: number }) => void;
  onSelectSimilar: (similarItem: MediaItem) => void;
  onToggleList: (item: MediaItem) => void;
}

export function TvDetailScreen({
  isInList,
  item,
  onClose,
  onPlay,
  onSelectSimilar,
  onToggleList,
}: TvDetailScreenProps) {
  useTvFocusRow({ id: 'detail-actions-row', order: 1 });
  useTvFocusRow({ id: 'detail-episodes-row', order: 2 });
  useTvFocusRow({ id: 'detail-similar-row', order: 3 });

  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);

  // Fetch full TMDB details
  useEffect(() => {
    let active = true;
    const identity = getMediaIdentity(item);
    if (!identity) return;

    getMediaDetails(identity)
      .then((res) => {
        if (active) setDetails(res);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [item]);

  // Fetch trailer
  useEffect(() => {
    let active = true;
    const tmdbId = item.tmdbId ?? (typeof item.id === 'number' ? item.id : null);
    if (!tmdbId) return;

    getMediaVideos(item.type === 'tv' ? 'tv' : 'movie', tmdbId)
      .then((videos) => {
        if (!active) return;
        const candidates = selectPreviewVideoCandidates(videos);
        if (candidates.length > 0 && candidates[0].key) {
          setTrailerKey(candidates[0].key);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [item]);

  // Request preview
  useEffect(() => {
    const previewId = `detail-${item.id}`;
    if (trailerKey) {
      tvPreviewManager.requestPreview(previewId, { delayMs: 800 });
    }

    return () => {
      tvPreviewManager.stop(previewId);
    };
  }, [item.id, trailerKey]);

  const backdropUrl = details?.backdropUrl || item.backdrop?.fallback || item.backdropUrl || '';
  const currentSeasonData = details?.seasons?.find((s) => s.seasonNumber === selectedSeason);

  return (
    <div className="tv-v2-detail-screen">
      {/* Background Player Layer */}
      <TvPreviewPlayer
        backdropUrl={backdropUrl}
        id={`detail-${item.id}`}
        title={item.title}
        videoKey={trailerKey}
      />

      <div className="tv-v2-detail__vignette" />

      {/* Main Content Pane */}
      <div className="tv-v2-detail__scrollable">
        <div className="tv-v2-detail__hero-content">
          <h1 className="tv-v2-detail__title">{details?.title || item.title}</h1>

          <div className="tv-v2-detail__meta">
            {details?.voteAverage && (
              <span className="tv-v2-detail__match">
                {Math.round(details.voteAverage * 10)}% Match
              </span>
            )}
            {details?.year && <span>{details.year}</span>}
            {details?.maturityRating && (
              <span className="tv-v2-detail__rating-badge">{details.maturityRating}</span>
            )}
            {details?.runtime && <span>{Math.floor(details.runtime / 60)}h {details.runtime % 60}m</span>}
            {details?.seasons && details.seasons.length > 0 && (
              <span>{details.seasons.length} Seasons</span>
            )}
            <span className="tv-v2-detail__quality">HD</span>
          </div>

          <p className="tv-v2-detail__overview">{details?.overview || item.overview}</p>

          {/* Action Buttons */}
          <div className="tv-v2-detail__actions">
            <DetailActionButton
              colIndex={0}
              icon={<Icon name="play" size={20} />}
              id="detail-action-play"
              label="Play"
              onBack={onClose}
              onSelect={() => onPlay(item)}
              primary
            />

            <DetailActionButton
              colIndex={1}
              icon={<Icon name={isInList ? 'check' : 'plus'} size={20} />}
              id="detail-action-list"
              label={isInList ? 'In My List' : 'My List'}
              onBack={onClose}
              onSelect={() => onToggleList(item)}
            />

            <DetailActionButton
              colIndex={2}
              icon={<Icon name="close" size={20} />}
              id="detail-action-back"
              label="Close"
              onBack={onClose}
              onSelect={onClose}
            />
          </div>
        </div>

        {/* TV Show Episodes List */}
        {details?.seasons && details.seasons.length > 0 && (
          <div className="tv-v2-detail__episodes-section">
            <div className="tv-v2-detail__section-header">
              <h3>Episodes</h3>
              {details.seasons.length > 1 && (
                <div className="tv-v2-detail__season-tabs">
                  {details.seasons.map((s) => (
                    <button
                      className={`tv-v2-detail__season-btn ${s.seasonNumber === selectedSeason ? 'tv-v2-detail__season-btn--active' : ''}`}
                      key={s.seasonNumber}
                      onClick={() => setSelectedSeason(s.seasonNumber)}
                      type="button"
                    >
                      Season {s.seasonNumber}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="tv-v2-detail__episodes-list">
              {(currentSeasonData?.episodes || []).slice(0, 10).map((ep, idx) => (
                <EpisodeCard
                  colIndex={idx}
                  episode={ep}
                  key={ep.id || idx}
                  onBack={onClose}
                  onSelect={() => onPlay(item, { episodeNumber: ep.episodeNumber, seasonNumber: selectedSeason })}
                  rowId="detail-episodes-row"
                />
              ))}
            </div>
          </div>
        )}

        {/* Similar Titles Carousel */}
        {details?.similar && details.similar.length > 0 && (
          <div className="tv-v2-detail__similar-section">
            <h3>More Like This</h3>
            <div className="tv-v2-detail__similar-list">
              {details.similar.slice(0, 8).map((sim, idx) => (
                <SimilarCard
                  colIndex={idx}
                  item={sim}
                  key={sim.id}
                  onBack={onClose}
                  onSelect={() => onSelectSimilar(sim)}
                  rowId="detail-similar-row"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailActionButton({
  colIndex,
  icon,
  id,
  label,
  onBack,
  onSelect,
  primary = false,
}: {
  colIndex: number;
  icon: React.ReactNode;
  id: string;
  label: string;
  onBack: () => void;
  onSelect: () => void;
  primary?: boolean;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id,
    onBack,
    onSelect,
    rowId: 'detail-actions-row',
  });

  return (
    <div
      className={`tv-v2-detail-btn ${primary ? 'tv-v2-detail-btn--primary' : ''} ${
        isFocused ? 'tv-v2-detail-btn--focused' : ''
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={-1}
    >
      <span className="tv-v2-detail-btn__icon">{icon}</span>
      <span className="tv-v2-detail-btn__label">{label}</span>
    </div>
  );
}

function EpisodeCard({
  colIndex,
  episode,
  onBack,
  onSelect,
  rowId,
}: {
  colIndex: number;
  episode: { episodeNumber: number; overview: string; runtime?: number; title: string };
  onBack: () => void;
  onSelect: () => void;
  rowId: string;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id: `ep-${episode.episodeNumber}`,
    onBack,
    onSelect,
    rowId,
  });

  return (
    <div
      className={`tv-v2-episode-card ${isFocused ? 'tv-v2-episode-card--focused' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={-1}
    >
      <div className="tv-v2-episode-card__num">{episode.episodeNumber}</div>
      <div className="tv-v2-episode-card__info">
        <div className="tv-v2-episode-card__head">
          <h4>{episode.title}</h4>
          {episode.runtime && <span>{episode.runtime}m</span>}
        </div>
        <p className="tv-v2-episode-card__overview">{episode.overview}</p>
      </div>
    </div>
  );
}

function SimilarCard({
  colIndex,
  item,
  onBack,
  onSelect,
  rowId,
}: {
  colIndex: number;
  item: MediaItem;
  onBack: () => void;
  onSelect: () => void;
  rowId: string;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id: `similar-${item.id}`,
    onBack,
    onSelect,
    rowId,
  });

  const poster = item.poster?.fallback || item.posterUrl || item.backdropUrl || '';

  return (
    <div
      className={`tv-v2-similar-card ${isFocused ? 'tv-v2-similar-card--focused' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={-1}
    >
      <img alt={item.title} loading="lazy" src={poster} />
    </div>
  );
}
