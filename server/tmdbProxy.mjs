const TMDB_API_ORIGIN = 'https://api.themoviedb.org/3';
const MAX_CACHE_ENTRIES = 180;
const responseCache = new Map();
const inFlightRequests = new Map();

const endpointPatterns = [
  /^\/trending\/(all|movie|tv)\/(day|week)$/,
  /^\/movie\/(popular|now_playing|upcoming|top_rated)$/,
  /^\/tv\/(popular|top_rated|on_the_air|airing_today)$/,
  /^\/movie\/\d+$/,
  /^\/tv\/\d+$/,
  /^\/(movie|tv)\/\d+\/videos$/,
  /^\/tv\/\d+\/season\/\d+$/,
  /^\/discover\/(movie|tv)$/,
  /^\/search\/multi$/,
];

const forwardedQueryKeys = new Set([
  'append_to_response',
  'include_adult',
  'include_image_language',
  'language',
  'page',
  'query',
  'region',
  'sort_by',
  'vote_count.gte',
  'with_genres',
  'with_original_language',
]);

function isAllowedEndpoint(endpoint) {
  return endpointPatterns.some((pattern) => pattern.test(endpoint));
}

function cacheDuration(endpoint) {
  if (endpoint.startsWith('/search/')) return 2 * 60_000;
  if (/^\/(movie|tv)\/\d+/.test(endpoint)) return 60 * 60_000;
  return 10 * 60_000;
}

function pruneCache() {
  if (responseCache.size <= MAX_CACHE_ENTRIES) return;
  const oldestKey = responseCache.keys().next().value;
  if (oldestKey) responseCache.delete(oldestKey);
}

function sendJson(response, status, payload, cacheControl = 'no-store') {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', cacheControl);
  response.end(JSON.stringify(payload));
}

async function fetchTmdb(url, credentials) {
  const requestUrl = new URL(url);
  const headers = { Accept: 'application/json' };
  if (credentials.accessToken) {
    headers.Authorization = `Bearer ${credentials.accessToken}`;
  } else if (credentials.apiKey) {
    requestUrl.searchParams.set('api_key', credentials.apiKey);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(requestUrl, { headers, signal: controller.signal });
    const body = await response.text();
    return {
      body,
      contentType: response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      status: response.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function createTmdbRequestHandler(credentials) {
  return async function tmdbRequestHandler(request, response, next) {
    const incomingUrl = new URL(request.url ?? '/', 'http://localhost');
    if (incomingUrl.pathname !== '/api/tmdb') {
      next?.();
      return;
    }

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Only GET requests are supported.' });
      return;
    }

    if (!credentials.accessToken && !credentials.apiKey) {
      sendJson(response, 503, {
        code: 'TMDB_NOT_CONFIGURED',
        error: 'TMDB is not configured on this server.',
      });
      return;
    }

    const endpoint = incomingUrl.searchParams.get('endpoint') ?? '';
    if (!isAllowedEndpoint(endpoint)) {
      sendJson(response, 400, { error: 'Unsupported TMDB endpoint.' });
      return;
    }

    const target = new URL(`${TMDB_API_ORIGIN}${endpoint}`);
    for (const [key, value] of incomingUrl.searchParams) {
      if (forwardedQueryKeys.has(key) && value) target.searchParams.set(key, value);
    }
    if (!target.searchParams.has('language') && credentials.language) target.searchParams.set('language', credentials.language);
    if (!target.searchParams.has('region') && credentials.region) target.searchParams.set('region', credentials.region);

    const cacheKey = target.toString();
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      response.statusCode = cached.status;
      response.setHeader('Content-Type', cached.contentType);
      response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      response.setHeader('X-DAITIGN-Cache', 'HIT');
      response.end(cached.body);
      return;
    }

    try {
      let pending = inFlightRequests.get(cacheKey);
      if (!pending) {
        pending = fetchTmdb(target, credentials);
        inFlightRequests.set(cacheKey, pending);
      }
      const result = await pending;
      inFlightRequests.delete(cacheKey);

      if (result.status >= 200 && result.status < 300) {
        responseCache.set(cacheKey, {
          ...result,
          expiresAt: Date.now() + cacheDuration(endpoint),
        });
        pruneCache();
      }

      response.statusCode = result.status;
      response.setHeader('Content-Type', result.contentType);
      response.setHeader('Cache-Control', result.status < 300 ? 'public, max-age=60, stale-while-revalidate=300' : 'no-store');
      response.setHeader('X-DAITIGN-Cache', 'MISS');
      response.end(result.body);
    } catch (error) {
      inFlightRequests.delete(cacheKey);
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'The catalog service timed out.'
        : 'The catalog service is temporarily unavailable.';
      sendJson(response, 502, { error: message });
    }
  };
}
