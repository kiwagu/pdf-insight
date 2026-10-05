import type { LlmAnalysis } from '@pdf-insight/contracts';

/**
 * One written number. An optional sign counts only when no letter or digit is glued to it, so
 * the hyphen in `10-20` is not a minus. The integer part is grouped by any Unicode whitespace run
 * (`\s`: spaces, no-break and thin spaces, tabs, form feeds and line breaks; a page's visual
 * lines are joined with `\n`, and a paragraph can wrap inside an amount), by dots or by commas,
 * or not grouped at all. Every group after the first has exactly three digits, and a group that a
 * percent or per mille sign follows, after any Unicode whitespace run, is not taken, so
 * `3 400 100%` and `3 400 100 %` read as 3 400 and 100. A decimal part of one or two digits ends
 * the number, so neighbouring table columns (`55 350,00 12 730,50`) stay separate numbers.
 */
const NUMBER =
  /(?:(?<![\p{L}\p{N}])[+-])?(?:\d{1,3}(?:\s+\d{3}(?!\s*[%\u2030]))+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/gu;

/**
 * The values one NUMBER match can stand for: separators removed, a decimal comma read as a point.
 * A decimal amount is one value. An integer run grouped by whitespace is read whole and then
 * without its trailing groups one at a time (`3 400 100` gives 3400100, 3400 and 3): prefixes of
 * integer runs are accepted because a run may be two adjacent integers; fragments of decimal
 * amounts never are.
 */
function readNumber(written: string): number[] {
  const sign = written.startsWith('-') ? -1 : 1;
  const unsigned = written.replace(/^[+-]/, '');
  const decimal = /[.,](\d{1,2})$/.exec(unsigned);
  if (decimal) {
    const integer = unsigned.slice(0, decimal.index).replace(/\D/g, '');
    return [sign * Number(`${integer}.${decimal[1]}`)];
  }
  const groups = unsigned.split(/\s+/).map((group) => group.replace(/\D/g, ''));
  return groups.map(
    (_, dropped) => sign * Number(groups.slice(0, groups.length - dropped).join('')),
  );
}

/** The values of the numbers written in the text, in text order (see NUMBER and readNumber). */
export function numericTokens(text: string): number[] {
  return Array.from(text.matchAll(NUMBER)).flatMap(([written]) => readNumber(written));
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
