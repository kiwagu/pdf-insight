import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createPostgrestRateLimiter } from './postgrest-rate-limiter.ts';

const options = {
  supabaseUrl: 'https://x.supabase.co',
  serviceRoleKey: 'srv',
  limit: 10,
  windowSeconds: 60,
};

const FAIL_OPEN = { allowed: true, retryAfterSeconds: 0 };

const rows = (body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('createPostgrestRateLimiter', () => {
  it('calls the rpc with the service-role headers and maps the row', async () => {
    const fetchImpl = rows([{ allowed: false, retry_after_seconds: 42 }]);
    const limiter = createPostgrestRateLimiter({ ...options, fetchImpl });
    await expect(limiter.consume('1.2.3.4')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 42,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x.supabase.co/rest/v1/rpc/consume_rate_limit');
    expect(new Headers(init.headers).get('apikey')).toBe('srv');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer srv');
    expect(JSON.parse(init.body as string)).toEqual({
      p_key: '1.2.3.4',
      p_limit: 10,
      p_window_seconds: 60,
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
  it('fails open with one error log when the rpc is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('down'));
    const limiter = createPostgrestRateLimiter({ ...options, fetchImpl });
    await expect(limiter.consume('k')).resolves.toEqual(FAIL_OPEN);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
  it('fails open with one error log when the request never answers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    const limiter = createPostgrestRateLimiter({ ...options, fetchImpl, timeoutMs: 20 });
    await expect(limiter.consume('k')).resolves.toEqual(FAIL_OPEN);
    expect(consoleError).toHaveBeenCalledTimes(1);
    const signal = fetchImpl.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
  }, 1000);
  it('fails open with one error log when the response body never ends', async () => {
    const endless = new ReadableStream<Uint8Array>({ start: () => undefined });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(endless));
    const limiter = createPostgrestRateLimiter({ ...options, fetchImpl, timeoutMs: 20 });
    await expect(limiter.consume('k')).resolves.toEqual(FAIL_OPEN);
    expect(consoleError).toHaveBeenCalledTimes(1);
  }, 1000);
  it('fails open with one error log on a malformed rpc body', async () => {
    for (const body of [
      [{}],
      [{ allowed: 'false', retry_after_seconds: 1 }],
      [{ allowed: false, retry_after_seconds: -1 }],
      [],
      { allowed: false, retry_after_seconds: 1 },
    ]) {
      consoleError.mockClear();
      const limiter = createPostgrestRateLimiter({ ...options, fetchImpl: rows(body) });
      await expect(limiter.consume('k')).resolves.toEqual(FAIL_OPEN);
      expect(consoleError).toHaveBeenCalledTimes(1);
    }
  });
});
