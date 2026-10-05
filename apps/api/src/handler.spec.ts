import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYSIS_BUDGET_MS, type AnalyzeResponse, type LlmAnalysis } from '@pdf-insight/contracts';
import {
  AnalysisTimeoutError,
  ModelOutputInvalidError,
  ModelUpstreamError,
  type ModelPort,
} from '@pdf-insight/domain';
import type { ApiEnv } from './env.ts';
import { createHandler } from './handler.ts';
import type { RateLimiter } from './ports.ts';

const env: ApiEnv = {
  ANTHROPIC_API_KEY: 'k',
  ALLOWED_ORIGINS: ['https://kiwagu.github.io'],
  LLM_MODEL: 'test-model',
  LLM_EFFORT: 'low',
  MAX_BODY_BYTES: 1000,
  RATE_LIMIT_PER_MINUTE: 10,
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 's',
};

const llm: LlmAnalysis = {
  document: { language: 'pl', type: 'umowa', title: 'Umowa', date: '2026-03-12' },
  summary: 'Umowa dotyczy CRM. Trwa 24 miesiace. Wynagrodzenie 184 500 PLN.',
  keyPoints: ['24 miesiace'],
  entities: { organizations: ['Nordwave'], people: [] },
  amounts: [{ value: 184500, currency: 'PLN', context: 'wynagrodzenie', page: 1 }],
  dates: [{ date: '2026-03-12', context: 'zawarcie', page: 1 }],
  keywords: ['CRM'],
};

const verdict = (allowed: boolean, retryAfterSeconds: number) =>
  vi.fn<RateLimiter['consume']>().mockResolvedValue({ allowed, retryAfterSeconds });
const okLimiter: RateLimiter = { consume: verdict(true, 0) };
const model = (
  analyzeChunk = vi.fn<ModelPort['analyzeChunk']>().mockResolvedValue(llm),
): ModelPort => ({ analyzeChunk, reduce: vi.fn<ModelPort['reduce']>().mockResolvedValue(llm) });

function handler(over: { model?: ModelPort; limiter?: RateLimiter; now?: () => Date } = {}) {
  return createHandler({
    env,
    model: over.model ?? model(),
    limiter: over.limiter ?? okLimiter,
    createRequestId: () => 'req_test',
    createAnalysisId: () => 'ana_test',
    now: over.now ?? (() => new Date('2026-10-05T12:00:00.000Z')),
  });
}

const body = JSON.stringify({
  fileName: 'umowa.pdf',
  pages: 1,
  pageTexts: ['Wynagrodzenie 184 500,00 zl netto'],
});
const post = (init: RequestInit = {}, origin: string | null = 'https://kiwagu.github.io') =>
  new Request('https://x.supabase.co/functions/v1/analyze', {
    method: 'POST',
    body,
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(origin ? { origin } : {}),
      ...(init.headers ?? {}),
    },
  });
const json = async (res: Response) => (await res.json()) as AnalyzeResponse;

