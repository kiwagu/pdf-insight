import type { ExtractedDocument } from '@pdf-insight/domain';

export const MAX_REQUEST_BYTES = 6_000_000;

export function estimateRequestBytes(doc: ExtractedDocument): number {
  const text = doc.pageTexts.reduce((n, t) => n + t.length, 0);
  const images = doc.scannedPages.reduce((n, s) => n + s.imageJpegBase64.length, 0);
  return text + images + doc.fileName.length + 200;
}

export const exceedsPayloadCap = (doc: ExtractedDocument): boolean =>
  estimateRequestBytes(doc) > MAX_REQUEST_BYTES;
