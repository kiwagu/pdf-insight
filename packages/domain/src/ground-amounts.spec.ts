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

/** An amount whose value is not in `text`, as read from a scanned annex. */
const annex = (page: number | null) => ({
  value: 13100,
  currency: 'PLN' as const,
  context: 'abonament od 01.04.2027',
  page,
});

describe('groundAmounts', () => {
  it('keeps amounts whose value appears in Polish number formatting', () => {
    const { analysis, dropped } = groundAmounts(
      {
        ...base,
        amounts: [
          { value: 184500, currency: 'PLN', context: 'x', page: 1 },
          { value: 12300, currency: 'PLN', context: 'y', page: 1 },
          { value: 2150, currency: 'EUR', context: 'z', page: 1 },
          { value: 890, currency: 'USD', context: 'h', page: null },
          { value: 240, currency: 'PLN', context: 's', page: null },
        ],
      },
      text,
      [],
    );
    expect(dropped).toBe(0);
    expect(analysis.amounts).toHaveLength(5);
  });
  it('drops an amount whose value does not occur in the text', () => {
    const { analysis, dropped } = groundAmounts(
      {
        ...base,
        amounts: [{ value: 1, currency: 'PLN', context: 'calkowita wartosc umowy', page: 1 }],
      },
      text,
      [],
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
          { value: 55350, currency: 'PLN', context: 'netto', page: 1 },
          { value: 12730.5, currency: 'PLN', context: 'VAT', page: 1 },
          { value: 68080.5, currency: 'PLN', context: 'brutto', page: 1 },
          { value: 8302.5, currency: 'PLN', context: 'E1 VAT', page: 1 },
          { value: 19372.5, currency: 'PLN', context: 'E1 netto', page: 1 },
        ],
      },
      row,
      [],
    );
    expect(dropped).toBe(0);
  });
  it('accepts decimals written with a dot or a comma', () => {
    const { dropped } = groundAmounts(
      { ...base, amounts: [{ value: 68080.5, currency: 'PLN', context: 'brutto', page: 1 }] },
      'Do zaplaty: 68 080,50 zl',
      [],
    );
    expect(dropped).toBe(0);
  });
  it('keeps an amount absent from the text when it was read from a scanned page', () => {
    const { analysis, dropped } = groundAmounts({ ...base, amounts: [annex(11)] }, text, [11]);
    expect(dropped).toBe(0);
    expect(analysis.amounts).toEqual([annex(11)]);
  });
  it('drops an amount absent from the text when its page was not scanned', () => {
    const { dropped } = groundAmounts({ ...base, amounts: [annex(3)] }, text, [11]);
    expect(dropped).toBe(1);
  });
  it('keeps an amount without a page when the document has scanned pages', () => {
    const { dropped } = groundAmounts({ ...base, amounts: [annex(null)] }, text, [11]);
    expect(dropped).toBe(0);
  });
  it('drops an amount without a page when nothing was scanned', () => {
    const { dropped } = groundAmounts({ ...base, amounts: [annex(null)] }, text, []);
    expect(dropped).toBe(1);
  });
});
