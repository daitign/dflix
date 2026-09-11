import { useEffect, useState } from 'react';
import { tmdbClient } from '../../lib/tmdb/client';
import { normalizeTmdbTv } from '../../lib/tmdb/adapters';
import type { TmdbMediaSummary, TmdbTvDetails } from '../../lib/tmdb/types';
import { getFreshnessBadge } from '../catalog/freshness';
import type { MediaItem, MediaRowModel } from '../catalog/types';
import { BrowseSkeleton } from '../home/components/BrowseSkeleton';
import { HeroBanner } from '../home/components/HeroBanner';
import { MediaRow } from '../home/components/MediaRow';

function uniqueTv(items: TmdbMediaSummary[], category: 'tv' | 'anime' = 'tv', limit = 18): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    const normalized = normalizeTmdbTv(item, undefined, category);
    if (!normalized || !normalized.title || (!normalized.posterUrl && !normalized.backdropUrl)) return;
    unique.set(String(normalized.id), normalized);
  });
  return [...unique.values()].slice(0, limit);
}

function dedupeMedia(items: MediaItem[], limit = 18): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

function enrichTv(item: MediaItem, detailsMap: Map<number, TmdbTvDetails>, topTenIds: Set<string>): MediaItem {
  const details = item.tmdbId ? detailsMap.get(item.tmdbId) : undefined;
  const regularSeasons = details?.seasons?.filter(
    (s) => s.season_number > 0 && s.episode_count > 0 && Boolean(s.air_date),
  );
  const seasonAirDates = regularSeasons?.map((s) => s.air_date!).sort().reverse();
  const lastEpisode = details?.last_episode_to_air;

  const itemWithDates: MediaItem = {
    ...item,
    firstAirDate: details?.first_air_date ?? item.firstAirDate,
    lastAirDate: details?.last_air_date,
    lastEpisodeAirDate: lastEpisode?.air_date,
    lastEpisodeSeasonNumber: lastEpisode?.season_number,
    lastEpisodeNumber: lastEpisode?.episode_number,
    lastEpisodeName: lastEpisode?.name,
    seasonAirDates,
    inTopTen: topTenIds.has(String(item.id)),
  };

  const badge = getFreshnessBadge(itemWithDates);
  return { ...itemWithDates, badge };
}

