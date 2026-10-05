import {
  CLIENT_TIMEOUT_MS,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_PAGE_TEXT_LENGTH,
} from '@pdf-insight/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpAnalyzer } from './analyze-client';

const doc = { fileName: 'a.pdf', pages: 1, pageTexts: ['hello'], scannedPages: [] };
const okBody = {
  ok: true,
  result: {
    document: {
      fileName: 'a.pdf',
      pages: 1,
      language: 'en',
      type: 'inne',
      title: null,
      date: null,
    },
    summary: 'Hello.',
    keyPoints: [],
    entities: { organizations: [], people: [] },
    amounts: [],
    dates: [],
    keywords: [],
    meta: {
      id: 'ana_1',
      model: 'm',
      chunks: 1,
      scannedPages: [],
      warnings: [],
      durationMs: 5,
      analyzedAt: '2026-10-05T12:00:00.000Z',
    },
  },
};

/** A fetch that never answers and rejects as soon as its signal aborts. */
const hangingFetch = () =>
  vi
    .fn()
    .mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    );

describe('createHttpAnalyzer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('posts the request and returns the result', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 }));
    const result = await createHttpAnalyzer('https://api.example/analyze', { fetchImpl }).analyze(
      doc,
    );
    expect(result.summary).toBe('Hello.');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example/analyze');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(doc);
  });
  it('maps an api error envelope to an AnalysisError with its code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'rate_limited', message: 'slow', retryable: true },
        }),
        { status: 429 },
      ),
    );
    await expect(
      createHttpAnalyzer('https://api.example/analyze', { fetchImpl }).analyze(doc),
    ).rejects.toMatchObject({ code: 'rate_limited', retryable: true });
  });
  it('maps a network failure to network and a non-JSON body to invalid_response', async () => {
    await expect(
      createHttpAnalyzer('https://api.example/analyze', {
        fetchImpl: vi.fn().mockRejectedValue(new TypeError('failed')),
      }).analyze(doc),
    ).rejects.toMatchObject({ code: 'network', retryable: true });
    await expect(
      createHttpAnalyzer('https://api.example/analyze', {
        fetchImpl: vi.fn().mockResolvedValue(new Response('<html>', { status: 502 })),
      }).analyze(doc),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('aborts after the timeout', async () => {
    await expect(
      createHttpAnalyzer('https://api.example/analyze', {
        fetchImpl: hangingFetch(),
        timeoutMs: 10,
      }).analyze(doc),
    ).rejects.toMatchObject({ code: 'network' });
  });
  it('keeps the timeout armed while the body is read', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve({
        status: 200,
        json: () =>
          new Promise((_, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            ),
          ),
      }),
    );
    await expect(
      createHttpAnalyzer('https://api.example/analyze', { fetchImpl, timeoutMs: 20 }).analyze(doc),
    ).rejects.toMatchObject({ code: 'network', retryable: true });
  });
});

describe('createHttpAnalyzer default deadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 150 s, longer than the server budget, then fails with the retryable timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const failure = createHttpAnalyzer('https://api.example/analyze', {
      fetchImpl: hangingFetch(),
    }).analyze(doc);
    let settled = false;
    failure.catch(() => (settled = true));
    await vi.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(failure).rejects.toMatchObject({
      code: 'network',
      message: 'The analysis service stopped responding.',
      retryable: true,
    });
  });
});

describe('createHttpAnalyzer request check', () => {
  it('refuses a page whose text is over the cap before sending, naming the page and the cap', async () => {
    const fetchImpl = vi.fn();
    const long = { ...doc, pages: 2, pageTexts: ['hello', 'x'.repeat(MAX_PAGE_TEXT_LENGTH + 1)] };
    await expect(
      createHttpAnalyzer('https://api.example/analyze', { fetchImpl }).analyze(long),
    ).rejects.toMatchObject({
      code: 'page_too_large',
      retryable: false,
      params: { page: 2, max: MAX_PAGE_TEXT_LENGTH },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('sends a page whose text is exactly at the cap', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 }));
    const full = { ...doc, pageTexts: ['x'.repeat(MAX_PAGE_TEXT_LENGTH)] };
    await createHttpAnalyzer('https://api.example/analyze', { fetchImpl }).analyze(full);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('refuses any other request the API schema would reject, before sending', async () => {
    const fetchImpl = vi.fn();
    const hugeImage = {
      ...doc,
      pageTexts: [''],
      scannedPages: [{ page: 1, imageJpegBase64: 'x'.repeat(MAX_IMAGE_BASE64_LENGTH + 1) }],
    };
    await expect(
      createHttpAnalyzer('https://api.example/analyze', { fetchImpl }).analyze(hugeImage),
    ).rejects.toMatchObject({ code: 'invalid_request', retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
