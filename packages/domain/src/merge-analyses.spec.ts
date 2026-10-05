import { describe, expect, it } from 'vitest';
import type { LlmAnalysis } from '@pdf-insight/contracts';
import { mergeAnalyses } from './merge-analyses.ts';

const partial = (over: Partial<LlmAnalysis>): LlmAnalysis => ({
  document: { language: 'pl', type: 'umowa', title: null, date: null },
  summary: 'x',
  keyPoints: [],
  entities: { organizations: [], people: [] },
  amounts: [],
  dates: [],
  keywords: [],
  ...over,
});

describe('mergeAnalyses', () => {
  it('dedupes list items case-insensitively and trims whitespace', () => {
    const merged = mergeAnalyses([
      partial({
        keywords: ['CRM', 'sla '],
        entities: { organizations: ['Nordwave Logistics sp. z o.o.'], people: [] },
      }),
      partial({
        keywords: ['crm', 'SLA'],
        entities: { organizations: ['nordwave logistics sp. z o.o.'], people: ['Anna Kowalczyk'] },
      }),
    ]);
    expect(merged.keywords).toEqual(['CRM', 'sla']);
    expect(merged.entities.organizations).toEqual(['Nordwave Logistics sp. z o.o.']);
    expect(merged.entities.people).toEqual(['Anna Kowalczyk']);
  });
  it('dedupes amounts by value, currency and context, and dates by date and context', () => {
    const merged = mergeAnalyses([
      partial({
        amounts: [{ value: 184500, currency: 'PLN', context: 'wynagrodzenie' }],
        dates: [{ date: '2026-03-12', context: 'zawarcie umowy' }],
      }),
      partial({
        amounts: [
          { value: 184500, currency: 'PLN', context: 'Wynagrodzenie ' },
          { value: 8600, currency: 'EUR', context: 'licencje' },
        ],
        dates: [{ date: '2026-03-12', context: 'Zawarcie umowy' }],
      }),
    ]);
    expect(merged.amounts).toHaveLength(2);
    expect(merged.dates).toHaveLength(1);
  });
  it('prefers the first non-null title and date and caps key points at 7', () => {
    const merged = mergeAnalyses([
      partial({
        document: { language: 'pl', type: 'umowa', title: null, date: null },
        keyPoints: ['a', 'b', 'c', 'd'],
      }),
      partial({
        document: { language: 'pl', type: 'umowa', title: 'Umowa', date: '2026-03-12' },
        keyPoints: ['e', 'f', 'g', 'h', 'i'],
      }),
    ]);
    expect(merged.document.title).toBe('Umowa');
    expect(merged.document.date).toBe('2026-03-12');
    expect(merged.keyPoints).toHaveLength(7);
  });
  it('keeps the summary of the first partial', () => {
    expect(mergeAnalyses([partial({ summary: 'one' }), partial({ summary: 'two' })]).summary).toBe(
      'one',
    );
  });
});
