import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/icons/Icon';
import { Button } from '../../../components/primitives/Button';
import { IconButton } from '../../../components/primitives/IconButton';
import { ModalShell } from '../../../components/primitives/ModalShell';
import { Skeleton } from '../../../components/primitives/Skeleton';
import type { MediaItem } from '../../catalog';
import type { MediaDetails } from '../types';
import { AboutTitle } from './AboutTitle';
import { DetailsHero } from './DetailsHero';
import { DetailsMetadata } from './DetailsMetadata';
import { EpisodeList } from './EpisodeList';
import { SeasonSelector } from './SeasonSelector';
import { SimilarTitles } from './SimilarTitles';
import { TrailersAndMore } from './TrailersAndMore';
import './DetailsModal.css';

interface DetailsModalProps {
  details: MediaDetails | null;
  error: string;
  isLoading: boolean;
  isOpen: boolean;
  onAfterClose: () => void;
  onClose: () => void;
  onLoadSeason: (seasonNumber: number) => void;
  onPlayEpisode: (seasonNumber: number, episodeNumber: number, episodeTitle: string) => void;
  onPlayTitle: () => void;
  onRetry: () => void;
  onSelectSimilar: (item: MediaItem) => void;
  restoreFocusElement?: HTMLElement | null;
  seasonError: { message: string; seasonNumber: number } | null;
  seasonLoading: number | null;
  title: string;
}

function DetailsLoading() {
  return (
    <div aria-label="Loading title details" className="details-loading" role="status">
      <Skeleton className="details-loading__hero" radius="lg" />
      <div className="details-loading__body">
        <Skeleton height="1.25rem" width="12rem" />
        <Skeleton height="1rem" width="100%" />
        <Skeleton height="1rem" width="86%" />
        <div className="details-loading__cards">
          <Skeleton height="9rem" radius="lg" />
          <Skeleton height="9rem" radius="lg" />
          <Skeleton height="9rem" radius="lg" />
        </div>
      </div>
    </div>
  );
}

export function DetailsModal({
  details,
  error,
  isLoading,
  isOpen,
  onAfterClose,
  onClose,
  onLoadSeason,
  onPlayEpisode,
  onPlayTitle,
  onRetry,
  onSelectSimilar,
  restoreFocusElement,
  seasonError,
  seasonLoading,
  title,
}: DetailsModalProps) {
  const [notice, setNotice] = useState('');
  const initialSeason = details?.seasons?.find((season) => season.seasonNumber === 1)?.seasonNumber
    ?? details?.seasons?.[0]?.seasonNumber
    ?? 1;
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(initialSeason);

  useEffect(() => {
    const firstSeason = details?.seasons?.find((season) => season.seasonNumber === 1)?.seasonNumber
      ?? details?.seasons?.[0]?.seasonNumber
      ?? 1;
    setSelectedSeasonNumber(firstSeason);
    setNotice('');

    const scrollContainer = document.querySelector('.detailsModalScroll');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [details?.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedSeason = useMemo(() => (
    details?.seasons?.find((season) => season.seasonNumber === selectedSeasonNumber)
      ?? details?.seasons?.[0]
  ), [details?.seasons, selectedSeasonNumber]);

  useEffect(() => {
    if (
      selectedSeason
      && !selectedSeason.episodes
      && seasonLoading !== selectedSeason.seasonNumber
      && seasonError?.seasonNumber !== selectedSeason.seasonNumber
    ) {
      onLoadSeason(selectedSeason.seasonNumber);
    }
  }, [onLoadSeason, seasonError?.seasonNumber, seasonLoading, selectedSeason]);

  return (
    <ModalShell
      bodyClassName="details-modal detailsModalScroll"
      isOpen={isOpen}
      onAfterClose={onAfterClose}
      onClose={onClose}
      restoreFocusElement={restoreFocusElement}
      showHeader={false}
      size="lg"
      title={`${details?.title ?? title} details`}
      variant="cinematic"
    >
      <div className="details-modal__close-wrap">
        <IconButton aria-label="Close details" className="details-modal__close" onClick={onClose} size="sm" tone="glass" tooltip="Close">
          <Icon name="close" size={16} />
        </IconButton>
      </div>

      {isLoading && <DetailsLoading />}

      {!isLoading && error && (
        <div className="details-error" role="alert">
          <span aria-hidden="true">D</span>
          <h3>Details are temporarily unavailable</h3>
          <p>{error}</p>
          <Button onClick={onRetry} variant="secondary">Try again</Button>
        </div>
      )}

      {!isLoading && details && (
        <>
          <DetailsHero details={details} key={String(details.id)} onAction={setNotice} onPlay={onPlayTitle} />
          <div className="details-modal__content">
            <DetailsMetadata details={details} />

            {selectedSeason && details.seasons && (
              <section aria-labelledby="episodes-heading" className="details-section details-episodes">
                <div className="details-section__heading-row">
                  <h3 id="episodes-heading">Episodes</h3>
                  <SeasonSelector onChange={setSelectedSeasonNumber} seasons={details.seasons} value={selectedSeason.seasonNumber} />
                </div>
                {seasonLoading === selectedSeason.seasonNumber && (
                  <div aria-label={`Loading ${selectedSeason.name}`} className="episode-loading" role="status">
                    {[1, 2, 3].map((row) => <Skeleton height="7.5rem" key={row} radius="md" />)}
                  </div>
                )}
                {seasonError?.seasonNumber === selectedSeason.seasonNumber && (
                  <div className="episode-error" role="alert">
                    <p>{seasonError.message}</p>
                    <Button onClick={() => onLoadSeason(selectedSeason.seasonNumber)} size="sm" variant="secondary">Retry season</Button>
                  </div>
                )}
                {selectedSeason.episodes && (
                  selectedSeason.episodes.length > 0 ? (
                    <EpisodeList
                      onPlayEpisode={(episode) => onPlayEpisode(selectedSeason.seasonNumber, episode.episodeNumber, episode.title)}
                      season={{ ...selectedSeason, episodes: selectedSeason.episodes }}
                    />
                  ) : (
                    <p className="episodes-empty">No episodes are available for this season yet.</p>
                  )
                )}
              </section>
            )}

            <TrailersAndMore details={details} />

            {details.similar.length > 0 && <SimilarTitles items={details.similar} onSelect={onSelectSimilar} />}
            <AboutTitle details={details} />
          </div>
          <div aria-live="polite" className="details-modal__notice" role="status">{notice}</div>
        </>
      )}
    </ModalShell>
  );
}
