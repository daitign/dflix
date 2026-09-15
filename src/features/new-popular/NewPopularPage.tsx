import { useEffect, useState } from 'react';
import { tmdbClient } from '../../lib/tmdb/client';
import { normalizeTmdbMixed, normalizeTmdbMovie, normalizeTmdbTv } from '../../lib/tmdb/adapters';
import type { TmdbTvDetails } from '../../lib/tmdb/types';
import { getFreshnessBadge } from '../catalog/freshness';
import type { MediaItem, MediaRowModel } from '../catalog/types';
import { BrowseSkeleton } from '../home/components/BrowseSkeleton';
import { HeroBanner } from '../home/components/HeroBanner';
import { MediaRow } from '../home/components/MediaRow';

function uniqueItems(items: Array<MediaItem | null>, limit = 18): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

function enrichTv(item: MediaItem, detailsMap: Map<number, TmdbTvDetails>): MediaItem {
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
  };

  const badge = getFreshnessBadge(itemWithDates);
  return { ...itemWithDates, badge };
}

function enrichMovie(item: MediaItem): MediaItem {
  const badge = getFreshnessBadge(item);
  return { ...item, badge };
}

interface NewPopularCacheData {
  hero: MediaItem | null;
  rows: MediaRowModel[];
}

let newPopularCache: NewPopularCacheData | null = null;

export function NewPopularPage() {
  const [hero, setHero] = useState<MediaItem | null>(() => newPopularCache?.hero ?? null);
  const [rows, setRows] = useState<MediaRowModel[]>(() => newPopularCache?.rows ?? []);
  const [isLoading, setIsLoading] = useState(() => !newPopularCache);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (newPopularCache) {
      setHero(newPopularCache.hero);
      setRows(newPopularCache.rows);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError('');

    const safely = async <T,>(p: Promise<T>): Promise<T | null> => {
      try { return await p; } catch { return null; }
    };

    Promise.all([
      safely(tmdbClient.getTrending()),
      safely(tmdbClient.getPopularMovies()),
      safely(tmdbClient.getPopularTv()),
      safely(tmdbClient.getNowPlayingMovies()),
      safely(tmdbClient.getOnTheAirTv()),
      safely(tmdbClient.getTopRatedMovies()),
      safely(tmdbClient.getTopRatedTv()),
    ])
      .then(async ([
        trending,
        popularMovies,
        popularTv,
        nowPlaying,
        onTheAir,
        topRatedMovies,
        topRatedTv,
      ]) => {
        if (!active) return;

        const trendingItems = uniqueItems((trending?.results ?? []).map((i) => normalizeTmdbMixed(i)));
        const popularMovieItems = uniqueItems((popularMovies?.results ?? []).map((i) => normalizeTmdbMovie(i)));
        const popularTvItems = uniqueItems((popularTv?.results ?? []).map((i) => normalizeTmdbTv(i)));
        const nowPlayingItems = uniqueItems((nowPlaying?.results ?? []).map((i) => normalizeTmdbMovie(i)));
        const onTheAirItems = uniqueItems((onTheAir?.results ?? []).map((i) => normalizeTmdbTv(i)));
        const topRatedMovieItems = uniqueItems((topRatedMovies?.results ?? []).map((i) => normalizeTmdbMovie(i)));
        const topRatedTvItems = uniqueItems((topRatedTv?.results ?? []).map((i) => normalizeTmdbTv(i)));

        // Enrich TV items with air dates for accurate freshness badge calculation
        const candidateTvIds = new Set<number>();
        [...popularTvItems, ...onTheAirItems].slice(0, 16).forEach((item) => {
          if (item.tmdbId) candidateTvIds.add(item.tmdbId);
        });

        const detailsMap = new Map<number, TmdbTvDetails>();
        await Promise.allSettled(
          Array.from(candidateTvIds).map(async (id) => {
            try {
              const d = await tmdbClient.getTvDetails(id);
              if (d) detailsMap.set(id, d);
            } catch {
              // ignore
            }
          }),
        );

        if (!active) return;

        const enrichedTvAll = [...popularTvItems, ...onTheAirItems].map((i) => enrichTv(i, detailsMap));
        const enrichedMoviesAll = [...nowPlayingItems, ...popularMovieItems].map(enrichMovie);

        // Separate strictly by badge:
        const newEpisodes = enrichedTvAll.filter((i) => i.badge === 'new-episode');
        const newSeasons = enrichedTvAll.filter((i) => i.badge === 'new-season');
        const newMovies = enrichedMoviesAll.filter((i) => i.badge === 'new' || i.badge === 'recently-added');

        const heroCandidate = trendingItems.find((i) => i.backdropUrl) ?? trendingItems[0];
        const enrichedHero = heroCandidate
          ? (heroCandidate.playbackType === 'movie' ? enrichMovie(heroCandidate) : enrichTv(heroCandidate, detailsMap))
          : null;

        const nextRows: MediaRowModel[] = [
          { id: 'trending', title: 'Trending Now', items: trendingItems, emphasis: 'featured' as const },
          ...(newMovies.length > 0
            ? [{ id: 'new-movies', title: 'New Movies', items: newMovies, emphasis: 'standard' as const }]
            : []),
          ...(newEpisodes.length > 0
            ? [{ id: 'new-episodes', title: 'New TV Episodes', items: newEpisodes, emphasis: 'standard' as const }]
            : []),
          ...(newSeasons.length > 0
            ? [{ id: 'new-seasons', title: 'New Seasons', items: newSeasons, emphasis: 'standard' as const }]
            : []),
          { id: 'popular-movies', title: 'Popular Movies', items: popularMovieItems },
          { id: 'popular-shows', title: 'Popular Shows', items: popularTvItems },
          {
            id: 'top-rated',
            title: 'Top Rated All-Time',
            emphasis: 'compact' as const,
            items: uniqueItems([...topRatedMovieItems.slice(0, 8), ...topRatedTvItems.slice(0, 8)]),
          },
        ].filter((r) => r.items.length > 0);

        newPopularCache = {
          hero: enrichedHero,
          rows: nextRows,
        };
        setHero(enrichedHero);
        setRows(nextRows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load New & Popular.');
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
          <h1>Content Unavailable</h1>
          <p>{error || 'Could not load new & popular titles.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="browse-page" id="main-content">
      <HeroBanner item={hero} />
      <div className="browse-catalog">
        {rows.map((row) => (
          <MediaRow key={row.id} row={row} />
        ))}
      </div>
    </main>
  );
}
