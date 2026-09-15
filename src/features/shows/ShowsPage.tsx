import { useEffect, useState } from 'react';
import { tmdbClient } from '../../lib/tmdb/client';
import { normalizeTmdbTv } from '../../lib/tmdb/adapters';
import type { TmdbMediaSummary, TmdbTvDetails } from '../../lib/tmdb/types';
import { getFreshnessBadge } from '../catalog/freshness';
import type { MediaItem, MediaRowModel } from '../catalog/types';
import { BrowseSkeleton } from '../home/components/BrowseSkeleton';
import { HeroBanner } from '../home/components/HeroBanner';
import { MediaRow } from '../home/components/MediaRow';
import { CategoryHeader, type GenreOption } from '../../components/navigation/CategoryHeader';

export const TV_GENRES: GenreOption[] = [
  { id: 'all', name: 'All TV Shows' },
  { id: 'action-adventure', name: 'Action & Adventure', tmdbGenreId: 10759 },
  { id: 'anime', name: 'Anime Series', tmdbGenreId: 16 },
  { id: 'comedy', name: 'Comedies', tmdbGenreId: 35 },
  { id: 'crime', name: 'Crime & Thriller', tmdbGenreId: 80 },
  { id: 'documentary', name: 'Documentaries', tmdbGenreId: 99 },
  { id: 'drama', name: 'Drama', tmdbGenreId: 18 },
  { id: 'kids', name: 'Kids & Family', tmdbGenreId: 10762 },
  { id: 'korean', name: 'Korean Series', languageCode: 'ko' },
  { id: 'mystery', name: 'Mystery', tmdbGenreId: 9648 },
  { id: 'reality', name: 'Reality TV', tmdbGenreId: 10764 },
  { id: 'scifi-fantasy', name: 'Sci-Fi & Fantasy', tmdbGenreId: 10765 },
  { id: 'soap', name: 'Soap Operas', tmdbGenreId: 10766 },
  { id: 'war-politics', name: 'War & Politics', tmdbGenreId: 10768 },
];

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

interface ShowsCacheData {
  hero: MediaItem | null;
  topTen: MediaItem[];
  rows: MediaRowModel[];
}

const showsCache = new Map<string, ShowsCacheData>();

