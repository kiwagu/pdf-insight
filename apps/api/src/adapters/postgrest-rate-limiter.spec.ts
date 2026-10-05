import { describe, expect, it, vi } from 'vitest';
import { createPostgrestRateLimiter } from './postgrest-rate-limiter.ts';

const options = {
  supabaseUrl: 'https://x.supabase.co',
  serviceRoleKey: 'srv',
  limit: 10,
  windowSeconds: 60,
};

describe('createPostgrestRateLimiter', () => {
  it('calls the rpc with the service-role headers and maps the row', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ allowed: false, retry_after_seconds: 42 }]), {
        status: 200,
      }),
    );
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
  });
  it('fails open when the rpc is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('down'));
    const limiter = createPostgrestRateLimiter({ ...options, fetchImpl });
    await expect(limiter.consume('k')).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
