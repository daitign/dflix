import { createTmdbRequestHandler } from '../server/tmdbProxy.mjs';

const tmdbHandler = createTmdbRequestHandler({
  accessToken: process.env.TMDB_ACCESS_TOKEN,
  apiKey: process.env.TMDB_API_KEY,
  language: process.env.VITE_TMDB_LANGUAGE || 'en-US',
  region: process.env.VITE_TMDB_REGION || 'PH',
});

export default tmdbHandler;
