import {
  analyzeRequestSchema,
  analyzeResponseSchema,
  CLIENT_TIMEOUT_MS,
  MAX_PAGE_TEXT_LENGTH,
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

/**
 * Checks the request against the API's own schema, so a request the API would refuse is never
 * sent. A page whose text is over the cap gets its own error naming the page; anything else the
 * schema rejects is an invalid request. Neither is retryable: the same file fails the same way.
 */
function assertSendable(request: AnalyzeRequestInput): void {
  const checked = analyzeRequestSchema.safeParse(request);
  if (checked.success) return;
  for (const issue of checked.error.issues) {
    const [field, index] = issue.path;
    if (issue.code === 'too_big' && field === 'pageTexts' && typeof index === 'number') {
      const page = index + 1;
      throw new AnalysisError(
        'page_too_large',
        `Page ${page} has more than ${MAX_PAGE_TEXT_LENGTH} characters of text.`,
        false,
        { page, max: MAX_PAGE_TEXT_LENGTH },
      );
    }
  }
  const issues = checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new AnalysisError('invalid_request', issues, false);
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
      const request = toAnalyzeRequest(doc);
      assertSendable(request);
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
            body: JSON.stringify(request),
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
