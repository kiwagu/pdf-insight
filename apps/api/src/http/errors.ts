import type { AnalyzeResponse, ApiErrorCode } from '@pdf-insight/contracts';

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  origin_forbidden: 403,
  payload_too_large: 413,
  rate_limited: 429,
  analysis_failed: 502,
  upstream_error: 503,
  analysis_timeout: 504,
};

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  retryable: boolean,
  headers: Record<string, string>,
): Response {
  const body: AnalyzeResponse = { ok: false, error: { code, message, retryable } };
  return new Response(JSON.stringify(body), {
    status: STATUS[code],
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
