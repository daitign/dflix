import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { createTmdbRequestHandler } from './tmdbProxy.mjs';

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
}

const port = Number(process.env.PORT ?? 4173);
const distDirectory = join(process.cwd(), 'dist');
const tmdbHandler = createTmdbRequestHandler({
  accessToken: process.env.TMDB_ACCESS_TOKEN,
  apiKey: process.env.TMDB_API_KEY,
  language: process.env.VITE_TMDB_LANGUAGE || 'en-US',
  region: process.env.VITE_TMDB_REGION || 'PH',
});

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function serveFile(response, path) {
  response.statusCode = 200;
  response.setHeader('Content-Type', mimeTypes[extname(path)] ?? 'application/octet-stream');
  createReadStream(path).pipe(response);
}

const server = createServer((request, response) => {
  tmdbHandler(request, response, () => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const requestedPath = normalize(join(distDirectory, pathname));
    const safePath = requestedPath.startsWith(distDirectory) ? requestedPath : '';
    if (safePath && existsSync(safePath) && extname(safePath)) {
      serveFile(response, safePath);
      return;
    }

    const indexPath = join(distDirectory, 'index.html');
    if (existsSync(indexPath)) {
      serveFile(response, indexPath);
      return;
    }

    response.statusCode = 503;
    response.end('Build output is unavailable. Run npm run build first.');
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`DAITIGN Stream is available at http://127.0.0.1:${port}`);
});
