import {
  analyzeResponseSchema,
  CLIENT_TIMEOUT_MS,
  type AnalyzeRequestInput,
} from '@pdf-insight/contracts';
import { AnalysisError, type DocumentAnalyzer, type ExtractedDocument } from '@pdf-insight/domain';

/** The request body sent to the analyze endpoint; the payload guard measures this same value. */
export function toAnalyzeRequest(doc: ExtractedDocument): AnalyzeRequestInput {
  return {
    fileName: doc.fileName,
    pages: doc.pages,
    pageTexts: doc.pageTexts,
    scannedPages: doc.scannedPages,
  };
}

export function createHttpAnalyzer(
  baseUrl: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): DocumentAnalyzer {
  const fetchImpl = options.fetchImpl ?? fetch;
  // Longer than the server's own analysis budget, so a slow but successful answer still arrives.
  const timeoutMs = options.timeoutMs ?? CLIENT_TIMEOUT_MS;
  return {
    async analyze(doc) {
      // The timeout covers the whole exchange, body included: a stalled body aborts too.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let json: unknown;
      try {
        let response: Response;
        try {
          response = await fetchImpl(baseUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(toAnalyzeRequest(doc)),
            signal: controller.signal,
          });
        } catch {
          if (controller.signal.aborted) {
            throw new AnalysisError('network', 'The analysis service stopped responding.', true);
          }
          throw new AnalysisError('network', 'Could not reach the analysis service.', true);
        }
        try {
          json = await response.json();
        } catch {
          if (controller.signal.aborted) {
            throw new AnalysisError('network', 'The analysis service stopped responding.', true);
          }
          throw new AnalysisError(
            'invalid_response',
            `Unexpected response (${response.status}).`,
            true,
          );
        }
      } finally {
        clearTimeout(timer);
      }
      const parsed = analyzeResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new AnalysisError('invalid_response', 'Response did not match the contract.', true);
      }
      if (!parsed.data.ok) {
        throw new AnalysisError(
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.retryable,
        );
      }
      return parsed.data.result;
    },
  };
}
