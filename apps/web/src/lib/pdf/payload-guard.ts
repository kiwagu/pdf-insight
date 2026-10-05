import type { ExtractedDocument } from '@pdf-insight/domain';
import { toAnalyzeRequest } from '../../api/analyze-client';

export const MAX_REQUEST_BYTES = 6_000_000;

/** The exact size of the body the analyzer client sends: the same request object, serialized as
 *  JSON and encoded as UTF-8, so escapes and multi-byte characters are counted. */
export function estimateRequestBytes(doc: ExtractedDocument): number {
  return new TextEncoder().encode(JSON.stringify(toAnalyzeRequest(doc))).length;
}

export const exceedsPayloadCap = (doc: ExtractedDocument): boolean =>
  estimateRequestBytes(doc) > MAX_REQUEST_BYTES;
