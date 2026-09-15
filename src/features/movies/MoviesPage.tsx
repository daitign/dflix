import { useEffect, useState } from 'react';
import { tmdbClient } from '../../lib/tmdb/client';
import { normalizeTmdbMovie } from '../../lib/tmdb/adapters';
import type { TmdbMediaSummary } from '../../lib/tmdb/types';
import { getFreshnessBadge } from '../catalog/freshness';
import type { MediaItem, MediaRowModel } from '../catalog/types';
import { BrowseSkeleton } from '../home/components/BrowseSkeleton';
import { HeroBanner } from '../home/components/HeroBanner';
import { MediaRow } from '../home/components/MediaRow';
import { CategoryHeader, type GenreOption } from '../../components/navigation/CategoryHeader';

export const MOVIE_GENRES: GenreOption[] = [
  { id: 'all', name: 'All Movies' },
  { id: 'action', name: 'Action', tmdbGenreId: 28 },
  { id: 'adventure', name: 'Adventure', tmdbGenreId: 12 },
  { id: 'animation', name: 'Animation & Anime', tmdbGenreId: 16 },
  { id: 'comedy', name: 'Comedies', tmdbGenreId: 35 },
  { id: 'crime', name: 'Crime', tmdbGenreId: 80 },
  { id: 'documentary', name: 'Documentaries', tmdbGenreId: 99 },
  { id: 'drama', name: 'Dramas', tmdbGenreId: 18 },
  { id: 'family', name: 'Family & Kids', tmdbGenreId: 10751 },
  { id: 'fantasy', name: 'Fantasy', tmdbGenreId: 14 },
  { id: 'history', name: 'Historical', tmdbGenreId: 36 },
  { id: 'horror', name: 'Horror', tmdbGenreId: 27 },
  { id: 'music', name: 'Music & Musicals', tmdbGenreId: 10402 },
  { id: 'mystery', name: 'Mystery', tmdbGenreId: 9648 },
  { id: 'romance', name: 'Romantic Movies', tmdbGenreId: 10749 },
  { id: 'scifi', name: 'Sci-Fi & Fantasy', tmdbGenreId: 878 },
  { id: 'thriller', name: 'Thrillers', tmdbGenreId: 53 },
  { id: 'war', name: 'War', tmdbGenreId: 10752 },
];

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

interface MoviesCacheData {
  hero: MediaItem | null;
  topTen: MediaItem[];
  rows: MediaRowModel[];
}

const moviesCache = new Map<string, MoviesCacheData>();

