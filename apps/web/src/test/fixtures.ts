import type { AnalysisResult } from '@pdf-insight/contracts';

/** A complete, schema-valid result in the shape the analyze endpoint returns. */
export const contractResult: AnalysisResult = {
  document: {
    fileName: 'umowa.pdf',
    pages: 12,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa ramowa nr 14/2026',
    date: '2026-03-12',
  },
  summary: 'Umowa dotyczy wdrozenia CRM.',
  keyPoints: ['Okres 24 miesiace'],
  entities: { organizations: ['Nordwave Logistics sp. z o.o.'], people: ['Anna Kowalczyk'] },
  amounts: [{ value: 184500, currency: 'PLN', context: 'wynagrodzenie', page: 5 }],
  dates: [{ date: '2026-10-12', context: 'go-live', page: 3 }],
  keywords: ['CRM'],
  meta: {
    id: 'ana_1',
    model: 'm',
    chunks: 1,
    scannedPages: [11],
    warnings: ['1 amount(s) dropped: value not found in the document text'],
    durationMs: 9000,
    analyzedAt: '2026-10-05T12:00:00.000Z',
  },
};

/** A minimal result: no lists, no title or date. */
export const shortResult: AnalysisResult = {
  document: {
    fileName: 'a.pdf',
    pages: 1,
    language: 'pl',
    type: 'inne',
    title: null,
    date: null,
  },
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
