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
});
