import { AnalysisError } from '@pdf-insight/domain';
import { describe, expect, it, vi } from 'vitest';
import { createPdfJsExtractor } from './pdfjs-extractor';

vi.mock('./pdfjs-impl', () => {
  throw new Error('chunk could not be fetched');
});

describe('createPdfJsExtractor when pdf.js cannot be loaded', () => {
  it('fails with a retryable network error', async () => {
    const error: unknown = await createPdfJsExtractor()
      .extract(new File(['%PDF-1.4'], 'a.pdf'), { maxScannedPages: 5 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AnalysisError);
    expect(error).toMatchObject({ code: 'network', retryable: true });
  });
});
