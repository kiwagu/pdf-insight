import { analyzeResponseSchema, type AnalyzeRequestInput } from '@pdf-insight/contracts';
import { AnalysisError, type DocumentAnalyzer } from '@pdf-insight/domain';

export function createHttpAnalyzer(
  baseUrl: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): DocumentAnalyzer {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 90_000;
  return {
    async analyze(doc) {
      const body: AnalyzeRequestInput = {
        fileName: doc.fileName,
        pages: doc.pages,
        pageTexts: doc.pageTexts,
        scannedPages: doc.scannedPages,
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        throw new AnalysisError('network', 'Could not reach the analysis service.', true);
      } finally {
        clearTimeout(timer);
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new AnalysisError(
          'invalid_response',
          `Unexpected response (${response.status}).`,
          true,
        );
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
