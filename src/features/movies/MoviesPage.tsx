import { useEffect, useState } from 'react';
import { tmdbClient } from '../../lib/tmdb/client';
import { normalizeTmdbMovie } from '../../lib/tmdb/adapters';
import type { TmdbMediaSummary } from '../../lib/tmdb/types';
import { getFreshnessBadge } from '../catalog/freshness';
import type { MediaItem, MediaRowModel } from '../catalog/types';
import { BrowseSkeleton } from '../home/components/BrowseSkeleton';
import { HeroBanner } from '../home/components/HeroBanner';
import { MediaRow } from '../home/components/MediaRow';

function uniqueMovies(items: TmdbMediaSummary[], limit = 18): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    const normalized = normalizeTmdbMovie(item);
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

function enrichMovie(item: MediaItem, topTenIds: Set<string>): MediaItem {
  const badge = getFreshnessBadge(item);
  return {
    ...item,
    badge,
    inTopTen: topTenIds.has(String(item.id)),
  };
}

export function MoviesPage() {
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
      safely(tmdbClient.getTrendingMovies()),
      safely(tmdbClient.getPopularMovies()),
      safely(tmdbClient.getNowPlayingMovies()),
      safely(tmdbClient.getUpcomingMovies()),
      safely(tmdbClient.getTopRatedMovies()),
      safely(tmdbClient.discoverMovies({ with_genres: 28 })), // Action
      safely(tmdbClient.discoverMovies({ with_genres: 35 })), // Comedy
      safely(tmdbClient.discoverMovies({ with_genres: 27 })), // Horror
      safely(tmdbClient.discoverMovies({ with_genres: 10749 })), // Romance
      safely(tmdbClient.discoverMovies({ with_genres: 878 })), // Sci-Fi
      safely(tmdbClient.discoverMovies({ with_genres: 53 })), // Thriller
    ])
      .then(([
        trending,
        popular,
        nowPlaying,
        upcoming,
        topRated,
        action,
        comedy,
        horror,
        romance,
        sciFi,
        thriller,
      ]) => {
        if (!active) return;

        const trendingItems = uniqueMovies(trending?.results ?? []);
        const popularItems = uniqueMovies(popular?.results ?? []);
        const nowPlayingItems = uniqueMovies(nowPlaying?.results ?? []);
        const upcomingItems = uniqueMovies(upcoming?.results ?? []);
        const topRatedItems = uniqueMovies(topRated?.results ?? []);
        const actionItems = uniqueMovies(action?.results ?? []);
        const comedyItems = uniqueMovies(comedy?.results ?? []);
        const horrorItems = uniqueMovies(horror?.results ?? []);
        const romanceItems = uniqueMovies(romance?.results ?? []);
        const sciFiItems = uniqueMovies(sciFi?.results ?? []);
        const thrillerItems = uniqueMovies(thriller?.results ?? []);

        const rankedPool = dedupeMedia([...trendingItems, ...popularItems], 10);
        const topTenIds = new Set(rankedPool.map((i) => String(i.id)));

        const heroCandidate = rankedPool.find((i) => i.backdropUrl) ?? rankedPool[0] ?? trendingItems[0];
        const enrichedHero = heroCandidate ? enrichMovie(heroCandidate, topTenIds) : null;
        const enrichedTopTen = rankedPool.map((i) => enrichMovie(i, topTenIds));

        // Find new releases
        const allMovies = [
          ...trendingItems,
          ...nowPlayingItems,
          ...popularItems,
        ].map((i) => enrichMovie(i, topTenIds));
        const newReleases = allMovies.filter((i) => i.badge === 'new' || i.badge === 'recently-added');

        const nextRows: MediaRowModel[] = [
          ...(newReleases.length > 0
            ? [{ id: 'new-releases', title: 'New Releases', items: newReleases, emphasis: 'featured' as const }]
            : []),
          { id: 'trending-movies', title: 'Trending Movies', items: trendingItems.map((i) => enrichMovie(i, topTenIds)), emphasis: 'featured' as const },
          { id: 'popular-movies', title: 'Popular on DAITIGN', items: popularItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'now-playing', title: 'Now Playing', items: nowPlayingItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'upcoming', title: 'Upcoming Movies', items: upcomingItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'top-rated', title: 'Critically Acclaimed Movies', items: topRatedItems.map((i) => enrichMovie(i, topTenIds)), emphasis: 'compact' as const },
          { id: 'action', title: 'Action & Adventure', items: actionItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'comedy', title: 'Comedies', items: comedyItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'horror', title: 'Horror Movies', items: horrorItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'romance', title: 'Romantic Movies', items: romanceItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'scifi', title: 'Sci-Fi & Fantasy', items: sciFiItems.map((i) => enrichMovie(i, topTenIds)) },
          { id: 'thriller', title: 'Thrillers', items: thrillerItems.map((i) => enrichMovie(i, topTenIds)) },
        ].filter((r) => r.items.length > 0);

        setHero(enrichedHero);
        setTopTen(enrichedTopTen);
        setRows(nextRows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load Movies catalog.');
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
          <h1>Movies Unavailable</h1>
          <p>{error || 'Could not load movies right now.'}</p>
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
            <MediaRow items={topTen} mode="ranked" title="Top 10 Movies Today" />
          </div>
        )}
        {rows.map((row) => (
          <MediaRow key={row.id} row={row} />
        ))}
      </div>
    </main>
  );
}
