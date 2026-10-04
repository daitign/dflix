export interface RawMediaMetadata {
  ad?: boolean;
  audioDescription?: boolean;
  audioFormat?: string;
  cc?: boolean;
  contentDescriptors?: string[];
  descriptors?: string[];
  episodeLabel?: string;
  firstAirDate?: string;
  genres?: string[];
  hasAd?: boolean;
  hasAudioDescription?: boolean;
  hasCc?: boolean;
  hasSpatialAudio?: boolean;
  hasSubtitles?: boolean;
  id?: number | string;
  is4K?: boolean;
  isHD?: boolean;
  maturityRating?: string;
  playbackType?: 'movie' | 'tv';
  quality?: string;
  rating?: string;
  releaseDate?: string;
  runtime?: number;
  seasons?: number | string | Array<{ seasonNumber: number; name?: string }>;
  spatialAudio?: boolean;
  subtitles?: boolean;
  title?: string;
  type?: 'movie' | 'tv' | 'anime';
  year?: number | string;
  [key: string]: unknown;
}

export interface TvDetailsMetadataModel {
  audioBadge?: string;
  descriptorsText?: string;
  durationText?: string;
  hasAd: boolean;
  hasCc: boolean;
  hasDescriptors: boolean;
  isMovie: boolean;
  maturityRating?: string;
  qualityBadge?: string;
  year?: string;
}

export function formatRuntime(minutes?: number): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function resolveTvDetailsMetadata(
  item: RawMediaMetadata,
  details?: RawMediaMetadata | null,
): TvDetailsMetadataModel {
  // 1. Movie vs Series classification
  const playbackType = details?.playbackType ?? item.playbackType;
  const isMovie =
    playbackType === 'movie' ||
    (playbackType === undefined && item.type !== 'tv' && item.type !== 'anime');

  // 2. Year (4-digit format)
  const rawYear =
    details?.year ??
    item.year ??
    (details?.releaseDate ? parseInt(String(details.releaseDate), 10) : undefined) ??
    (item.releaseDate ? parseInt(String(item.releaseDate), 10) : undefined) ??
    (details?.firstAirDate ? parseInt(String(details.firstAirDate), 10) : undefined) ??
    (item.firstAirDate ? parseInt(String(item.firstAirDate), 10) : undefined);
  const year = rawYear && !isNaN(Number(rawYear)) ? String(rawYear) : undefined;

  // 3. Duration: Runtime for movies ONLY, Season count for series ONLY
  let durationText: string | undefined;
  if (isMovie) {
    const minutes = details?.runtime ?? item.runtime;
    if (typeof minutes === 'number' && minutes > 0) {
      durationText = formatRuntime(minutes);
    }
  } else {
    const rawSeasons =
      (Array.isArray(details?.seasons) ? details?.seasons.length : undefined) ??
      details?.seasons ??
      item.seasons ??
      details?.episodeLabel ??
      item.episodeLabel;

    if (typeof rawSeasons === 'number' && rawSeasons > 0) {
      durationText = rawSeasons > 1 ? `${rawSeasons} Seasons` : '1 Season';
    } else if (typeof rawSeasons === 'string' && rawSeasons.trim()) {
      durationText = rawSeasons.trim();
    }
  }

  // 4. Maturity rating (Content rating)
  let maturityRating: string | undefined;
  const rawRating =
    details?.maturityRating ??
    item.maturityRating ??
    details?.rating ??
    item.rating;
  if (
    rawRating &&
    typeof rawRating === 'string' &&
    rawRating.trim() &&
    rawRating.trim().toUpperCase() !== 'NR'
  ) {
    maturityRating = rawRating.trim();
  }

  // 5. Content descriptors (Advisory warnings)
  // Truthful only: do not invent descriptors. If descriptors match genres fallback, omit them.
  let descriptorsText: string | undefined;
  let hasDescriptors = false;

  const candidateDescriptors =
    item.contentDescriptors ??
    details?.contentDescriptors ??
    item.descriptors ??
    details?.descriptors;

  if (Array.isArray(candidateDescriptors) && candidateDescriptors.length > 0) {
    const genres = (details?.genres ?? item.genres ?? []).map((g) =>
      String(g).toLowerCase().trim(),
    );

    // If candidateDescriptors only came from details.descriptors (and not item/contentDescriptors),
    // verify it is not just TMDB's genres.slice(0, 3) fallback
    const isPureGenreFallback =
      !item.contentDescriptors &&
      !details?.contentDescriptors &&
      !item.descriptors &&
      candidateDescriptors.every((d) => genres.includes(String(d).toLowerCase().trim()));

    if (!isPureGenreFallback) {
      const filtered = candidateDescriptors
        .map((d) => String(d).trim())
        .filter(Boolean);
      if (filtered.length > 0) {
        descriptorsText = filtered.join(', ');
        hasDescriptors = true;
      }
    }
  }

  // 6. Technical badges (Truthful only - omit if not confirmed by source)
  let qualityBadge: string | undefined;
  const rawQuality =
    item.quality ??
    (item.is4K ? '4K' : item.isHD ? 'HD' : undefined) ??
    (details?.isQualityConfirmed ? details.quality : undefined);
  if (rawQuality && typeof rawQuality === 'string' && rawQuality.trim()) {
    qualityBadge = rawQuality.trim().toUpperCase();
  }

  let audioBadge: string | undefined;
  const rawAudio =
    item.audioFormat ??
    (item.spatialAudio || item.hasSpatialAudio ? 'Spatial Audio' : undefined) ??
    details?.audioFormat;
  if (rawAudio && typeof rawAudio === 'string' && rawAudio.trim()) {
    audioBadge = rawAudio.trim();
  }

  const hasAd = Boolean(
    item.audioDescription ??
      item.hasAudioDescription ??
      item.ad ??
      item.hasAd ??
      details?.audioDescription,
  );

  const hasCc = Boolean(
    item.hasCc ??
      item.cc ??
      item.subtitles ??
      item.hasSubtitles ??
      details?.hasCc ??
      details?.subtitles,
  );

  return {
    audioBadge,
    descriptorsText,
    durationText,
    hasAd,
    hasCc,
    hasDescriptors,
    isMovie,
    maturityRating,
    qualityBadge,
    year,
  };
}
