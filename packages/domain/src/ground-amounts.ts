import type { LlmAnalysis } from '@pdf-insight/contracts';

/** Most space-separated digit groups read as one amount; `1 000 000 000 000,00` has five. */
const MAX_GROUPS = 5;

/** The values one written number can stand for under Polish and English separators. */
function readings(written: string): number[] {
  const candidates = new Set<string>([
    written.replace(/\./g, '').replace(',', '.'), // 184.500,00 -> 184500.00 ; 68080,50 -> 68080.50
    written.replace(/,/g, ''), // 12,300.00 -> 12300.00
    written.replace(/[.,]/g, ''), // digits only
  ]);
  return [...candidates]
    .filter((c) => /\d/.test(c))
    .map(Number)
    .filter(Number.isFinite);
}

/**
 * Every number-like token of the text, parsed with Polish and English separators. A space is
 * both the Polish thousands separator and the gap between table columns
 * (`55 350,00 12 730,50 68 080,50`), so every run of up to MAX_GROUPS adjacent groups is read.
 */
export function numericTokens(text: string): number[] {
  // `\s` also covers the no-break and narrow no-break spaces used as thousands separators.
  const matches = text.match(/\d[\d\s.,]*\d|\d/g) ?? [];
  const out: number[] = [];
  for (const raw of matches) {
    const groups = raw.split(/\s+/);
    for (let from = 0; from < groups.length; from++) {
      const last = Math.min(groups.length, from + MAX_GROUPS);
      for (let to = from + 1; to <= last; to++) {
        out.push(...readings(groups.slice(from, to).join('')));
      }
    }
  }
  return out;
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
