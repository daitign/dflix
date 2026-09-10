import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createTmdbRequestHandler } from './server/tmdbProxy.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const tmdbHandler = createTmdbRequestHandler({
    accessToken: env.TMDB_ACCESS_TOKEN,
    apiKey: env.TMDB_API_KEY,
    language: env.VITE_TMDB_LANGUAGE || 'en-US',
    region: env.VITE_TMDB_REGION || 'PH',
  });

  return {
    plugins: [
      react(),
      {
        name: 'daitign-tmdb-proxy',
        configureServer(server) {
          server.middlewares.use(tmdbHandler);
        },
        configurePreviewServer(server) {
          server.middlewares.use(tmdbHandler);
        },
      },
    ],
    server: {
      host: true,
    },
  };
});