describe('createHandler', () => {
  it('answers a preflight from an allowed origin with 204 and CORS headers', async () => {
    const res = await handler()(
      new Request('https://x.supabase.co/functions/v1/analyze', {
        method: 'OPTIONS',
        headers: { origin: 'https://kiwagu.github.io' },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://kiwagu.github.io');
  });
  it('rejects a foreign origin with 403 and no CORS headers, and never calls the model', async () => {
    const m = model();
    const res = await handler({ model: m })(post({}, 'https://evil.example'));
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(m.analyzeChunk).not.toHaveBeenCalled();
  });
  it('rejects a request without an Origin header', async () => {
    expect((await handler()(post({}, null))).status).toBe(403);
  });
  it('serves healthz, consuming the limiter so the database sees activity', async () => {
    const limiter: RateLimiter = { consume: verdict(true, 0) };
    const res = await handler({ limiter })(
      new Request('https://x.supabase.co/functions/v1/analyze/healthz', {
        headers: { origin: 'https://kiwagu.github.io' },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(limiter.consume).toHaveBeenCalledWith('healthz');
  });
  it('returns 413 when content-length exceeds the cap', async () => {
    const res = await handler()(post({ headers: { 'content-length': '5000' } }));
    expect(res.status).toBe(413);
    await expect(json(res)).resolves.toMatchObject({
      ok: false,
      error: { code: 'payload_too_large' },
    });
  });
  it('returns 413 when the body itself exceeds the cap without a content-length', async () => {
    const m = model();
    const big = JSON.stringify({ fileName: 'a.pdf', pages: 1, pageTexts: ['x'.repeat(2000)] });
    const res = await handler({ model: m })(post({ body: big }));
    expect(res.status).toBe(413);
    expect(m.analyzeChunk).not.toHaveBeenCalled();
  });
  it('returns 400 on invalid JSON and on a schema violation', async () => {
    expect((await handler()(post({ body: '{not json' }))).status).toBe(400);
    const res = await handler()(
      post({ body: JSON.stringify({ fileName: 'a.pdf', pages: 2, pageTexts: ['x'] }) }),
    );
    expect(res.status).toBe(400);
    await expect(json(res)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_request', retryable: false },
    });
  });
  it('returns 429 with Retry-After when the limiter denies, keyed by the first forwarded ip', async () => {
    const limiter: RateLimiter = { consume: verdict(false, 37) };
    const res = await handler({ limiter })(
      post({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('37');
    expect(limiter.consume).toHaveBeenCalledWith('9.9.9.9');
  });
  it('returns the validated result with CORS and request id headers', async () => {
    const res = await handler()(post());
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req_test');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://kiwagu.github.io');
    const answer = await json(res);
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.result.document).toMatchObject({
      fileName: 'umowa.pdf',
      pages: 1,
      language: 'pl',
    });
    expect(answer.result.meta).toMatchObject({ id: 'ana_test', model: 'test-model', chunks: 1 });
  });
  it('retries once on invalid model output, then answers analysis_failed', async () => {
    const analyzeChunk = vi
      .fn<ModelPort['analyzeChunk']>()
      .mockRejectedValue(new ModelOutputInvalidError());
    const res = await handler({ model: model(analyzeChunk) })(post());
    expect(analyzeChunk).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(502);
    await expect(json(res)).resolves.toMatchObject({
      ok: false,
      error: { code: 'analysis_failed', retryable: true },
    });
  });
  it('maps a non-retryable upstream failure to upstream_error without retrying', async () => {
    const analyzeChunk = vi
      .fn<ModelPort['analyzeChunk']>()
      .mockRejectedValue(new ModelUpstreamError('invalid api key', false));
    const res = await handler({ model: model(analyzeChunk) })(post());
    expect(analyzeChunk).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(503);
    await expect(json(res)).resolves.toMatchObject({
      ok: false,
      error: { code: 'upstream_error', retryable: false },
    });
  });
});

describe('createHandler within the time budget', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A model call that never answers: it fails as a timeout once its own timeout has passed. */
  const hangingCall = (timeouts: number[]) =>
    vi.fn<ModelPort['analyzeChunk']>(
      (_input, { timeoutMs }) =>
        new Promise((_resolve, reject) => {
          timeouts.push(timeoutMs);
          setTimeout(() => reject(new AnalysisTimeoutError('timed out', true)), timeoutMs);
        }),
    );
  const answerTime = (pending: Promise<Response>, started: number) => {
    let at: number | undefined;
    void pending.then(() => (at = Date.now() - started));
    return () => at;
  };

  it('retries a hanging model call once and answers a retryable timeout within the budget', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const timeouts: number[] = [];
    const started = Date.now();
    const pending = handler({ model: model(hangingCall(timeouts)), now: () => new Date() })(post());
    const answeredAfter = answerTime(pending, started);
    await vi.advanceTimersByTimeAsync(ANALYSIS_BUDGET_MS);
    expect(timeouts).toEqual([60_000, 60_000]);
    expect(answeredAfter()).toBe(121_000);
    const res = await pending;
    expect(res.status).toBe(504);
    await expect(json(res)).resolves.toMatchObject({
      ok: false,
      error: { code: 'analysis_timeout', retryable: true },
    });
  });
  it('counts the budget from the arrival of the request', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const slowLimiter: RateLimiter = {
      consume: vi.fn<RateLimiter['consume']>(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ allowed: true, retryAfterSeconds: 0 }), 100_000),
          ),
      ),
    };
    const timeouts: number[] = [];
    const started = Date.now();
    const pending = handler({
      model: model(hangingCall(timeouts)),
      limiter: slowLimiter,
      now: () => new Date(),
    })(post());
    const answeredAfter = answerTime(pending, started);
    await vi.advanceTimersByTimeAsync(ANALYSIS_BUDGET_MS);
    expect(timeouts).toEqual([40_000]);
    expect(answeredAfter()).toBe(ANALYSIS_BUDGET_MS);
    expect((await pending).status).toBe(504);
  });
});

describe('createHandler budget before the analysis', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const timedAnswer = async (pending: Promise<Response>) => {
    const started = Date.now();
    let at: number | undefined;
    void pending.then(() => (at = Date.now() - started));
    await vi.advanceTimersByTimeAsync(ANALYSIS_BUDGET_MS + 60_000);
    return { res: await pending, at };
  };

  it('answers a retryable timeout when the rate limiter does not answer within the budget', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const m = model();
    const stuck: RateLimiter = {
      consume: vi.fn<RateLimiter['consume']>(() => new Promise(() => undefined)),
    };
    const { res, at } = await timedAnswer(
      handler({ model: m, limiter: stuck, now: () => new Date() })(post()),
    );
    expect(at).toBe(ANALYSIS_BUDGET_MS);
    expect(res.status).toBe(504);
    await expect(json(res)).resolves.toMatchObject({
      ok: false,
      error: { code: 'analysis_timeout', retryable: true },
    });
    expect(m.analyzeChunk).not.toHaveBeenCalled();
  });
  it('answers a retryable timeout when the request body stalls past the budget', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let cancelled = false;
    const stalled = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"fileName":'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const init: RequestInit & { duplex: 'half' } = { body: stalled, duplex: 'half' };
    const { res, at } = await timedAnswer(handler({ now: () => new Date() })(post(init)));
    expect(at).toBe(ANALYSIS_BUDGET_MS);
    expect(res.status).toBe(504);
    await expect(json(res)).resolves.toMatchObject({
      ok: false,
      error: { code: 'analysis_timeout', retryable: true },
    });
    expect(cancelled).toBe(true);
  });
  it('answers a retryable timeout when a model call outlives the budget it was given', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    // A model that ignores its call timeout: the handler still answers at the deadline.
    const deaf = vi.fn<ModelPort['analyzeChunk']>(() => new Promise(() => undefined));
    const { res, at } = await timedAnswer(
      handler({ model: model(deaf), now: () => new Date() })(post()),
    );
    expect(at).toBe(ANALYSIS_BUDGET_MS);
    expect(res.status).toBe(504);
  });
});
