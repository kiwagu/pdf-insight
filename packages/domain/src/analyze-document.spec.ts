import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '@pdf-insight/contracts';
import { analyzeDocument, type AnalyzeDocumentDeps } from './analyze-document.ts';
import { AnalysisError } from './errors.ts';
import type { AnalysisHistory, DocumentAnalyzer, TextExtractor } from './ports.ts';

const result: AnalysisResult = {
  document: { fileName: 'a.pdf', pages: 1, language: 'pl', type: 'inne', title: null, date: null },
  summary: 'Krotki dokument.',
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
    durationMs: 1,
    analyzedAt: '2026-10-05T12:00:00.000Z',
  },
};

const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

function deps(over: { analyzer?: DocumentAnalyzer; extractor?: TextExtractor } = {}) {
  const history: AnalysisHistory = {
    list: vi.fn().mockReturnValue([]),
    save: vi.fn(),
    clear: vi.fn(),
  };
  const extractor: TextExtractor = over.extractor ?? {
    extract: vi.fn().mockResolvedValue({
      fileName: 'a.pdf',
      pages: 1,
      pageTexts: ['hello world, this document has a real text layer'],
      scannedPages: [],
    }),
  };
  const analyzer: DocumentAnalyzer = over.analyzer ?? {
    analyze: vi.fn().mockResolvedValue(result),
  };
  const onStage = vi.fn<AnalyzeDocumentDeps['onStage']>();
  return { deps: { extractor, analyzer, history, onStage, maxScannedPages: 5 }, history, onStage };
}

describe('analyzeDocument', () => {
  it('reports stages, validates the result and saves it to history', async () => {
    const { deps: d, history, onStage } = deps();
    const out = await analyzeDocument(file, d);
    expect(out).toEqual(result);
    expect(onStage.mock.calls.map((c) => c[0])).toEqual(['extracting', 'analyzing']);
    expect(history.save).toHaveBeenCalledWith({
      id: 'ana_1',
      fileName: 'a.pdf',
      analyzedAt: result.meta.analyzedAt,
      result,
    });
  });
  it('rejects a document with no readable text and no scanned pages before calling the analyzer', async () => {
    const { deps: d } = deps({
      extractor: {
        extract: vi
          .fn()
          .mockResolvedValue({ fileName: 'a.pdf', pages: 1, pageTexts: [''], scannedPages: [] }),
      },
    });
    await expect(analyzeDocument(file, d)).rejects.toMatchObject({ code: 'invalid_file' });
    expect(d.analyzer.analyze).not.toHaveBeenCalled();
  });
  it('turns an analyzer response that fails the schema into invalid_response', async () => {
    const { deps: d } = deps({
      analyzer: {
        analyze: vi
          .fn()
          .mockResolvedValue({ ...result, amounts: [{ value: 1, currency: 'pln', context: '' }] }),
      },
    });
    await expect(analyzeDocument(file, d)).rejects.toMatchObject({
      code: 'invalid_response',
      retryable: true,
    });
  });
  it('passes through an AnalysisError from the analyzer unchanged', async () => {
    const err = new AnalysisError('rate_limited', 'slow down', true);
    const { deps: d } = deps({ analyzer: { analyze: vi.fn().mockRejectedValue(err) } });
    await expect(analyzeDocument(file, d)).rejects.toBe(err);
  });
});
