import type { IncomingMessage, ServerResponse } from 'node:http';

interface TmdbCredentials {
  accessToken?: string;
  apiKey?: string;
  language?: string;
  region?: string;
}

export function createTmdbRequestHandler(credentials: TmdbCredentials): (
  request: IncomingMessage,
  response: ServerResponse,
  next?: () => void,
) => Promise<void> | void;
