import type { VidstuckUrlBuilder, PlayerSource } from './contracts';
import './VidstuckPlayer.css';

interface VidstuckPlayerProps {
  source: PlayerSource;
  title: string;
  urlBuilder?: VidstuckUrlBuilder;
}

/**
 * The single future embed boundary. It renders a safe placeholder until a
 * configured URL builder is injected by the application composition root.
 */
export function VidstuckPlayer({ source, title, urlBuilder }: VidstuckPlayerProps) {
  if (!urlBuilder) {
    return (
      <div className="vidstuck-player vidstuck-player--placeholder" role="status">
        <span>Player boundary ready</span>
        <small>{source.mediaType === 'movie' ? 'Movie' : 'Series'} playback is reserved for Phase 5.</small>
      </div>
    );
  }

  return (
    <div className="vidstuck-player">
      <iframe
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        src={urlBuilder.build(source)}
        title={title}
      />
    </div>
  );
}