export function ShowsPage() {
  const [hero, setHero] = useState<MediaItem | null>(null);
  const [topTen, setTopTen] = useState<MediaItem[]>([]);
  const [rows, setRows] = useState<MediaRowModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');

    const safely = async <T,>(p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch { return null; }
    };

    Promise.all([
      safely(tmdbClient.getTrendingTv()),
      safely(tmdbClient.getPopularTv()),
      safely(tmdbClient.getOnTheAirTv()),
      safely(tmdbClient.getTopRatedTv()),
      safely(tmdbClient.discoverTv({ with_original_language: 'ko' })),
      safely(tmdbClient.getAnimeTv()),
      safely(tmdbClient.discoverTv({ with_genres: 80 })),
      safely(tmdbClient.discoverTv({ with_genres: 18 })),
      safely(tmdbClient.discoverTv({ with_genres: 35 })),
      safely(tmdbClient.discoverTv({ with_genres: 10765 })),
    ])
      .then(async ([
        trending,
        popular,
        onTheAir,
        topRated,
        korean,
        anime,
        crime,
        drama,
        comedy,
        sciFi,
      ]) => {
        if (!active) return;

        const trendingItems = uniqueTv(trending?.results ?? []);
        const popularItems = uniqueTv(popular?.results ?? []);
        const onTheAirItems = uniqueTv(onTheAir?.results ?? []);
        const topRatedItems = uniqueTv(topRated?.results ?? []);
        const koreanItems = uniqueTv(korean?.results ?? []);
        const animeItems = uniqueTv(anime?.results ?? [], 'anime');
        const crimeItems = uniqueTv(crime?.results ?? []);
        const dramaItems = uniqueTv(drama?.results ?? []);
        const comedyItems = uniqueTv(comedy?.results ?? []);
        const sciFiItems = uniqueTv(sciFi?.results ?? []);

        const rankedPool = dedupeMedia([...trendingItems, ...popularItems], 10);
        const topTenIds = new Set(rankedPool.map((i) => String(i.id)));

        // Candidate enrichment for badges
        const candidateIds = new Set<number>();
        [...rankedPool, ...onTheAirItems.slice(0, 8), ...popularItems.slice(0, 8)].forEach((item) => {
          if (item.tmdbId) candidateIds.add(item.tmdbId);
        });

        const detailsMap = new Map<number, TmdbTvDetails>();
        await Promise.allSettled(
          Array.from(candidateIds).map(async (id) => {
            try {
              const d = await tmdbClient.getTvDetails(id);
              if (d) detailsMap.set(id, d);
            } catch {
              // ignore
            }
          }),
        );

        if (!active) return;

        const heroCandidate = rankedPool.find((i) => i.backdropUrl) ?? rankedPool[0] ?? trendingItems[0];
        const enrichedHero = heroCandidate ? enrichTv(heroCandidate, detailsMap, topTenIds) : null;
        const enrichedTopTen = rankedPool.map((i) => enrichTv(i, detailsMap, topTenIds));

        const allEnriched = [
          ...trendingItems,
          ...popularItems,
          ...onTheAirItems,
          ...topRatedItems,
          ...koreanItems,
          ...animeItems,
          ...crimeItems,
          ...dramaItems,
          ...comedyItems,
          ...sciFiItems,
        ].map((i) => enrichTv(i, detailsMap, topTenIds));

        // Filter new episodes and new seasons
        const newEpisodes = allEnriched.filter((i) => i.badge === 'new-episode');
        const newSeasons = allEnriched.filter((i) => i.badge === 'new-season');

        const nextRows: MediaRowModel[] = [
          ...(newEpisodes.length > 0
            ? [{ id: 'new-episodes', title: 'New Episodes', items: newEpisodes, emphasis: 'featured' as const }]
            : []),
          ...(newSeasons.length > 0
            ? [{ id: 'new-seasons', title: 'New Seasons', items: newSeasons, emphasis: 'standard' as const }]
            : []),
          { id: 'trending-tv', title: 'Trending Series', items: trendingItems.map((i) => enrichTv(i, detailsMap, topTenIds)), emphasis: 'featured' as const },
          { id: 'popular-tv', title: 'Popular TV Shows', items: popularItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          { id: 'on-the-air', title: 'On The Air', items: onTheAirItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          { id: 'top-rated-tv', title: 'Critically Acclaimed TV', items: topRatedItems.map((i) => enrichTv(i, detailsMap, topTenIds)), emphasis: 'compact' as const },
          { id: 'korean-series', title: 'Korean Series', items: koreanItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          { id: 'anime', title: 'Anime Series', items: animeItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          { id: 'crime-tv', title: 'Crime & Thriller', items: crimeItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          { id: 'drama-tv', title: 'TV Dramas', items: dramaItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          { id: 'comedy-tv', title: 'TV Comedies', items: comedyItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          { id: 'scifi-tv', title: 'Sci-Fi & Fantasy', items: sciFiItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
        ].filter((r) => r.items.length > 0);

        setHero(enrichedHero);
        setTopTen(enrichedTopTen);
        setRows(nextRows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load Shows catalog.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (isLoading) return <BrowseSkeleton />;
  if (error || !hero) {
    return (
      <main className="catalog-error" id="main-content">
        <div>
          <h1>Shows Unavailable</h1>
          <p>{error || 'Could not load TV series right now.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="browse-page" id="main-content">
      <HeroBanner item={hero} />
      <div className="browse-catalog">
        {topTen.length > 0 && (
          <div className="top-ten-feature">
            <MediaRow items={topTen} mode="ranked" title="Top 10 TV Shows Today" />
          </div>
        )}
        {rows.map((row) => (
          <MediaRow key={row.id} row={row} />
        ))}
      </div>
    </main>
  );
}
