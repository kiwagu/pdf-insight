import { z } from 'zod';

export const SUMMARY_MIN_SENTENCES = 3;
export const SUMMARY_MAX_SENTENCES = 5;
export const SUMMARY_MAX_LENGTH = 1500;

/**
 * Abbreviations that are always followed by more of the same sentence (a number, a name, an
 * example), so their period never ends one: lowercase, without the final period. Abbreviations that
 * can close a sentence (`r.`, `o.o.`, `S.A.`, `Inc.`, `Ltd.`) are deliberately absent: like any word,
 * they end a sentence only when a capital letter or a digit comes next.
 */
const CONTINUING_ABBREVIATIONS = new Set([
  'ul',
  'nr',
  'art',
  'ust',
  'pkt',
  'poz',
  'tj',
  'np',
  'm.in',
  'tzw',
  'sp',
  'e.g',
  'i.e',
  'no',
  'dr',
  'mr',
  'mrs',
  'ms',
  'prof',
  'vs',
  'cf',
]);

/**
 * A candidate sentence end: terminal punctuation, optional closing quotes or brackets, whitespace,
 * and then the character that starts the next sentence (optionally after an opening quote): a
 * capital letter, a digit, or a letter of a script without case (Arabic, Hebrew, CJK). The Arabic
 * question mark and the Urdu full stop are sentence ends too, and the East Asian full stop,
 * exclamation and question marks need no whitespace after them. An opening bracket does not start
 * a sentence, so `S.A. (Wykonawca)` stays one sentence; a period inside a number (`99.5%`,
 * `12.03.2026`) is never followed by whitespace; and an ordinal (`2. kwartale`) or an abbreviation
 * in mid-sentence is followed by a lowercase word.
 */
const SENTENCE_END =
  /(?:([.!?…؟۔]+)["'”’»)\]]*\s+|([。！？]+)[」』”’)\]]*\s*)(?=["'„“‘«「『]?[\p{Lu}\p{Lo}\p{Nd}])/gu;
const HAS_CONTENT = /[\p{L}\p{N}]/u;
const LAST_WORD = /(\S+)$/u;

/** Whether the period that ends `before` belongs to an abbreviation or an initial, not a sentence. */
function periodContinues(before: string): boolean {
  const word = (LAST_WORD.exec(before)?.[1] ?? '').replace(/^[^\p{L}\p{N}]+/u, '');
  return CONTINUING_ABBREVIATIONS.has(word.toLowerCase()) || /^\p{Lu}$/u.test(word);
}

/**
 * The number of sentences in a summary, aware of the Polish and English abbreviations, decimals,
 * dates and ordinals a business summary is full of. A trailing sentence without a final period
 * counts too; a blank text has none.
 */
export function countSentences(text: string): number {
  let count = 0;
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    if (match[1] === '.' && periodContinues(text.slice(0, match.index))) continue;
    if (HAS_CONTENT.test(text.slice(start, match.index))) count += 1;
    start = match.index + match[0].length;
  }
  return HAS_CONTENT.test(text.slice(start)) ? count + 1 : count;
}

const isNonBlank = (text: string): boolean => text.trim().length > 0;

/** Any summary the model writes, a part's included: present, not blank, within the length cap. */
export const summaryTextSchema = z
  .string()
  .min(1)
  .max(SUMMARY_MAX_LENGTH)
  .refine(isNonBlank, { message: 'expected a non-blank summary' });

/** The summary of the whole document, the one the user reads: 3 to 5 sentences. */
export const finalSummarySchema = summaryTextSchema.refine(
  (text) => {
    const sentences = countSentences(text);
    return sentences >= SUMMARY_MIN_SENTENCES && sentences <= SUMMARY_MAX_SENTENCES;
  },
  {
    message: `expected a summary of ${SUMMARY_MIN_SENTENCES} to ${SUMMARY_MAX_SENTENCES} sentences`,
  },
);
