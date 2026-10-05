import { describe, expect, it } from 'vitest';
import { countSentences, finalSummarySchema } from './summary.ts';

const POLISH_FOUR = [
  'Umowa nr 7/2026 zawarta 3.03.2026 r. w Gdyni pomiędzy Northwind Logistics sp. z o.o. ' +
    '(Zleceniodawca) a Harbor Software S.A. (Wykonawca) dotyczy wsparcia systemu magazynowego.',
  'Wynagrodzenie wynosi 12 345,67 zł netto, a wymagana dostępność usługi to 97,5%.',
  'Umowa obowiązuje od 1 kwietnia 2026 r. do 31 marca 2028 r., obejmuje m.in. hosting, ' +
    'tj. utrzymanie serwerów, np. w dni robocze, oraz zmiany z art. 5 ust. 2 pkt 3.',
  'Załącznik nr 1 z 20.03.2026 r. podnosi opłatę do 13 579,24 PLN netto.',
].join(' ');

const ENGLISH_FOUR = [
  'Service Agreement No. 7/2026 between Northwind Logistics Ltd. and Harbor Software Inc. ' +
    'covers support for the warehouse system.',
  'The monthly fee is USD 12,345.67, e.g. for hosting, and availability must reach 99.5%.',
  'A. Morgan signs for the client, i.e. the party that pays the fee.',
  'The provider is Harbor Software Inc.',
].join(' ');

describe('countSentences', () => {
  it('counts nothing in a blank text', () => {
    expect(countSentences('')).toBe(0);
    expect(countSentences('  \n\t ')).toBe(0);
  });
  it('counts the sentences of a Polish summary full of abbreviations, decimals and dates', () => {
    expect(countSentences(POLISH_FOUR)).toBe(4);
  });
  it('counts the sentences of an English summary with company suffixes, initials and numbers', () => {
    expect(countSentences(ENGLISH_FOUR)).toBe(4);
  });
  it('ends a sentence at an abbreviation that closes it when a capital follows', () => {
    expect(countSentences('Umowa wygasa 31 marca 2028 r. Strony mogą ją przedłużyć.')).toBe(2);
    expect(countSentences('The client is Northwind Logistics Ltd. It pays monthly.')).toBe(2);
    expect(countSentences('Wykonawcą jest Harbor Software S.A. Umowa jest ważna.')).toBe(2);
  });
  it('does not end a sentence at an ordinal number', () => {
    expect(countSentences('Odbiór nastąpi w 2. kwartale, a płatność do 15. dnia miesiąca.')).toBe(
      1,
    );
  });
  it('does not end a sentence at an abbreviation that always continues it', () => {
    expect(countSentences('Aneks nr. 2 zmienia cennik.')).toBe(1);
    expect(countSentences('Dr. Morgan signed it, e.g. Section 4 and No. 12.')).toBe(1);
  });
  it('counts question and exclamation marks and a last sentence without a period', () => {
    expect(countSentences('Is it binding? Yes! It is signed')).toBe(3);
  });
});

describe('finalSummarySchema', () => {
  const sentences = (n: number): string =>
    Array.from({ length: n }, (_, i) => `Sentence ${i + 1} is here.`).join(' ');

  it('accepts three to five sentences', () => {
    for (const n of [3, 4, 5]) {
      expect(finalSummarySchema.safeParse(sentences(n)).success).toBe(true);
    }
    expect(finalSummarySchema.safeParse(POLISH_FOUR).success).toBe(true);
    expect(finalSummarySchema.safeParse(ENGLISH_FOUR).success).toBe(true);
  });
  it('rejects a blank summary and one outside three to five sentences', () => {
    for (const bad of ['', '   ', sentences(1), sentences(2), sentences(6)]) {
      expect(finalSummarySchema.safeParse(bad).success).toBe(false);
    }
  });
  it('rejects a summary over 1500 characters', () => {
    const long = `${'Long words here. '.repeat(2)}${'x'.repeat(1500)}.`;
    expect(finalSummarySchema.safeParse(long).success).toBe(false);
  });
});
