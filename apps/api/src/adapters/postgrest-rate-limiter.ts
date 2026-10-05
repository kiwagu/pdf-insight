import { z } from 'zod';
import type { RateLimiter } from '../ports.ts';

interface Options {
  supabaseUrl: string;
  serviceRoleKey: string;
  limit: number;
  windowSeconds: number;
  /** Deadline for the request and the body read together; past it the limiter fails open. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 2000;

const rowsSchema = z
  .array(z.object({ allowed: z.boolean(), retry_after_seconds: z.number().int().min(0) }))
  .min(1);

/**
 * Fixed-window counter in Postgres. Fails open, with one error log, when the RPC is unreachable,
 * misses the deadline or answers with a malformed body: a database outage must not take the service
 * down with it.
 */
export function createPostgrestRateLimiter(options: Options): RateLimiter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call(key: string, signal: AbortSignal) {
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
      signal,
    });
    if (!response.ok) throw new Error(`rpc status ${response.status}`);
    const parsed = rowsSchema.safeParse(await response.json());
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new Error(`rpc returned a malformed body (${issues.join('; ')})`);
    }
    const [row] = parsed.data;
    if (!row) throw new Error('rpc returned no row');
    return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds };
  }

  return {
    async consume(key) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      // The race also covers a fetch or a body that ignores the abort signal.
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`rpc missed the ${timeoutMs} ms deadline`);
          controller.abort(error);
          reject(error);
        }, timeoutMs);
      });
      try {
        return await Promise.race([call(key, controller.signal), deadline]);
      } catch (error) {
        console.error(
          'rate limiter unavailable, failing open',
          error instanceof Error ? error.message : error,
        );
        return { allowed: true, retryAfterSeconds: 0 };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