export function ShowsPage() {
  const [selectedGenreId, setSelectedGenreId] = useState('all');
  const [hero, setHero] = useState<MediaItem | null>(() => showsCache.get('all')?.hero ?? null);
  const [topTen, setTopTen] = useState<MediaItem[]>(() => showsCache.get('all')?.topTen ?? []);
  const [rows, setRows] = useState<MediaRowModel[]>(() => showsCache.get('all')?.rows ?? []);
  const [isLoading, setIsLoading] = useState(() => !showsCache.has('all'));
  const [error, setError] = useState('');

  const currentGenre = TV_GENRES.find((g) => g.id === selectedGenreId);

  useEffect(() => {
    let active = true;
    const cached = showsCache.get(selectedGenreId);
    if (cached) {
      setHero(cached.hero);
      setTopTen(cached.topTen);
      setRows(cached.rows);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError('');

    const safely = async <T,>(p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch { return null; }
    };

    if (selectedGenreId === 'all') {
      // Full rich TV catalog
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
                detailsMap.set(id, d);
              } catch {
                // Ignore failure
              }
            }),
          );

          if (!active) return;

          const heroCandidate =
            trendingItems.find((i) => i.backdropUrl) ??
            popularItems.find((i) => i.backdropUrl) ??
            trendingItems[0];

          const enrichedHero = heroCandidate
            ? enrichTv(heroCandidate, detailsMap, topTenIds)
            : null;

          const enrichedTopTen = rankedPool.map((i) => enrichTv(i, detailsMap, topTenIds));

          const nextRows: MediaRowModel[] = [
            { id: 'trending-tv', title: 'Trending Series', items: trendingItems.map((i) => enrichTv(i, detailsMap, topTenIds)), emphasis: 'featured' as const },
            { id: 'popular-tv', title: 'Popular on DAITIGN', items: popularItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'on-the-air', title: 'On The Air', items: onTheAirItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'top-rated-tv', title: 'Critically Acclaimed TV', items: topRatedItems.map((i) => enrichTv(i, detailsMap, topTenIds)), emphasis: 'compact' as const },
            { id: 'korean-series', title: 'Korean Series', items: koreanItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'anime', title: 'Anime Series', items: animeItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'crime-tv', title: 'Crime & Thriller', items: crimeItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'drama-tv', title: 'TV Dramas', items: dramaItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'comedy-tv', title: 'TV Comedies', items: comedyItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'scifi-tv', title: 'Sci-Fi & Fantasy', items: sciFiItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
          ].filter((r) => r.items.length > 0);

          showsCache.set(selectedGenreId, {
            hero: enrichedHero,
            topTen: enrichedTopTen,
            rows: nextRows,
          });
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
    } else {
      // Specific genre query
      const genreParam = currentGenre?.languageCode
        ? { with_original_language: currentGenre.languageCode }
        : currentGenre?.tmdbGenreId
          ? { with_genres: currentGenre.tmdbGenreId }
          : {};

      Promise.all([
        safely(tmdbClient.discoverTv({ ...genreParam, sort_by: 'popularity.desc' })),
        safely(tmdbClient.discoverTv({ ...genreParam, sort_by: 'vote_average.desc', 'vote_count.gte': 50 })),
        safely(tmdbClient.discoverTv({ ...genreParam, sort_by: 'first_air_date.desc', 'vote_count.gte': 15 })),
      ])
        .then(async ([popRes, topRes, recentRes]) => {
          if (!active) return;

          const category = currentGenre?.id === 'anime' ? 'anime' : 'tv';
          const popularItems = uniqueTv(popRes?.results ?? [], category);
          const topItems = uniqueTv(topRes?.results ?? [], category);
          const recentItems = uniqueTv(recentRes?.results ?? [], category);

          const rankedPool = dedupeMedia([...popularItems, ...topItems], 10);
          const topTenIds = new Set(rankedPool.map((i) => String(i.id)));

          const candidateIds = new Set<number>();
          [...rankedPool, ...recentItems.slice(0, 6)].forEach((item) => {
            if (item.tmdbId) candidateIds.add(item.tmdbId);
          });

          const detailsMap = new Map<number, TmdbTvDetails>();
          await Promise.allSettled(
            Array.from(candidateIds).map(async (id) => {
              try {
                const d = await tmdbClient.getTvDetails(id);
                detailsMap.set(id, d);
              } catch {
                // Ignore failure
              }
            }),
          );

          if (!active) return;

          const heroCandidate =
            popularItems.find((i) => i.backdropUrl) ??
            rankedPool.find((i) => i.backdropUrl) ??
            popularItems[0];

          const enrichedHero = heroCandidate
            ? enrichTv(heroCandidate, detailsMap, topTenIds)
            : null;

          const enrichedTopTen = rankedPool.map((i) => enrichTv(i, detailsMap, topTenIds));

          const genreTitle = currentGenre?.name ?? 'Shows';
          const nextRows: MediaRowModel[] = [
            { id: 'genre-popular', title: `Popular in ${genreTitle}`, items: popularItems.map((i) => enrichTv(i, detailsMap, topTenIds)), emphasis: 'featured' as const },
            { id: 'genre-top-rated', title: `Critically Acclaimed ${genreTitle}`, items: topItems.map((i) => enrichTv(i, detailsMap, topTenIds)) },
            { id: 'genre-recent', title: `Fresh & New in ${genreTitle}`, items: recentItems.map((i) => enrichTv(i, detailsMap, topTenIds)), emphasis: 'compact' as const },
          ].filter((r) => r.items.length > 0);

          showsCache.set(selectedGenreId, {
            hero: enrichedHero,
            topTen: enrichedTopTen,
            rows: nextRows,
          });
          setHero(enrichedHero);
          setTopTen(enrichedTopTen);
          setRows(nextRows);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : `Unable to load ${currentGenre?.name ?? 'Shows'}.`);
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [selectedGenreId, currentGenre]);

  return (
    <main className="browse-page" id="main-content">
      <CategoryHeader
        genres={TV_GENRES}
        onSelectGenre={(genre) => setSelectedGenreId(genre.id)}
        selectedGenreId={selectedGenreId}
        title="TV Shows"
      />

      {isLoading ? (
        <BrowseSkeleton />
      ) : error || !hero ? (
        <div className="catalog-error">
          <div>
            <h1>Shows Unavailable</h1>
            <p>{error || 'Could not load TV series right now.'}</p>
          </div>
        </div>
      ) : (
        <>
          <HeroBanner item={hero} />
          <div className="browse-catalog">
            {topTen.length > 0 && (
              <div className="top-ten-feature">
                <MediaRow
                  items={topTen}
                  mode="ranked"
                  title={selectedGenreId === 'all' ? 'Top 10 TV Shows Today' : `Top 10 in ${currentGenre?.name ?? 'TV Shows'} Today`}
                />
              </div>
            )}
            {rows.map((row) => (
              <MediaRow key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
