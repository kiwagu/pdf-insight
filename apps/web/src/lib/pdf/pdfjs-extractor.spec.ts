import type { ExtractedDocument, TextExtractor } from '@pdf-insight/domain';
import { describe, expect, it, vi } from 'vitest';
import { createPdfJsImpl } from './pdfjs-impl';
import { createPdfJsExtractor } from './pdfjs-extractor';

const doc: ExtractedDocument = {
  fileName: 'a.pdf',
  pages: 1,
  pageTexts: ['text'],
  scannedPages: [],
};
const extract = vi.fn<TextExtractor['extract']>().mockResolvedValue(doc);

vi.mock('./pdfjs-impl', () => ({ createPdfJsImpl: vi.fn(() => ({ extract })) }));

describe('createPdfJsExtractor', () => {
  it('loads pdf.js on the first extraction only and delegates to it', async () => {
    const extractor = createPdfJsExtractor();
    expect(createPdfJsImpl).not.toHaveBeenCalled();
    const file = new File(['%PDF-1.4'], 'a.pdf');
    await expect(extractor.extract(file, { maxScannedPages: 5 })).resolves.toBe(doc);
    await extractor.extract(file, { maxScannedPages: 5 });
    expect(createPdfJsImpl).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledWith(file, { maxScannedPages: 5 });
  });
});
