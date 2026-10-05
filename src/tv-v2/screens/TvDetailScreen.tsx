import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons/Icon';
import type { MediaItem } from '../../features/catalog';
import type { EpisodeData, MediaDetails, SeasonData } from '../../features/details-modal/types';
import { getMediaDetails, getMediaIdentity, getMediaSeason } from '../../lib/tmdb';
import { getMediaVideos, selectPreviewVideoCandidates } from '../../lib/tmdb/videos';
import { useTvFocus } from '../focus/TvFocusContext.tsx';
import type { Direction } from '../focus/TvFocusEngine.ts';
import { useTvFocusNode, useTvFocusRow } from '../focus/useTvFocus.ts';
import { tvPreviewManager } from '../previews/TvPreviewManager.ts';
import { TvPreviewPlayer } from '../previews/TvPreviewPlayer.tsx';
import { TvDetailsMetadataRow } from '../components/TvDetailsMetadataRow';
import './TvScreens.css';

interface TvDetailScreenProps {
  isInList: boolean;
  item: MediaItem;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: { episodeNumber: number; seasonNumber: number }) => void;
  onSelectSimilar: (similarItem: MediaItem) => void;
  onToggleList: (item: MediaItem) => void;
}

function formatRuntime(minutes?: number): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function TvDetailScreen({
  isInList,
  item,
  onClose,
  onPlay,
  onSelectSimilar,
  onToggleList,
}: TvDetailScreenProps) {
  const { popScope, pushScope, setFocus } = useTvFocus();

  // Modal focus graph rows
  useTvFocusRow({ id: 'detail-header-row', order: 0 });
  useTvFocusRow({ id: 'detail-actions-row', order: 1 });
  useTvFocusRow({ id: 'detail-seasons-row', order: 2 });
  useTvFocusRow({ id: 'detail-episodes-row', order: 3 });
  useTvFocusRow({ id: 'detail-similar-row', order: 4 });

  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [isSeasonMenuOpen, setIsSeasonMenuOpen] = useState(false);
  const [loadedEpisodes, setLoadedEpisodes] = useState<EpisodeData[]>([]);
  const [isMuted, setIsMuted] = useState(() => tvPreviewManager.getIsMuted());

  const seasonEpisodesCache = useRef<Map<string, EpisodeData[]>>(new Map());
  const scrollableRef = useRef<HTMLDivElement>(null);
  const previewId = `detail-${item.id}`;
  const [isDetailPreviewActive, setIsDetailPreviewActive] = useState(() =>
    tvPreviewManager.isPreviewActive(previewId)
  );

  // Focus Play button as soon as modal mounts or item changes, scroll to top
  useEffect(() => {
    setFocus('detail-action-play');
    if (scrollableRef.current) {
      scrollableRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [setFocus, item.id]);

  // Lock background body scroll while detail modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Subscribe to preview manager active and mute changes
  useEffect(() => {
    const unsubscribe = tvPreviewManager.subscribe((activeId, muted) => {
      setIsDetailPreviewActive(activeId === previewId);
      setIsMuted(muted);
    });

    return () => {
      unsubscribe();
    };
  }, [previewId]);

  // Fetch full TMDB details
  useEffect(() => {
    let active = true;
    const identity = getMediaIdentity(item);
    if (!identity) return;

    getMediaDetails(identity)
      .then((res) => {
        if (active) {
          setDetails(res);
          if (res.playbackType === 'tv' && res.seasons && res.seasons.length > 0) {
            setSelectedSeason(res.seasons[0].seasonNumber);
          }
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [item]);

  // Fetch trailer video candidate
  useEffect(() => {
    let active = true;
    const tmdbId =
      item.tmdbId ??
      (typeof item.id === 'number'
        ? item.id
        : Number.parseInt(String(item.id).replace(/^[a-z]+-/, ''), 10) || null);
    if (!tmdbId) return;

    const playbackType =
      item.playbackType || (item.type === 'tv' || item.type === 'anime' ? 'tv' : 'movie');
    getMediaVideos(playbackType, tmdbId)
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

  // Request preview when trailer is ready; stop cleanly on unmount
  useEffect(() => {
    if (trailerKey) {
      tvPreviewManager.requestPreview(previewId, { delayMs: 400 });
    }

    return () => {
      tvPreviewManager.stop(previewId);
    };
  }, [previewId, trailerKey]);

  // Fetch episodes for selected TV season
  useEffect(() => {
    const isTv =
      details?.playbackType === 'tv' || item.type === 'tv' || item.type === 'anime';
    if (!isTv || !details?.tmdbId) return;

    const cacheKey = `${details.tmdbId}:${selectedSeason}`;
    const cached = seasonEpisodesCache.current.get(cacheKey);
    if (cached) {
      setLoadedEpisodes(cached);
      return;
    }

    let active = true;
    getMediaSeason(details.tmdbId, selectedSeason)
      .then((seasonData) => {
        if (!active) return;
        const eps = seasonData.episodes || [];
        seasonEpisodesCache.current.set(cacheKey, eps);
        setLoadedEpisodes(eps);
      })
      .catch(() => {
        const fallbackEps =
          details.seasons?.find((s) => s.seasonNumber === selectedSeason)?.episodes || [];
        if (active) setLoadedEpisodes(fallbackEps);
      });

    return () => {
      active = false;
    };
  }, [details?.tmdbId, details?.playbackType, details?.seasons, item.type, selectedSeason]);

  const openSeasonMenu = () => {
    setIsSeasonMenuOpen(true);
    pushScope('detail-season-scope', `detail-season-opt-${selectedSeason}`);
  };

  const closeSeasonMenu = () => {
    if (isSeasonMenuOpen) {
      popScope();
      setIsSeasonMenuOpen(false);
    }
  };

  const isMovie =
    details?.playbackType === 'movie' ||
    (details === null && item.type !== 'tv' && item.type !== 'anime');

  const backdropUrl =
    details?.backdropUrl || item.backdrop?.fallback || item.backdropUrl || '';

  // Right column info
  const castString =
    details?.cast && details.cast.length > 0
      ? details.cast.slice(0, 4).join(', ') + (details.cast.length > 4 ? ', more' : '')
      : undefined;
  const genresString =
    details?.genres && details.genres.length > 0
      ? details.genres.slice(0, 4).join(', ')
      : undefined;
  const thisShowIsString =
    details?.descriptors && details.descriptors.length > 0
      ? details.descriptors.slice(0, 3).join(', ')
      : undefined;

  // Seasons and episodes
  const hasSeasons = !isMovie && Boolean(details?.seasons && details.seasons.length > 0);
  const currentSeasonName =
    details?.seasons?.find((s) => s.seasonNumber === selectedSeason)?.name ||
    `Season ${selectedSeason}`;
  const displayedEpisodes =
    loadedEpisodes.length > 0
      ? loadedEpisodes
      : details?.seasons?.find((s) => s.seasonNumber === selectedSeason)?.episodes || [];

  const similarItems =
    details?.similar && details.similar.length > 0 ? details.similar : [];

  const handleEpisodeDirection = (dir: Direction, idx: number, total: number) => {
    if (dir === 'down') {
      if (idx < total - 1) {
        const nextEp = displayedEpisodes[idx + 1];
        if (nextEp) {
          setFocus(`detail-episode-${nextEp.episodeNumber}`);
          return true;
        }
      }
      return false; // falls through to similar row
    }
    if (dir === 'up') {
      if (idx > 0) {
        const prevEp = displayedEpisodes[idx - 1];
        if (prevEp) {
          setFocus(`detail-episode-${prevEp.episodeNumber}`);
          return true;
        }
      }
      return false; // falls through to season selector
    }
    return false;
  };

  return (
    <div
      aria-modal="true"
      className="tv-v2-detail-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="tv-v2-detail-dialog tv-v2-detail-modal"
        data-testid="tv-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Upper Hero Region */}
        <div className="tv-v2-detail__hero-region" data-row-id="detail-actions-row">
          {isDetailPreviewActive && trailerKey ? (
            <TvPreviewPlayer
              aspectRatio="full-bleed"
              backdropUrl={backdropUrl}
              className="tv-v2-detail__hero-preview"
              id={previewId}
              title={details?.title || item.title}
              variant="detail"
              videoKey={trailerKey}
            />
          ) : (
            <img
              alt=""
              aria-hidden="true"
              className="tv-v2-detail__hero-img"
              src={backdropUrl}
            />
          )}

          {/* Vignette Gradients */}
          <div className="tv-v2-detail__hero-vignette" />

          {/* Top-Right Circular Close Button */}
          <DetailCloseButton
            id="detail-action-close"
            onClose={onClose}
          />

          {/* Title & Primary Action Controls */}
          <div className="tv-v2-detail__hero-overlay">
            {details?.logoUrl ? (
              <img
                alt={details.title || item.title}
                className="tv-v2-detail__logo"
                src={details.logoUrl}
              />
            ) : (
              <h1 className="tv-v2-detail__title">{details?.title || item.title}</h1>
            )}

            <div className="tv-v2-detail__actions">
              <DetailActionButton
                colIndex={0}
                icon={<Icon name="play" size={22} />}
                id="detail-action-play"
                label="Play"
                onBack={onClose}
                onSelect={() => onPlay(item)}
                primary
              />

              <DetailIconButton
                ariaLabel={isInList ? 'In My List' : 'Add to My List'}
                colIndex={1}
                icon={<Icon name={isInList ? 'check' : 'plus'} size={20} />}
                id="detail-action-list"
                isActive={isInList}
                onBack={onClose}
                onSelect={() => onToggleList(item)}
              />

              <DetailIconButton
                ariaLabel={isLiked ? 'Liked' : 'Like'}
                colIndex={2}
                icon={<Icon name="thumbUp" size={20} />}
                id="detail-action-like"
                isActive={isLiked}
                onBack={onClose}
                onSelect={() => setIsLiked((prev) => !prev)}
              />

              <DetailIconButton
                ariaLabel={isMuted ? 'Unmute' : 'Mute'}
                className="tv-v2-detail__audio-btn"
                colIndex={3}
                icon={<Icon name={isMuted ? 'volumeOff' : 'volume'} size={20} />}
                id="detail-action-sound"
                onBack={onClose}
                onSelect={() => tvPreviewManager.toggleMute()}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Body below hero */}
        <div className="tv-v2-detail__scrollable" ref={scrollableRef}>
          {/* 2-Column Metadata + Overview */}
          <div className="tv-v2-detail__columns">
            {/* Left Column */}
            <div className="tv-v2-detail__main-col">
              <TvDetailsMetadataRow details={details} item={item} />

              <p className="tv-v2-detail__overview">
                {details?.overview || item.overview || 'No synopsis is currently available.'}
              </p>
            </div>

            {/* Right Column */}
            <div className="tv-v2-detail__info-col">
              {castString && (
                <div className="tv-v2-detail__info-row">
                  <span className="tv-v2-detail__info-label">Cast:</span>
                  <span className="tv-v2-detail__info-value">{castString}</span>
                </div>
              )}
              {genresString && (
                <div className="tv-v2-detail__info-row">
                  <span className="tv-v2-detail__info-label">Genres:</span>
                  <span className="tv-v2-detail__info-value">{genresString}</span>
                </div>
              )}
              {thisShowIsString && (
                <div className="tv-v2-detail__info-row">
                  <span className="tv-v2-detail__info-label">
                    {isMovie ? 'This Movie Is:' : 'This Show Is:'}
                  </span>
                  <span className="tv-v2-detail__info-value">{thisShowIsString}</span>
                </div>
              )}
            </div>
          </div>

          {/* SERIES ONLY: Episodes Section */}
          {!isMovie && (
            <div className="tv-v2-detail__episodes-section">
              <div className="tv-v2-detail__episodes-head" data-row-id="detail-seasons-row">
                <h3>Episodes</h3>

                {hasSeasons && (
                  <div className="tv-v2-season-selector-wrapper" style={{ position: 'relative' }}>
                    <SeasonSelectorButton
                      id={`detail-season-${selectedSeason}`}
                      isOpen={isSeasonMenuOpen}
                      onBack={onClose}
                      onToggle={() => {
                        if (isSeasonMenuOpen) {
                          closeSeasonMenu();
                        } else {
                          openSeasonMenu();
                        }
                      }}
                      seasonName={currentSeasonName}
                    />

                    {isSeasonMenuOpen && (
                      <SeasonDropdown
                        onClose={closeSeasonMenu}
                        onSelect={(num) => {
                          setSelectedSeason(num);
                          closeSeasonMenu();
                        }}
                        seasons={details?.seasons || []}
                        selectedSeason={selectedSeason}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Vertical list of horizontal episode rows */}
              <div className="tv-v2-episodes-list" data-row-id="detail-episodes-row">
                {displayedEpisodes.map((ep, idx) => (
                  <EpisodeRow
                    colIndex={idx}
                    episode={ep}
                    fallbackBackdrop={backdropUrl}
                    key={ep.id || idx}
                    onBack={onClose}
                    onDirection={(dir) =>
                      handleEpisodeDirection(dir, idx, displayedEpisodes.length)
                    }
                    onSelect={() =>
                      onPlay(item, {
                        episodeNumber: ep.episodeNumber,
                        seasonNumber: selectedSeason,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* MORE LIKE THIS */}
          {similarItems.length > 0 && (
            <div className="tv-v2-detail__similar-section" data-row-id="detail-similar-row">
              <h3>More Like This</h3>
              <div className="tv-v2-similar-track">
                {similarItems.map((sim, idx) => (
                  <SimilarLandscapeCard
                    colIndex={idx}
                    item={sim}
                    key={sim.id || idx}
                    onBack={onClose}
                    onSelect={() => onSelectSimilar(sim)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailCloseButton({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id,
    onBack: () => {
      onClose();
      return true;
    },
    onSelect: onClose,
    rowId: 'detail-header-row',
  });

  return (
    <button
      aria-label="Close details"
      className={`tv-v2-detail__close-btn ${isFocused ? 'tv-v2-detail__close-btn--focused' : ''}`}
      data-testid={id}
      data-tv-focusable="true"
      id={id}
      onClick={onClose}
      type="button"
    >
      <Icon name="close" size={20} />
    </button>
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
    onBack: () => {
      onBack();
      return true;
    },
    onSelect,
    rowId: 'detail-actions-row',
  });

  return (
    <button
      className={`tv-v2-detail-play-btn ${primary ? 'tv-v2-detail-play-btn--primary' : ''} ${
        isFocused ? 'tv-v2-detail-play-btn--focused' : ''
      }`}
      data-testid={id}
      data-tv-focusable="true"
      id={id}
      onClick={onSelect}
      type="button"
    >
      <span aria-hidden="true" className="tv-v2-detail-btn__icon">
        {icon}
      </span>
      <span className="tv-v2-detail-btn__label">{label}</span>
    </button>
  );
}

function DetailIconButton({
  ariaLabel,
  className = '',
  colIndex,
  icon,
  id,
  isActive = false,
  onBack,
  onSelect,
}: {
  ariaLabel: string;
  className?: string;
  colIndex: number;
  icon: React.ReactNode;
  id: string;
  isActive?: boolean;
  onBack: () => void;
  onSelect: () => void;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex,
    id,
    onBack: () => {
      onBack();
      return true;
    },
    onSelect,
    rowId: 'detail-actions-row',
  });

  return (
    <button
      aria-label={ariaLabel}
      className={`tv-v2-detail-circle-btn ${className} ${
        isActive ? 'tv-v2-detail-circle-btn--active' : ''
      } ${isFocused ? 'tv-v2-detail-circle-btn--focused' : ''}`.trim()}
      data-testid={id}
      data-tv-focusable="true"
      id={id}
      onClick={onSelect}
      type="button"
    >
      {icon}
    </button>
  );
}

function SeasonSelectorButton({
  id,
  isOpen,
  onBack,
  onToggle,
  seasonName,
}: {
  id: string;
  isOpen: boolean;
  onBack: () => void;
  onToggle: () => void;
  seasonName: string;
}) {
  const { isFocused } = useTvFocusNode({
    colIndex: 0,
    id,
    onBack: () => {
      onBack();
      return true;
    },
    onSelect: onToggle,
    rowId: 'detail-seasons-row',
  });

  return (
    <button
      aria-expanded={isOpen}
      aria-haspopup="true"
      className={`tv-v2-season-trigger ${isFocused ? 'tv-v2-season-trigger--focused' : ''}`}
      data-testid={id}
      data-tv-focusable="true"
      id={id}
      onClick={onToggle}
      type="button"
    >
      <span>{seasonName}</span>
      <span aria-hidden="true" style={{ fontSize: '0.8em', marginLeft: 4 }}>
        {isOpen ? '▴' : '▾'}
      </span>
    </button>
  );
}

function SeasonDropdown({
  onClose,
  onSelect,
  seasons,
  selectedSeason,
}: {
  onClose: () => void;
  onSelect: (seasonNumber: number) => void;
  seasons: SeasonData[];
  selectedSeason: number;
}) {
  useTvFocusRow({ id: 'detail-season-menu-row', order: 0 });

  return (
    <div
      aria-label="Select Season"
      className="tv-v2-season-dropdown"
      role="menu"
    >
      {seasons.map((s, idx) => {
        const isSelected = s.seasonNumber === selectedSeason;
        const optId = `detail-season-opt-${s.seasonNumber}`;
        return (
          <SeasonDropdownItem
            colIndex={idx}
            id={optId}
            isSelected={isSelected}
            key={s.seasonNumber}
            onBack={onClose}
            onDirection={(dir) => {
              if (dir === 'down' && idx < seasons.length - 1) {
                return false;
              }
              if (dir === 'up' && idx > 0) {
                return false;
              }
              return false;
            }}
            onSelect={() => onSelect(s.seasonNumber)}
            season={s}
          />
        );
      })}
    </div>
  );
}

function SeasonDropdownItem({
  colIndex,
  id,
  isSelected,
  onBack,
  onDirection,
  onSelect,
  season,
}: {
  colIndex: number;
  id: string;
  isSelected: boolean;
  onBack: () => void;
  onDirection: (dir: Direction) => boolean | void;
  onSelect: () => void;
  season: SeasonData;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const { isFocused } = useTvFocusNode({
    colIndex,
    id,
    onBack: () => {
      onBack();
      return true;
    },
    onDirection,
    onSelect,
    rowId: 'detail-season-menu-row',
  });

  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  return (
    <div
      aria-checked={isSelected}
      className={`tv-v2-season-item ${isFocused ? 'tv-v2-season-item--focused' : ''} ${
        isSelected ? 'tv-v2-season-item--selected' : ''
      }`}
      data-testid={id}
      data-tv-focusable="true"
      id={id}
      onClick={onSelect}
      ref={itemRef}
      role="menuitemradio"
      tabIndex={0}
    >
      <span>
        {season.name}{' '}
        {season.episodeCount ? `(${season.episodeCount} Episodes)` : ''}
      </span>
      {isSelected && <span aria-hidden="true">✓</span>}
    </div>
  );
}

function EpisodeRow({
  colIndex,
  episode,
  fallbackBackdrop,
  onBack,
  onDirection,
  onSelect,
}: {
  colIndex: number;
  episode: EpisodeData;
  fallbackBackdrop: string;
  onBack: () => void;
  onDirection: (dir: Direction) => boolean | void;
  onSelect: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const nodeId = `detail-episode-${episode.episodeNumber}`;

  const { isFocused } = useTvFocusNode({
    colIndex,
    id: nodeId,
    onBack: () => {
      onBack();
      return true;
    },
    onDirection,
    onSelect,
    rowId: 'detail-episodes-row',
  });

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  const stillUrl = episode.stillUrl || episode.still?.fallback || fallbackBackdrop;

  return (
    <div
      className={`tv-v2-episode-row ${isFocused ? 'tv-v2-episode-row--focused' : ''}`}
      data-testid={nodeId}
      data-tv-focusable="true"
      id={nodeId}
      onClick={onSelect}
      ref={rowRef}
      role="button"
      tabIndex={0}
    >
      <div className="tv-v2-episode-row__num">{episode.episodeNumber}</div>
      <div className="tv-v2-episode-row__still-wrap">
        <img
          alt={episode.title}
          className="tv-v2-episode-row__still"
          loading="lazy"
          src={stillUrl}
        />
        <div className="tv-v2-episode-row__play-icon" aria-hidden="true">
          <Icon name="play" size={24} />
        </div>
      </div>
      <div className="tv-v2-episode-row__content">
        <div className="tv-v2-episode-row__header">
          <h4 className="tv-v2-episode-row__title">{episode.title}</h4>
          {episode.runtime ? (
            <span className="tv-v2-episode-row__duration">{episode.runtime}m</span>
          ) : null}
        </div>
        <p className="tv-v2-episode-row__overview">{episode.overview}</p>
      </div>
    </div>
  );
}

function SimilarLandscapeCard({
  colIndex,
  item,
  onBack,
  onSelect,
}: {
  colIndex: number;
  item: MediaItem;
  onBack: () => void;
  onSelect: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nodeId = `detail-similar-${item.id}`;

  const { isFocused } = useTvFocusNode({
    colIndex,
    id: nodeId,
    onBack: () => {
      onBack();
      return true;
    },
    onDirection: (dir) => {
      if (dir === 'down') {
        return true; // Trap focus inside modal
      }
      return false;
    },
    onSelect,
    rowId: 'detail-similar-row',
  });

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [isFocused]);

  const backdrop = item.backdrop?.fallback || item.backdropUrl || item.posterUrl || '';
  const formattedRuntime = formatRuntime(item.runtime);

  return (
    <div
      className={`tv-v2-similar-card ${isFocused ? 'tv-v2-similar-card--focused' : ''}`}
      data-testid={nodeId}
      data-tv-focusable="true"
      id={nodeId}
      onClick={onSelect}
      ref={cardRef}
      role="button"
      tabIndex={0}
    >
      <img
        alt={item.title}
        className="tv-v2-similar-card__img"
        loading="lazy"
        src={backdrop}
      />
      {formattedRuntime && (
        <span className="tv-v2-similar-card__runtime">{formattedRuntime}</span>
      )}
      <div className="tv-v2-similar-card__overlay">
        <span className="tv-v2-similar-card__title">{item.title}</span>
      </div>
    </div>
  );
}
