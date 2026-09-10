export interface TmdbLocaleConfig {
  language: string;
  region: string;
}

const localeConfig: TmdbLocaleConfig = {
  language: import.meta.env.VITE_TMDB_LANGUAGE || 'en-US',
  region: import.meta.env.VITE_TMDB_REGION || 'PH',
};

export function configureTmdbLocale(config: Partial<TmdbLocaleConfig>) {
  if (config.language) localeConfig.language = config.language;
  if (config.region) localeConfig.region = config.region;
}

export function getTmdbLocale(): Readonly<TmdbLocaleConfig> {
  return localeConfig;
}
