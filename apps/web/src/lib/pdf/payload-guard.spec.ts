import { describe, expect, it } from 'vitest';
import { estimateRequestBytes, exceedsPayloadCap, MAX_REQUEST_BYTES } from './payload-guard';

describe('payload guard', () => {
  it('counts text and image base64 lengths', () => {
    const bytes = estimateRequestBytes({
      fileName: 'a.pdf',
      pages: 2,
      pageTexts: ['abcd', 'ef'],
      scannedPages: [{ page: 2, imageJpegBase64: 'x'.repeat(100) }],
    });
    expect(bytes).toBeGreaterThan(106);
    expect(bytes).toBeLessThan(400);
  });
  it('flags a document whose images alone exceed the cap', () => {
    const doc = {
      fileName: 'a.pdf',
      pages: 5,
      pageTexts: ['', '', '', '', ''],
      scannedPages: Array.from({ length: 5 }, (_, i) => ({
        page: i + 1,
        imageJpegBase64: 'x'.repeat(MAX_REQUEST_BYTES / 4),
      })),
    };
    expect(exceedsPayloadCap(doc)).toBe(true);
  });
  it('counts UTF-8 bytes, not characters', () => {
    const withText = (text: string) => ({
      fileName: 'a.pdf',
      pages: 1,
      pageTexts: [text],
      scannedPages: [],
    });
    const polish = 'zażółć gęślą jaźń';
    const ascii = 'zazolc gesla jazn';
    expect(polish.length).toBe(ascii.length);
    expect(estimateRequestBytes(withText(polish)) - estimateRequestBytes(withText(ascii))).toBe(9);
  });
  it('allows a document just under the cap and refuses it one 2-byte character later', () => {
    const withText = (text: string) => ({
      fileName: 'a.pdf',
      pages: 1,
      pageTexts: [text],
      scannedPages: [],
    });
    const overhead = estimateRequestBytes(withText(''));
    const underCap = 'a'.repeat(MAX_REQUEST_BYTES - overhead - 1);
    expect(estimateRequestBytes(withText(underCap))).toBe(MAX_REQUEST_BYTES - 1);
    expect(exceedsPayloadCap(withText(underCap))).toBe(false);
    expect(exceedsPayloadCap(withText(`${underCap}ż`))).toBe(true);
  });
});
