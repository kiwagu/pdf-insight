import type { LlmAnalysis } from '@pdf-insight/contracts';

/**
 * One written number. An optional sign counts only when no letter or digit is glued to it, so
 * the hyphen in `10-20` is not a minus. The integer part is grouped by spaces (also no-break or
 * line breaks: a page's visual lines are joined with `\n`, and a paragraph can wrap inside an
 * amount), by dots or by commas, or not grouped at all. Every group after the first has exactly
 * three digits, and a decimal part of one or two digits ends the number, so neighbouring table
 * columns (`55 350,00 12 730,50`) stay separate numbers.
 */
const NUMBER =
  /(?:(?<![\p{L}\p{N}])[+-])?(?:\d{1,3}(?:[ \u00A0\u202F\n]\d{3})+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/gu;

/** The value of one NUMBER match: separators removed, a decimal comma read as a point. */
function parseNumber(written: string): number {
  const unsigned = written.replace(/^[+-]/, '');
  const decimal = /[.,](\d{1,2})$/.exec(unsigned);
  const integer = (decimal ? unsigned.slice(0, decimal.index) : unsigned).replace(/\D/g, '');
  const value = Number(`${integer}.${decimal?.[1] ?? '0'}`);
  return written.startsWith('-') ? -value : value;
}

/** The value of every number written in the text, exactly one per number, in text order. */
export function numericTokens(text: string): number[] {
  return Array.from(text.matchAll(NUMBER), ([written]) => parseNumber(written));
}

/**
 * Keeps an amount when its value occurs in the text layer, or when it may come from a scanned
 * page image, which the text layer cannot confirm: its `page` is one of `scannedPages`, or it
 * names no page while the document has scanned pages. Every other amount is dropped and counted.
 */
export function groundAmounts(
  analysis: LlmAnalysis,
  fullText: string,
  scannedPages: number[],
): { analysis: LlmAnalysis; dropped: number } {
  const tokens = numericTokens(fullText);
  const inText = (value: number): boolean => tokens.some((t) => Math.abs(t - value) < 0.005);
  const fromScan = (page: number | null): boolean =>
    page === null ? scannedPages.length > 0 : scannedPages.includes(page);
  const kept = analysis.amounts.filter((a) => inText(a.value) || fromScan(a.page));
  return {
    analysis: { ...analysis, amounts: kept },
    dropped: analysis.amounts.length - kept.length,
  };
}
