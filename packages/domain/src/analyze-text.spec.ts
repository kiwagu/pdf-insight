import { describe, expect, it, vi } from 'vitest';
import type { LlmAnalysis } from '@pdf-insight/contracts';
import { analysisResultSchema } from '@pdf-insight/contracts';
import { analyzeText } from './analyze-text.ts';
import { ModelOutputInvalidError } from './errors.ts';
import type { ModelPort } from './ports.ts';

const llm = (over: Partial<LlmAnalysis> = {}): LlmAnalysis => ({
  document: { language: 'pl', type: 'umowa', title: 'Umowa', date: '2026-03-12' },
  summary: 'Umowa dotyczy CRM. Trwa 24 miesiace. Wynagrodzenie 184 500 PLN.',
  keyPoints: ['24 miesiace'],
  entities: { organizations: ['Nordwave'], people: [] },
  amounts: [{ value: 184500, currency: 'PLN', context: 'wynagrodzenie', page: 1 }],
  dates: [{ date: '2026-03-12', context: 'zawarcie', page: 1 }],
  keywords: ['CRM'],
  ...over,
});

const deps = (model: ModelPort) => ({
  model,
  modelName: 'test-model',
  createId: () => 'ana_test',
  now: () => new Date('2026-10-05T12:00:00.000Z'),
  maxChunkChars: 100,
  retryDelayMs: 0,
});

describe('analyzeText', () => {
  it('runs a single chunk for a short document and fills fileName, pages and meta', async () => {
    const model: ModelPort = { analyzeChunk: vi.fn().mockResolvedValue(llm()), reduce: vi.fn() };
    const result = await analyzeText(
      {
        fileName: 'umowa.pdf',
        pages: 1,
        pageTexts: ['Wynagrodzenie 184 500,00 zl'],
        scannedPages: [],
      },
      deps(model),
    );
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
    expect(result.document.fileName).toBe('umowa.pdf');
    expect(result.document.pages).toBe(1);
    expect(result.meta).toMatchObject({
      id: 'ana_test',
      model: 'test-model',
      chunks: 1,
      scannedPages: [],
      warnings: [],
    });
    expect(model.reduce).not.toHaveBeenCalled();
    expect(vi.mocked(model.analyzeChunk).mock.calls[0]?.[0]?.isWhole).toBe(true);
  });
  it('maps chunks, reduces, and merges list fields for a long document', async () => {
    const analyzeChunk = vi
      .fn()
      .mockResolvedValueOnce(llm({ keywords: ['CRM'] }))
      .mockResolvedValueOnce(llm({ keywords: ['SLA'] }));
    const reduce = vi
      .fn()
      .mockResolvedValue(llm({ summary: 'Final summary. Two chunks. Merged.', keywords: ['CRM'] }));
    const result = await analyzeText(
      {
        fileName: 'long.pdf',
        pages: 2,
        pageTexts: ['a'.repeat(80), 'b'.repeat(80)],
        scannedPages: [],
      },
      deps({ analyzeChunk, reduce }),
    );
    expect(analyzeChunk).toHaveBeenCalledTimes(2);
    expect(reduce).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe('Final summary. Two chunks. Merged.');
    expect(result.keywords).toEqual(['CRM', 'SLA']);
    expect(result.meta.chunks).toBe(2);
  });
  it('attaches each scanned page image to the chunk that contains the page', async () => {
    const analyzeChunk = vi.fn<ModelPort['analyzeChunk']>().mockResolvedValue(llm());
    const reduce = vi.fn().mockResolvedValue(llm());
    await analyzeText(
      {
        fileName: 'x.pdf',
        pages: 2,
        pageTexts: ['a'.repeat(95), ''],
        scannedPages: [{ page: 2, imageJpegBase64: 'AAAA' }],
      },
      deps({ analyzeChunk, reduce }),
    );
    expect(analyzeChunk.mock.calls[0]?.[0]?.images).toEqual([]);
    expect(analyzeChunk.mock.calls[1]?.[0]?.images).toEqual([{ page: 2, imageJpegBase64: 'AAAA' }]);
  });
  it('retries once when the model output is invalid, then succeeds', async () => {
    const analyzeChunk = vi
      .fn()
      .mockRejectedValueOnce(new ModelOutputInvalidError())
      .mockResolvedValue(llm());
    const result = await analyzeText(
      { fileName: 'x.pdf', pages: 1, pageTexts: ['Wynagrodzenie 184 500 zl'], scannedPages: [] },
      deps({ analyzeChunk, reduce: vi.fn() }),
    );
    expect(analyzeChunk).toHaveBeenCalledTimes(2);
    expect(result.summary).toContain('Umowa');
  });
  it('drops ungrounded amounts and records a warning', async () => {
    const model: ModelPort = {
      analyzeChunk: vi
        .fn()
        .mockResolvedValue(
          llm({ amounts: [{ value: 1, currency: 'PLN', context: 'wartosc umowy', page: null }] }),
        ),
      reduce: vi.fn(),
    };
    const result = await analyzeText(
      { fileName: 'x.pdf', pages: 1, pageTexts: ['Wynagrodzenie 184 500,00 zl'], scannedPages: [] },
      deps(model),
    );
    expect(result.amounts).toEqual([]);
    expect(result.meta.warnings).toEqual([
      '1 amount(s) dropped: value not found in the document text',
    ]);
  });
  it('keeps an amount read from a scanned page image although the text layer lacks it', async () => {
    const annex = { value: 13100, currency: 'PLN' as const, context: 'abonament', page: 2 };
    const model: ModelPort = {
      analyzeChunk: vi.fn().mockResolvedValue(llm({ amounts: [annex] })),
      reduce: vi.fn(),
    };
    const result = await analyzeText(
      {
        fileName: 'x.pdf',
        pages: 2,
        pageTexts: ['Wynagrodzenie 184 500,00 zl', ''],
        scannedPages: [{ page: 2, imageJpegBase64: 'AAAA' }],
      },
      deps(model),
    );
    expect(result.amounts).toEqual([annex]);
    expect(result.meta.warnings).toEqual([]);
  });
});
