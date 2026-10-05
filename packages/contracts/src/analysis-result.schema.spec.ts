import { describe, expect, it } from 'vitest';
import { analysisResultSchema, llmAnalysisSchema } from './analysis-result.schema.ts';

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
  amounts: [{ value: 184500, currency: 'PLN', context: 'wynagrodzenie za wdrozenie' }],
  dates: [{ date: '2026-10-12', context: 'go-live' }],
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
    const bad = { ...valid, amounts: [{ value: 1, currency: 'pln', context: 'x' }] };
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a non-ISO date', () => {
    const bad = { ...valid, dates: [{ date: '12.03.2026', context: 'x' }] };
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
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
  it('rejects a missing required key', () => {
    const { keywords: _k, ...noKeywords } = valid;
    expect(analysisResultSchema.safeParse(noKeywords).success).toBe(false);
  });
});

describe('llmAnalysisSchema', () => {
  it('does not require fileName, pages or meta', () => {
    const { meta: _m, ...rest } = valid;
    const { fileName: _f, pages: _p, ...doc } = rest.document;
    expect(llmAnalysisSchema.safeParse({ ...rest, document: doc }).success).toBe(true);
  });
});
