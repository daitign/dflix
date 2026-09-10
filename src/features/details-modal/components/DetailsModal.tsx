import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/icons/Icon';
import { IconButton } from '../../../components/primitives/IconButton';
import { ModalShell } from '../../../components/primitives/ModalShell';
import type { MediaItem } from '../../catalog';
import type { EpisodeData, MediaDetails } from '../types';
import { AboutTitle } from './AboutTitle';
import { DetailsHero } from './DetailsHero';
import { DetailsMetadata } from './DetailsMetadata';
import { EpisodeList } from './EpisodeList';
import { SeasonSelector } from './SeasonSelector';
import { SimilarTitles } from './SimilarTitles';
import './DetailsModal.css';

interface DetailsModalProps {
  details: MediaDetails;
  isOpen: boolean;
  onAfterClose: () => void;
  onClose: () => void;
  onSelectSimilar: (item: MediaItem) => void;
  restoreFocusElement?: HTMLElement | null;
}

export function DetailsModal({
  details,
  isOpen,
  onAfterClose,
  onClose,
  onSelectSimilar,
  restoreFocusElement,
}: DetailsModalProps) {
  const [notice, setNotice] = useState('');
  const initialSeason = details.seasons?.[0]?.seasonNumber ?? 1;
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(initialSeason);

  useEffect(() => {
    setSelectedSeasonNumber(details.seasons?.[0]?.seasonNumber ?? 1);
    setNotice('');
  }, [details.id, details.seasons]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedSeason = useMemo(() => (
    details.seasons?.find((season) => season.seasonNumber === selectedSeasonNumber)
      ?? details.seasons?.[0]
  ), [details.seasons, selectedSeasonNumber]);

  const handlePlayEpisode = (episode: EpisodeData) => {
    // Phase 5: pass details.tmdbId, seasonNumber and episodeNumber to the
    // isolated VIDSTUCK URL builder for /embed/tv/{tmdbId}/{season}/{episode}.
    setNotice(`Episode ${episode.episodeNumber} is ready for the Phase 5 player connection.`);
  };

  return (
    <ModalShell
      bodyClassName="details-modal"
      isOpen={isOpen}
      onAfterClose={onAfterClose}
      onClose={onClose}
      restoreFocusElement={restoreFocusElement}
      showHeader={false}
      size="lg"
      title={`${details.title} details`}
      variant="cinematic"
    >
      <div className="details-modal__close-wrap">
        <IconButton aria-label="Close details" className="details-modal__close" onClick={onClose} size="md" tone="glass" tooltip="Close">
          <Icon name="close" size={21} />
        </IconButton>
      </div>
      <DetailsHero details={details} key={String(details.id)} onAction={setNotice} />
      <div className="details-modal__content">
        <DetailsMetadata details={details} />

        {selectedSeason && details.seasons && (
          <section aria-labelledby="episodes-heading" className="details-section details-episodes">
            <div className="details-section__heading-row">
              <h3 id="episodes-heading">Episodes</h3>
              <SeasonSelector onChange={setSelectedSeasonNumber} seasons={details.seasons} value={selectedSeason.seasonNumber} />
            </div>
            <EpisodeList onPlayEpisode={handlePlayEpisode} season={selectedSeason} />
          </section>
        )}

        {details.type === 'movie' && (
          <section aria-labelledby="trailers-heading" className="details-section details-trailers" data-future-trailer-slot>
            <div>
              <span>DAITIGN FEATURE</span>
              <h3 id="trailers-heading">Trailers &amp; More</h3>
              <p>Trailer playback can be connected without changing this modal contract.</p>
            </div>
          </section>
        )}

        <SimilarTitles items={details.similar} onSelect={onSelectSimilar} />
        <AboutTitle details={details} />
      </div>
      <div aria-live="polite" className="details-modal__notice" role="status">{notice}</div>
    </ModalShell>
  );
}
