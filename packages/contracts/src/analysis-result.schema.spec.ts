import { describe, expect, it } from 'vitest';
import {
  analysisResultSchema,
  llmAnalysisSchema,
  llmFinalAnalysisSchema,
} from './analysis-result.schema.ts';

const valid = {
  document: {
    fileName: 'umowa.pdf',
    pages: 12,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa ramowa nr 14/2026',
    date: '2026-03-12',
  },
  summary:
    'Umowa okresla zasady wdrozenia CRM. Obejmuje 24 miesiace. Wynagrodzenie jest ryczaltowe.',
  keyPoints: ['Okres umowy 24 mies.'],
  entities: { organizations: ['Nordwave Logistics sp. z o.o.'], people: ['Anna Kowalczyk'] },
  amounts: [{ value: 184500, currency: 'PLN', context: 'wynagrodzenie za wdrozenie', page: 4 }],
  dates: [{ date: '2026-10-12', context: 'go-live', page: null }],
  keywords: ['CRM', 'SLA'],
  meta: {
    id: 'ana_1',
    model: 'claude-opus-5-5',
    chunks: 1,
    scannedPages: [11],
    warnings: [],
    durationMs: 1200,
    analyzedAt: '2026-10-05T14:00:00.000Z',
  },
};

describe('analysisResultSchema', () => {
  it('accepts a complete result', () => {
    expect(analysisResultSchema.parse(valid)).toEqual(valid);
  });
  it('accepts nulls and empty lists for missing information', () => {
    const empty = {
      ...valid,
      document: { ...valid.document, title: null, date: null },
      keyPoints: [],
      amounts: [],
      dates: [],
      keywords: [],
      entities: { organizations: [], people: [] },
    };
    expect(analysisResultSchema.safeParse(empty).success).toBe(true);
  });
  it('rejects a lowercase currency', () => {
    const bad = { ...valid, amounts: [{ value: 1, currency: 'pln', context: 'x', page: null }] };
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a non-ISO date', () => {
    const bad = { ...valid, dates: [{ date: '12.03.2026', context: 'x', page: null }] };
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a date that does not exist in the calendar', () => {
    for (const date of ['2026-02-30', '2026-99-99']) {
      expect(
        analysisResultSchema.safeParse({ ...valid, dates: [{ date, context: 'x', page: null }] })
          .success,
      ).toBe(false);
      expect(
        analysisResultSchema.safeParse({ ...valid, document: { ...valid.document, date } }).success,
      ).toBe(false);
    }
  });
  it('rejects a currency code outside ISO 4217', () => {
    const bad = { ...valid, amounts: [{ value: 1, currency: 'ZZZ', context: 'x', page: null }] };
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a language code outside ISO 639-1', () => {
    expect(
      analysisResultSchema.safeParse({ ...valid, document: { ...valid.document, language: 'zz' } })
        .success,
    ).toBe(false);
  });
  it('accepts a leap day and other listed ISO codes', () => {
    const other = {
      ...valid,
      document: { ...valid.document, language: 'de', date: '2024-02-29' },
      amounts: [{ value: 1200, currency: 'CHF', context: 'x', page: 2 }],
      dates: [{ date: '2024-02-29', context: 'x', page: null }],
    };
    expect(analysisResultSchema.safeParse(other).success).toBe(true);
  });
  it('rejects an unknown document type and more than 7 key points', () => {
    expect(
      analysisResultSchema.safeParse({ ...valid, document: { ...valid.document, type: 'list' } })
        .success,
    ).toBe(false);
    expect(
      analysisResultSchema.safeParse({
        ...valid,
        keyPoints: Array.from({ length: 8 }, (_, i) => `p${i}`),
      }).success,
    ).toBe(false);
  });
  it('requires the page of every amount and date, null when unknown', () => {
    const noPageAmount = { ...valid, amounts: [{ value: 1, currency: 'PLN', context: 'x' }] };
    const noPageDate = { ...valid, dates: [{ date: '2026-10-12', context: 'x' }] };
    expect(analysisResultSchema.safeParse(noPageAmount).success).toBe(false);
    expect(analysisResultSchema.safeParse(noPageDate).success).toBe(false);
    const zeroPage = { ...valid, amounts: [{ value: 1, currency: 'PLN', context: 'x', page: 0 }] };
    expect(analysisResultSchema.safeParse(zeroPage).success).toBe(false);
  });
  it('rejects a missing required key', () => {
    const { keywords: _k, ...noKeywords } = valid;
    expect(analysisResultSchema.safeParse(noKeywords).success).toBe(false);
  });
});

describe('llmAnalysisSchema', () => {
  const { meta: _m, ...rest } = valid;
  const { fileName: _f, pages: _p, ...doc } = rest.document;
  const answer = { ...rest, document: doc };

  it('does not require fileName, pages or meta', () => {
    expect(llmAnalysisSchema.safeParse(answer).success).toBe(true);
  });
  it('rejects a blank summary, also in the result', () => {
    expect(llmAnalysisSchema.safeParse({ ...answer, summary: '  \n ' }).success).toBe(false);
    expect(analysisResultSchema.safeParse({ ...valid, summary: '   ' }).success).toBe(false);
  });
  it('leaves the sentence count of a partial answer to the whole-document schema', () => {
    const oneSentence = { ...answer, summary: 'This part lists the fees.' };
    expect(llmAnalysisSchema.safeParse(oneSentence).success).toBe(true);
    expect(llmFinalAnalysisSchema.safeParse(oneSentence).success).toBe(false);
    expect(llmFinalAnalysisSchema.safeParse(answer).success).toBe(true);
  });
});

describe('source pages against the document range', () => {
  it('rejects an amount or a date attributed to a page the document does not have', () => {
    const amounts = [{ ...valid.amounts[0]!, page: 999 }];
    expect(analysisResultSchema.safeParse({ ...valid, amounts }).success).toBe(false);
    const dates = [{ ...valid.dates[0]!, page: valid.document.pages + 1 }];
    expect(analysisResultSchema.safeParse({ ...valid, dates }).success).toBe(false);
  });
  it('accepts the last page and a null page', () => {
    const amounts = [{ ...valid.amounts[0]!, page: valid.document.pages }];
    const dates = [{ ...valid.dates[0]!, page: null }];
    expect(analysisResultSchema.safeParse({ ...valid, amounts, dates }).success).toBe(true);
  });
});
