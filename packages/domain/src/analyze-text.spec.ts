import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LlmAnalysis } from '@pdf-insight/contracts';
import { analysisResultSchema } from '@pdf-insight/contracts';
import { analyzeText } from './analyze-text.ts';
import { createDeadline } from './deadline.ts';
import { AnalysisTimeoutError, ModelOutputInvalidError, ModelUpstreamError } from './errors.ts';
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
  it('retries once when the summary is blank or outside three to five sentences', async () => {
    const six = 'Jeden. Dwa. Trzy. Cztery. Pięć. Sześć.';
    for (const summary of ['  ', 'Jedno zdanie.', 'Raz. Dwa.', six]) {
      const analyzeChunk = vi
        .fn<ModelPort['analyzeChunk']>()
        .mockResolvedValueOnce(llm({ summary }))
        .mockResolvedValue(llm());
      const result = await analyzeText(
        { fileName: 'x.pdf', pages: 1, pageTexts: ['Wynagrodzenie 184 500 zl'], scannedPages: [] },
        deps({ analyzeChunk, reduce: vi.fn() }),
      );
      expect(analyzeChunk).toHaveBeenCalledTimes(2);
      expect(result.summary).toBe(llm().summary);
    }
  });
  it('fails with invalid output when the retry still has a one-sentence summary', async () => {
    const analyzeChunk = vi
      .fn<ModelPort['analyzeChunk']>()
      .mockResolvedValue(llm({ summary: 'Umowa dotyczy wsparcia.' }));
    await expect(
      analyzeText(
        { fileName: 'x.pdf', pages: 1, pageTexts: ['Wynagrodzenie 184 500 zl'], scannedPages: [] },
        deps({ analyzeChunk, reduce: vi.fn() }),
      ),
    ).rejects.toBeInstanceOf(ModelOutputInvalidError);
    expect(analyzeChunk).toHaveBeenCalledTimes(2);
  });
  it('holds the reduce summary to the sentence count but not the summaries of the parts', async () => {
    const analyzeChunk = vi
      .fn<ModelPort['analyzeChunk']>()
      .mockResolvedValue(llm({ summary: 'Ta część zawiera cennik.' }));
    const reduce = vi
      .fn<ModelPort['reduce']>()
      .mockResolvedValueOnce(llm({ summary: 'Za krótko.' }))
      .mockResolvedValue(llm());
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
    expect(reduce).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe(llm().summary);
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
  it('warns about text-less pages that were not sent as scanned page images', async () => {
    const model: ModelPort = { analyzeChunk: vi.fn().mockResolvedValue(llm()), reduce: vi.fn() };
    const text = 'Wynagrodzenie 184 500,00 zl';
    const result = await analyzeText(
      {
        fileName: 'x.pdf',
        pages: 8,
        pageTexts: [text, text, text, text, '', ' ', '', '\n'],
        scannedPages: [{ page: 5, imageJpegBase64: 'AAAA' }],
      },
      { ...deps(model), maxChunkChars: 1_000 },
    );
    expect(result.meta.warnings).toEqual([
      '3 page(s) without a text layer were not analysed: 6, 7, 8',
    ]);
  });
  it('lists at most ten skipped text-less pages, after the dropped-amounts warning', async () => {
    const model: ModelPort = {
      analyzeChunk: vi
        .fn()
        .mockResolvedValue(
          llm({ amounts: [{ value: 1, currency: 'PLN', context: 'wartosc umowy', page: 1 }] }),
        ),
      reduce: vi.fn(),
    };
    const pageTexts = ['Wynagrodzenie 184 500,00 zl', ...Array.from({ length: 13 }, () => '')];
    const result = await analyzeText(
      {
        fileName: 'x.pdf',
        pages: 14,
        pageTexts,
        scannedPages: [{ page: 2, imageJpegBase64: 'AAAA' }],
      },
      { ...deps(model), maxChunkChars: 1_000 },
    );
    expect(result.meta.warnings).toEqual([
      '1 amount(s) dropped: value not found in the document text',
      '12 page(s) without a text layer were not analysed: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12...',
    ]);
  });
  it('records no skipped-page warning when every text-less page was sent as an image', async () => {
    const model: ModelPort = { analyzeChunk: vi.fn().mockResolvedValue(llm()), reduce: vi.fn() };
    const text = 'Wynagrodzenie 184 500,00 zl';
    const result = await analyzeText(
      {
        fileName: 'x.pdf',
        pages: 4,
        pageTexts: [text, '', text, ''],
        scannedPages: [
          { page: 2, imageJpegBase64: 'AAAA' },
          { page: 4, imageJpegBase64: 'BBBB' },
        ],
      },
      { ...deps(model), maxChunkChars: 1_000 },
    );
    expect(result.meta.warnings).toEqual([]);
  });
  it('starts no further chunk once one has failed for good', async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const analyzeChunk = vi
      .fn<ModelPort['analyzeChunk']>()
      .mockRejectedValueOnce(new ModelUpstreamError('bad key', false))
      .mockImplementation(async () => {
        await gate;
        return llm();
      });
    const pageTexts = Array.from({ length: 6 }, () => 'x'.repeat(95));
    await expect(
      analyzeText(
        { fileName: 'x.pdf', pages: 6, pageTexts, scannedPages: [] },
        deps({ analyzeChunk, reduce: vi.fn() }),
      ),
    ).rejects.toBeInstanceOf(ModelUpstreamError);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(analyzeChunk.mock.calls.map(([input]) => input.chunk.index)).toEqual([0, 1, 2]);
  });
});

