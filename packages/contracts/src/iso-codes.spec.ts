import { describe, expect, it } from 'vitest';
import { llmAnalysisSchema } from './analysis-result.schema.ts';
import { ISO_4217_CODES, ISO_4217_HISTORIC_CODES, ISO_639_1_CODES } from './iso-codes.ts';

const MUST_HAVE_CURRENCIES = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CZK',
  'SEK',
  'NOK',
  'DKK',
  'HUF',
  'UAH',
  'JPY',
  'CNY',
  'CAD',
  'AUD',
];

describe('ISO_639_1_CODES', () => {
  it('holds all 184 codes, unique and lowercase two-letter', () => {
    expect(ISO_639_1_CODES).toHaveLength(184);
    expect(new Set(ISO_639_1_CODES).size).toBe(ISO_639_1_CODES.length);
    for (const code of ISO_639_1_CODES) expect(code).toMatch(/^[a-z]{2}$/);
  });
});

describe('ISO_4217_CODES', () => {
  it('holds unique uppercase three-letter codes', () => {
    expect(new Set(ISO_4217_CODES).size).toBe(ISO_4217_CODES.length);
    for (const code of ISO_4217_CODES) expect(code).toMatch(/^[A-Z]{3}$/);
  });
  it('includes the currencies documents commonly use', () => {
    expect(ISO_4217_CODES).toEqual(expect.arrayContaining(MUST_HAVE_CURRENCIES));
  });
});

describe('ISO_4217_HISTORIC_CODES', () => {
  it('holds unique uppercase three-letter codes, none of them active', () => {
    expect(new Set(ISO_4217_HISTORIC_CODES).size).toBe(ISO_4217_HISTORIC_CODES.length);
    for (const code of ISO_4217_HISTORIC_CODES) expect(code).toMatch(/^[A-Z]{3}$/);
    const active = new Set<string>(ISO_4217_CODES);
    expect(ISO_4217_HISTORIC_CODES.filter((code) => active.has(code))).toEqual([]);
  });
  it('lets amounts in withdrawn currencies through the strict schema, but not unknown codes', () => {
    const currency = llmAnalysisSchema.shape.amounts.element.shape.currency;
    expect(currency.safeParse('HRK').success).toBe(true);
    expect(currency.safeParse('BGN').success).toBe(true);
    expect(currency.safeParse('ZZZ').success).toBe(false);
  });
});
