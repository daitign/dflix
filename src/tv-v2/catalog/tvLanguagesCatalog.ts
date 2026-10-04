import type { MediaItem } from '../../features/catalog/types.ts';

export interface TvLanguageOption {
  code: string;
  id: string;
  name: string;
}

export interface TvPreferenceMode {
  id: string;
  label: string;
}

export const TV_PREFERENCE_MODES: TvPreferenceMode[] = [
  { id: 'original', label: 'Original Language' },
  { id: 'dubbing', label: 'Dubbing' },
  { id: 'subtitles', label: 'Subtitles' },
];

export const TV_LANGUAGES: TvLanguageOption[] = [
  { code: 'en', id: 'english', name: 'English' },
  { code: 'tl', id: 'filipino', name: 'Filipino' },
  { code: 'ko', id: 'korean', name: 'Korean' },
  { code: 'ja', id: 'japanese', name: 'Japanese' },
  { code: 'es', id: 'spanish', name: 'Spanish' },
  { code: 'fr', id: 'french', name: 'French' },
  { code: 'hi', id: 'hindi', name: 'Hindi' },
  { code: 'zh', id: 'chinese', name: 'Chinese' },
  { code: 'th', id: 'thai', name: 'Thai' },
  { code: 'de', id: 'german', name: 'German' },
  { code: 'it', id: 'italian', name: 'Italian' },
  { code: 'id', id: 'indonesian', name: 'Indonesian' },
];

async function getTmdb() {
  try {
    const [clientMod, adaptersMod] = await Promise.all([
      import('../../lib/tmdb/client'),
      import('../../lib/tmdb/adapters'),
    ]);
    return {
      normalizeTmdbMovie: adaptersMod.normalizeTmdbMovie,
      normalizeTmdbTv: adaptersMod.normalizeTmdbTv,
      tmdbClient: clientMod.tmdbClient,
    };
  } catch {
    return null;
  }
}

function uniqueValid(items: Array<MediaItem | null>, limit = 36): MediaItem[] {
  const unique = new Map<string, MediaItem>();
  items.forEach((item) => {
    if (!item || !item.title || (!item.posterUrl && !item.backdropUrl)) return;
    unique.set(String(item.id), item);
  });
  return [...unique.values()].slice(0, limit);
}

const languageCache = new Map<string, MediaItem[]>();

export async function fetchTvLanguageCatalog(
  langCode: string,
  mode = 'original'
): Promise<MediaItem[]> {
  const cacheKey = `${mode}:${langCode}`;
  const cached = languageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const tmdb = await getTmdb();
  if (!tmdb) {
    return [];
  }

  const { tmdbClient, normalizeTmdbMovie, normalizeTmdbTv } = tmdb;

  const safely = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch {
      return null;
    }
  };

  try {
    const [moviesRes, tvRes] = await Promise.all([
      safely(
        tmdbClient.discoverMovies({
          sort_by: 'popularity.desc',
          with_original_language: langCode,
        })
      ),
      safely(
        tmdbClient.discoverTv({
          sort_by: 'popularity.desc',
          with_original_language: langCode,
        })
      ),
    ]);

    const movies = (moviesRes?.results ?? []).map((i: any) => normalizeTmdbMovie(i));
    const tvShows = (tvRes?.results ?? []).map((i: any) => normalizeTmdbTv(i));

    const combined: MediaItem[] = [];
    const maxLen = Math.max(movies.length, tvShows.length);
    for (let i = 0; i < maxLen; i++) {
      const m = movies[i];
      if (m) combined.push(m);
      const t = tvShows[i];
      if (t) combined.push(t);
    }

    const results = uniqueValid(combined);
    languageCache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

export function clearLanguageCatalogCache(): void {
  languageCache.clear();
}
