export interface CorsResolution {
  allowed: boolean;
  headers: Record<string, string>;
}

/** Exact-match allow-list: no wildcards, no suffix matching, and no CORS headers on a denial. */
export function resolveCors(origin: string | null, allowedOrigins: string[]): CorsResolution {
  if (origin === null || !allowedOrigins.includes(origin)) return { allowed: false, headers: {} };
  return {
    allowed: true,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-request-id',
      'access-control-expose-headers': 'x-request-id, retry-after',
      'access-control-max-age': '600',
      vary: 'Origin',
    },
  };
}
