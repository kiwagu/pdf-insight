import { describe, expect, it } from 'vitest';
import type { LlmAnalysis } from '@pdf-insight/contracts';
import { groundAmounts, numericTokens } from './ground-amounts.ts';

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

const amount = (value: number) => ({ value, currency: 'PLN' as const, context: 'x', page: 1 });

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
  it('reads a table row as its separate amounts, without fusing neighbouring columns', () => {
    const row = 'Razem 55 350,00 12 730,50 68 080,50\nE1 27 675,00 8 302,50 19 372,50';
    const { analysis, dropped } = groundAmounts(
      {
        ...base,
        amounts: [55350, 12730.5, 68080.5, 8302.5, 19372.5, 3500012].map((value) => amount(value)),
      },
      row,
      [],
    );
    expect(analysis.amounts.map((a) => a.value)).toEqual([
      55350, 12730.5, 68080.5, 8302.5, 19372.5,
    ]);
    expect(dropped).toBe(1);
  });
  it('grounds a whole written number, not the digit groups inside it', () => {
    const { analysis, dropped } = groundAmounts(
      { ...base, amounts: [184500, 184, 500].map((value) => amount(value)) },
      'Wynagrodzenie 184 500,00 PLN',
      [],
    );
    expect(analysis.amounts.map((a) => a.value)).toEqual([184500]);
    expect(dropped).toBe(2);
  });
  it('keeps a negative amount only with its sign', () => {
    const { analysis } = groundAmounts(
      { ...base, amounts: [-240, 240].map((value) => amount(value)) },
      'Zwrot: -240,00 PLN',
      [],
    );
    expect(analysis.amounts.map((a) => a.value)).toEqual([-240]);
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

describe('numericTokens', () => {
  it('reads one value per written number', () => {
    expect(numericTokens('Wynagrodzenie 184 500,00 PLN')).toEqual([184500]);
    expect(numericTokens('184\u00A0500,00 i 12\u202F300,00')).toEqual([184500, 12300]);
    expect(numericTokens('Razem 55 350,00 12 730,50 68 080,50')).toEqual([55350, 12730.5, 68080.5]);
  });
  it('keeps the sign of a negative number, but not a hyphen between two numbers', () => {
    expect(numericTokens('Zwrot: -240,00 PLN')).toEqual([-240]);
    expect(numericTokens('sesja dla 10-20 osob')).toEqual([10, 20]);
  });
  it('reads dot and comma thousands separators and a number wrapped onto the next line', () => {
    expect(numericTokens('184.500,00 zl; USD 12,300.00; (295\n200,00 zl)')).toEqual([
      184500, 12300, 295200,
    ]);
  });
});
