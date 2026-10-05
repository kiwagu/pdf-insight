import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_BUDGET_MS,
  analyzeRequestSchema,
  analyzeResponseSchema,
  CLIENT_TIMEOUT_MS,
  MAX_SCANNED_PAGES,
} from './api.schema.ts';

describe('analyzeRequestSchema', () => {
  const base = { fileName: 'a.pdf', pages: 2, pageTexts: ['hello', ''] };
  it('accepts a text-only request', () => {
    expect(analyzeRequestSchema.safeParse(base).success).toBe(true);
  });
  it('requires one text entry per page', () => {
    expect(analyzeRequestSchema.safeParse({ ...base, pages: 3 }).success).toBe(false);
  });
  it(`caps scanned pages at ${MAX_SCANNED_PAGES}`, () => {
    const scannedPages = Array.from({ length: MAX_SCANNED_PAGES + 1 }, (_, i) => ({
      page: i + 1,
      imageJpegBase64: 'AAAA',
    }));
    expect(
      analyzeRequestSchema.safeParse({
        ...base,
        pages: 6,
        pageTexts: ['', '', '', '', '', ''],
        scannedPages,
      }).success,
    ).toBe(false);
  });
  it('rejects a scanned page outside the page range', () => {
    expect(
      analyzeRequestSchema.safeParse({
        ...base,
        scannedPages: [{ page: 9, imageJpegBase64: 'AAAA' }],
      }).success,
    ).toBe(false);
  });
});

describe('analyzeResponseSchema', () => {
  it('accepts an error envelope', () => {
    const r = analyzeResponseSchema.safeParse({
      ok: false,
      error: { code: 'rate_limited', message: 'slow down', retryable: true },
    });
    expect(r.success).toBe(true);
  });
  it('accepts the timeout error of a spent analysis budget', () => {
    const r = analyzeResponseSchema.safeParse({
      ok: false,
      error: { code: 'analysis_timeout', message: 'too slow', retryable: true },
    });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown error code', () => {
    expect(
      analyzeResponseSchema.safeParse({
        ok: false,
        error: { code: 'boom', message: 'x', retryable: false },
      }).success,
    ).toBe(false);
  });
});

describe('time budget', () => {
  it('gives the server 140 s and lets the browser wait 10 s longer for the answer', () => {
    expect(ANALYSIS_BUDGET_MS).toBe(140_000);
    expect(CLIENT_TIMEOUT_MS).toBe(150_000);
  });
});