describe('analyzeText within the time budget', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A model whose every call takes `callMs`, or fails as a timeout when its own timeout is shorter. */
  const slowModel = (callMs: number) => {
    const timeouts: { chunk: number[]; reduce: number[] } = { chunk: [], reduce: [] };
    const answer = (timeoutMs: number): Promise<LlmAnalysis> =>
      new Promise((resolve, reject) => {
        if (timeoutMs < callMs) {
          setTimeout(() => reject(new AnalysisTimeoutError('timed out', true)), timeoutMs);
        } else {
          setTimeout(() => resolve(llm()), callMs);
        }
      });
    const model: ModelPort = {
      analyzeChunk: (_input, { timeoutMs }) => {
        timeouts.chunk.push(timeoutMs);
        return answer(timeoutMs);
      },
      reduce: (_input, { timeoutMs }) => {
        timeouts.reduce.push(timeoutMs);
        return answer(timeoutMs);
      },
    };
    return { model, timeouts };
  };

  it('shares one deadline between the chunk workers and the reduce step', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00.000Z') });
    const { model, timeouts } = slowModel(30_000);
    const pageTexts = Array.from({ length: 6 }, () => 'x'.repeat(95));
    const run = analyzeText(
      { fileName: 'x.pdf', pages: 6, pageTexts, scannedPages: [] },
      { ...deps(model), deadline: createDeadline(140_000, Date.now) },
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(timeouts.chunk).toEqual([60_000, 60_000, 60_000, 60_000, 60_000, 60_000]);
    expect(timeouts.reduce).toEqual([60_000]);
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(run).resolves.toMatchObject({ meta: { chunks: 6 } });
  });
  it('gives the last calls only what is left and fails as a timeout at the deadline', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00.000Z') });
    const { model, timeouts } = slowModel(50_000);
    const pageTexts = Array.from({ length: 9 }, () => 'x'.repeat(95));
    const run = analyzeText(
      { fileName: 'x.pdf', pages: 9, pageTexts, scannedPages: [] },
      { ...deps(model), deadline: createDeadline(140_000, Date.now) },
    );
    const settled = expect(run).rejects.toBeInstanceOf(AnalysisTimeoutError);
    await vi.advanceTimersByTimeAsync(140_000);
    await settled;
    expect(timeouts.chunk).toEqual([
      60_000, 60_000, 60_000, 60_000, 60_000, 60_000, 40_000, 40_000, 40_000,
    ]);
    expect(timeouts.reduce).toEqual([]);
  });
});
