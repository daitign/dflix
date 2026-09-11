import { useEffect, useState } from 'react';
import { Container } from '../../components/layout/Container';
import { tmdbClient } from '../../lib/tmdb/client';
import { normalizeTmdbMovie, normalizeTmdbTv } from '../../lib/tmdb/adapters';
import type { MediaItem, MediaRowModel } from '../catalog/types';
import { BrowseSkeleton } from '../home/components/BrowseSkeleton';
import { HeroBanner } from '../home/components/HeroBanner';
import { MediaRow } from '../home/components/MediaRow';
import './LanguagesPage.css';

interface LanguageOption {
  code: string;
  id: string;
  name: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', id: 'english', name: 'English' },
  { code: 'ko', id: 'korean', name: 'Korean' },
  { code: 'ja', id: 'japanese', name: 'Japanese' },
  { code: 'tl', id: 'filipino', name: 'Filipino' },
  { code: 'es', id: 'spanish', name: 'Spanish' },
  { code: 'fr', id: 'french', name: 'French' },
  { code: 'hi', id: 'hindi', name: 'Hindi' },
  { code: 'zh', id: 'chinese', name: 'Chinese' },
];

function uniqueValid(items: Array<MediaItem | null>, limit = 18): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

export function LanguagesPage() {
  const [selectedLang, setSelectedLang] = useState<LanguageOption>(LANGUAGES[0]);
  const [hero, setHero] = useState<MediaItem | null>(null);
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
      safely(tmdbClient.discoverMovies({ with_original_language: selectedLang.code, sort_by: 'popularity.desc' })),
      safely(tmdbClient.discoverTv({ with_original_language: selectedLang.code, sort_by: 'popularity.desc' })),
      safely(tmdbClient.discoverMovies({ with_original_language: selectedLang.code, sort_by: 'vote_average.desc', 'vote_count.gte': 100 })),
      safely(tmdbClient.discoverTv({ with_original_language: selectedLang.code, sort_by: 'vote_average.desc', 'vote_count.gte': 80 })),
    ])
      .then(([moviesRes, tvRes, topMoviesRes, topTvRes]) => {
        if (!active) return;

        const movies = uniqueValid((moviesRes?.results ?? []).map((i) => normalizeTmdbMovie(i)));
        const tvShows = uniqueValid((tvRes?.results ?? []).map((i) => normalizeTmdbTv(i)));
        const topMovies = uniqueValid((topMoviesRes?.results ?? []).map((i) => normalizeTmdbMovie(i)));
        const topTv = uniqueValid((topTvRes?.results ?? []).map((i) => normalizeTmdbTv(i)));

        const combinedPool = [...movies, ...tvShows];
        const heroCandidate = combinedPool.find((i) => i.backdropUrl) ?? combinedPool[0];

        const nextRows: MediaRowModel[] = [
          {
            id: 'popular-movies-lang',
            title: `Popular ${selectedLang.name} Movies`,
            items: movies,
            emphasis: 'featured' as const,
          },
          {
            id: 'popular-series-lang',
            title: `Popular ${selectedLang.name} Series`,
            items: tvShows,
          },
          {
            id: 'top-movies-lang',
            title: `Acclaimed ${selectedLang.name} Cinema`,
            items: topMovies,
            emphasis: 'compact' as const,
          },
          {
            id: 'top-tv-lang',
            title: `Top Rated ${selectedLang.name} TV`,
            items: topTv,
            emphasis: 'compact' as const,
          },
        ].filter((r) => r.items.length > 0);

        setHero(heroCandidate ?? null);
        setRows(nextRows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : `Failed to load ${selectedLang.name} titles.`);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedLang]);

  return (
    <main className="languages-page" id="main-content">
      <Container>
        <header className="languages-page__header">
          <h1>Browse by Languages</h1>
          <div aria-label="Select language" className="languages-page__selector" role="tablist">
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLang.id === lang.id;
              return (
                <button
                  aria-selected={isSelected}
                  className={`languages-page__pill ${isSelected ? 'languages-page__pill--active' : ''}`}
                  key={lang.id}
                  onClick={() => setSelectedLang(lang)}
                  role="tab"
                  type="button"
                >
                  {lang.name}
                </button>
              );
            })}
          </div>
        </header>
      </Container>

      {isLoading ? (
        <BrowseSkeleton />
      ) : error || !hero ? (
        <Container>
          <div style={{ padding: '3rem 0', color: '#a3a3a3' }}>
            <p>{error || `No titles found in ${selectedLang.name}. Try another language.`}</p>
          </div>
        </Container>
      ) : (
        <>
          <HeroBanner item={hero} />
          <div className="browse-catalog">
            {rows.map((row) => (
              <MediaRow key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