export function MoviesPage() {
  const [selectedGenreId, setSelectedGenreId] = useState('all');
  const [hero, setHero] = useState<MediaItem | null>(() => moviesCache.get('all')?.hero ?? null);
  const [topTen, setTopTen] = useState<MediaItem[]>(() => moviesCache.get('all')?.topTen ?? []);
  const [rows, setRows] = useState<MediaRowModel[]>(() => moviesCache.get('all')?.rows ?? []);
  const [isLoading, setIsLoading] = useState(() => !moviesCache.has('all'));
  const [error, setError] = useState('');

  const currentGenre = MOVIE_GENRES.find((g) => g.id === selectedGenreId);

  useEffect(() => {
    let active = true;
    const cached = moviesCache.get(selectedGenreId);
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
      // Full rich movies catalog
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

          const heroCandidate =
            trendingItems.find((i) => i.backdropUrl) ??
            popularItems.find((i) => i.backdropUrl) ??
            nowPlayingItems.find((i) => i.backdropUrl) ??
            trendingItems[0];

          const enrichedHero = heroCandidate ? enrichMovie(heroCandidate, topTenIds) : null;
          const enrichedTopTen = rankedPool.map((i) => enrichMovie(i, topTenIds));

          const nextRows: MediaRowModel[] = [
            { id: 'trending-movies', title: 'Trending Movies', items: trendingItems.map((i) => enrichMovie(i, topTenIds)), emphasis: 'featured' as const },
            { id: 'popular-movies', title: 'Popular on DAITIGN', items: popularItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'now-playing', title: 'Now Playing in Theaters', items: nowPlayingItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'upcoming', title: 'Worth the Wait', items: upcomingItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'top-rated', title: 'Critically Acclaimed Movies', items: topRatedItems.map((i) => enrichMovie(i, topTenIds)), emphasis: 'compact' as const },
            { id: 'action', title: 'Action Thrillers & Blockbusters', items: actionItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'comedy', title: 'Comedies', items: comedyItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'horror', title: 'Horror Movies', items: horrorItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'romance', title: 'Romantic Movies', items: romanceItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'scifi', title: 'Sci-Fi & Fantasy', items: sciFiItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'thriller', title: 'Thrillers', items: thrillerItems.map((i) => enrichMovie(i, topTenIds)) },
          ].filter((r) => r.items.length > 0);

          moviesCache.set(selectedGenreId, {
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
          setError(err instanceof Error ? err.message : 'Unable to load Movies catalog.');
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    } else {
      // Specific genre query
      const genreParam = currentGenre?.tmdbGenreId ? { with_genres: currentGenre.tmdbGenreId } : {};

      Promise.all([
        safely(tmdbClient.discoverMovies({ ...genreParam, sort_by: 'popularity.desc' })),
        safely(tmdbClient.discoverMovies({ ...genreParam, sort_by: 'vote_average.desc', 'vote_count.gte': 80 })),
        safely(tmdbClient.discoverMovies({ ...genreParam, sort_by: 'primary_release_date.desc', 'vote_count.gte': 20 })),
      ])
        .then(([popRes, topRes, recentRes]) => {
          if (!active) return;

          const popularItems = uniqueMovies(popRes?.results ?? []);
          const topItems = uniqueMovies(topRes?.results ?? []);
          const recentItems = uniqueMovies(recentRes?.results ?? []);

          const rankedPool = dedupeMedia([...popularItems, ...topItems], 10);
          const topTenIds = new Set(rankedPool.map((i) => String(i.id)));

          const heroCandidate =
            popularItems.find((i) => i.backdropUrl) ??
            rankedPool.find((i) => i.backdropUrl) ??
            popularItems[0];

          const enrichedHero = heroCandidate ? enrichMovie(heroCandidate, topTenIds) : null;
          const enrichedTopTen = rankedPool.map((i) => enrichMovie(i, topTenIds));

          const genreTitle = currentGenre?.name ?? 'Movies';
          const nextRows: MediaRowModel[] = [
            { id: 'genre-popular', title: `Popular in ${genreTitle}`, items: popularItems.map((i) => enrichMovie(i, topTenIds)), emphasis: 'featured' as const },
            { id: 'genre-top-rated', title: `Critically Acclaimed ${genreTitle}`, items: topItems.map((i) => enrichMovie(i, topTenIds)) },
            { id: 'genre-recent', title: `Fresh ${genreTitle} Releases`, items: recentItems.map((i) => enrichMovie(i, topTenIds)), emphasis: 'compact' as const },
          ].filter((r) => r.items.length > 0);

          moviesCache.set(selectedGenreId, {
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
          setError(err instanceof Error ? err.message : `Unable to load ${currentGenre?.name ?? 'Movies'}.`);
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
        genres={MOVIE_GENRES}
        onSelectGenre={(genre) => setSelectedGenreId(genre.id)}
        selectedGenreId={selectedGenreId}
        title="Movies"
      />

      {isLoading ? (
        <BrowseSkeleton />
      ) : error || !hero ? (
        <div className="catalog-error">
          <div>
            <h1>Movies Unavailable</h1>
            <p>{error || 'Could not load movies right now.'}</p>
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
                  title={selectedGenreId === 'all' ? 'Top 10 Movies Today' : `Top 10 in ${currentGenre?.name ?? 'Movies'} Today`}
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
