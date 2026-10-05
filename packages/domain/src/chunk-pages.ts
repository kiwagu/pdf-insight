import type { Chunk } from './document.ts';

const SEPARATOR = '\n\n';

const label = (page: number, text: string): string => `[page ${page}]\n${text}`;

/**
 * Groups labelled pages into chunks of at most `maxChars` characters, separators included,
 * splitting only between pages. A page longer than `maxChars` on its own becomes its own chunk.
 */
export function chunkPages(pageTexts: string[], options: { maxChars: number }): Chunk[] {
  const chunks: Chunk[] = [];
  let parts: string[] = [];
  let fromPage = 1;
  let size = 0; // always parts.join(SEPARATOR).length
  const flush = (toPage: number): void => {
    if (parts.length === 0) return;
    chunks.push({ index: chunks.length, fromPage, toPage, text: parts.join(SEPARATOR) });
    parts = [];
    size = 0;
  };
  pageTexts.forEach((text, i) => {
    const page = i + 1;
    const labelled = label(page, text);
    if (parts.length > 0 && size + SEPARATOR.length + labelled.length > options.maxChars) {
      flush(page - 1);
    }
    if (parts.length === 0) fromPage = page;
    size += (parts.length > 0 ? SEPARATOR.length : 0) + labelled.length;
    parts.push(labelled);
  });
  flush(pageTexts.length);
  return chunks;
}
