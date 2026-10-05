import type {
  DocumentAnalyzer,
  ExtractedDocument,
  HistoryEntry,
  TextExtractor,
} from '@pdf-insight/domain';
import { vi } from 'vitest';
import type { Container } from '../app/container';
import { shortResult } from './fixtures';

export const extracted: ExtractedDocument = {
  fileName: 'a.pdf',
  pages: 1,
  pageTexts: ['hello world, this document has a real text layer'],
  scannedPages: [],
};

/** Container with mocked ports: the analyzer answers `shortResult` unless told otherwise. */
export const fakeContainer = (
  analyze = vi.fn<DocumentAnalyzer['analyze']>().mockResolvedValue(shortResult),
  entries: HistoryEntry[] = [],
  extract = vi.fn<TextExtractor['extract']>().mockResolvedValue(extracted),
): Container => ({
  extractor: { extract },
  analyzer: { analyze },
  history: {
    list: vi.fn<Container['history']['list']>().mockReturnValue(entries),
    save: vi.fn<Container['history']['save']>(),
    clear: vi.fn<Container['history']['clear']>(),
  },
});

/** A PDF whose upfront check waits until `release()`: validatePdfFile reads the first bytes
 *  through `slice()`, so holding those bytes holds the check. */
export function pdfWithHeldCheck(name = 'held.pdf'): { file: File; release: () => void } {
  const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });
  let release: () => void = () => undefined;
  const head = new Promise<ArrayBuffer>((resolve) => {
    release = () => resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer);
  });
  Object.defineProperty(file, 'slice', { value: () => ({ arrayBuffer: () => head }) });
  return { file, release };
}

export const entryOf = (result: HistoryEntry['result']): HistoryEntry => ({
  id: result.meta.id,
  fileName: result.document.fileName,
  analyzedAt: result.meta.analyzedAt,
  result,
});
