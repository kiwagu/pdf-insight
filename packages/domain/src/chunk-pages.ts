import type { Chunk } from './document.ts';

const label = (page: number, text: string): string => `[page ${page}]\n${text}`;

export function chunkPages(pageTexts: string[], options: { maxChars: number }): Chunk[] {
  const chunks: Chunk[] = [];
  let parts: string[] = [];
  let fromPage = 1;
  let size = 0;
  const flush = (toPage: number): void => {
    if (parts.length === 0) return;
    chunks.push({ index: chunks.length, fromPage, toPage, text: parts.join('\n\n') });
    parts = [];
    size = 0;
  };
  pageTexts.forEach((text, i) => {
    const page = i + 1;
    const labelled = label(page, text);
    if (parts.length > 0 && size + labelled.length > options.maxChars) {
      flush(page - 1);
      fromPage = page;
    }
    if (parts.length === 0) fromPage = page;
    parts.push(labelled);
    size += labelled.length;
  });
  flush(pageTexts.length);
  return chunks;
}
