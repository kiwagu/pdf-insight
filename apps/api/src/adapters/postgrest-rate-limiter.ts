import type { RateLimiter } from '../ports.ts';

interface Options {
  supabaseUrl: string;
  serviceRoleKey: string;
  limit: number;
  windowSeconds: number;
  fetchImpl?: typeof fetch;
}

interface Row {
  allowed: boolean;
  retry_after_seconds: number;
}

/** Fixed-window counter in Postgres. Fails open: a database outage must not take the service down with it. */
export function createPostgrestRateLimiter(options: Options): RateLimiter {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async consume(key) {
      try {
        const response = await fetchImpl(`${options.supabaseUrl}/rest/v1/rpc/consume_rate_limit`, {
          method: 'POST',
          headers: {
            apikey: options.serviceRoleKey,
            authorization: `Bearer ${options.serviceRoleKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            p_key: key,
            p_limit: options.limit,
            p_window_seconds: options.windowSeconds,
          }),
        });
        if (!response.ok) throw new Error(`rpc status ${response.status}`);
        const rows = (await response.json()) as Row[];
        const row = rows[0];
        if (!row) throw new Error('rpc returned no row');
        return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds };
      } catch (error) {
        console.error(
          'rate limiter unavailable, failing open',
          error instanceof Error ? error.message : error,
        );
        return { allowed: true, retryAfterSeconds: 0 };
      }
    },
  };
}
