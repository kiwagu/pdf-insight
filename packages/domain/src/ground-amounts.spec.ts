import { describe, expect, it } from 'vitest';
import type { LlmAnalysis } from '@pdf-insight/contracts';
import { groundAmounts } from './ground-amounts.ts';

const base: LlmAnalysis = {
  document: { language: 'pl', type: 'umowa', title: null, date: null },
  summary: 's',
  keyPoints: [],
  entities: { organizations: [], people: [] },
  amounts: [],
  dates: [],
  keywords: [],
};

const text =
  'Wynagrodzenie 184 500,00 zl netto, abonament 12 300,00 PLN, licencje 2 150 EUR, hosting 890 USD, stawka 240 zl.';

describe('groundAmounts', () => {
  it('keeps amounts whose value appears in Polish number formatting', () => {
    const { analysis, dropped } = groundAmounts(
      {
        ...base,
        amounts: [
          { value: 184500, currency: 'PLN', context: 'x' },
          { value: 12300, currency: 'PLN', context: 'y' },
          { value: 2150, currency: 'EUR', context: 'z' },
          { value: 890, currency: 'USD', context: 'h' },
          { value: 240, currency: 'PLN', context: 's' },
        ],
      },
      text,
    );
    expect(dropped).toBe(0);
    expect(analysis.amounts).toHaveLength(5);
  });
  it('drops an amount that does not occur in the text, such as the injected 1 PLN', () => {
    const { analysis, dropped } = groundAmounts(
      { ...base, amounts: [{ value: 1, currency: 'PLN', context: 'calkowita wartosc umowy' }] },
      text,
    );
    expect(dropped).toBe(1);
    expect(analysis.amounts).toEqual([]);
  });
  it('reads amounts that a table row prints side by side, separated only by spaces', () => {
    const row = 'Razem 55 350,00 12 730,50 68 080,50\nE1 27 675,00 8 302,50 19 372,50';
    const { dropped } = groundAmounts(
      {
        ...base,
        amounts: [
          { value: 55350, currency: 'PLN', context: 'netto' },
          { value: 12730.5, currency: 'PLN', context: 'VAT' },
          { value: 68080.5, currency: 'PLN', context: 'brutto' },
          { value: 8302.5, currency: 'PLN', context: 'E1 VAT' },
          { value: 19372.5, currency: 'PLN', context: 'E1 netto' },
        ],
      },
      row,
    );
    expect(dropped).toBe(0);
  });
  it('accepts decimals written with a dot or a comma', () => {
    const { dropped } = groundAmounts(
      { ...base, amounts: [{ value: 68080.5, currency: 'PLN', context: 'brutto' }] },
      'Do zaplaty: 68 080,50 zl',
    );
    expect(dropped).toBe(0);
  });
});
