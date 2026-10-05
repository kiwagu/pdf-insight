import {
  ANALYSIS_BUDGET_MS,
  analyzeRequestSchema,
  type AnalyzeResponse,
} from '@pdf-insight/contracts';
import {
  AnalysisTimeoutError,
  analyzeText,
  createDeadline,
  DEFAULT_MAX_CHUNK_CHARS,
  ModelOutputInvalidError,
  ModelUpstreamError,
  withinDeadline,
  type Deadline,
  type ModelPort,
} from '@pdf-insight/domain';
import type { ApiEnv } from './env.ts';
import { clientIp } from './http/client-ip.ts';
import { resolveCors } from './http/cors.ts';
import { errorResponse } from './http/errors.ts';
import type { RateLimiter } from './ports.ts';

export interface HandlerDeps {
  env: ApiEnv;
  model: ModelPort;
  limiter: RateLimiter;
  createRequestId: () => string;
  createAnalysisId: () => string;
  now: () => Date;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

class BodyTooLargeError extends Error {}

/**
 * Reads the body as text, giving up as soon as it exceeds `maxBytes`, whatever Content-Length said,
 * or when the deadline passes while a chunk is awaited (the body is then cancelled).
 */
async function readCappedText(
  request: Request,
  maxBytes: number,
  deadline: Deadline,
): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await withinDeadline(reader.read(), deadline, () => {
      reader.cancel().catch(() => undefined);
    });
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    // The budget counts from the request's arrival: reading the body and the rate limiter draw on
    // the same wall clock as the model calls, and every await below is bounded by it.
    const deadline = createDeadline(ANALYSIS_BUDGET_MS, () => deps.now().getTime());
    const requestId = deps.createRequestId();
    const cors = resolveCors(request.headers.get('origin'), deps.env.ALLOWED_ORIGINS);
    const headers = { ...cors.headers, 'x-request-id': requestId };
    const fail = (
      code: Parameters<typeof errorResponse>[0],
      message: string,
      retryable: boolean,
      extra: Record<string, string> = {},
    ) => errorResponse(code, message, retryable, { ...headers, ...extra });
    const timedOut = () =>
      fail('analysis_timeout', 'The analysis did not finish within the time limit.', true);

    if (request.method === 'OPTIONS') {
      return cors.allowed
        ? new Response(null, { status: 204, headers })
        : fail('origin_forbidden', 'Origin not allowed.', false);
    }
    if (!cors.allowed) return fail('origin_forbidden', 'Origin not allowed.', false);

    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path.endsWith('/healthz')) {
      try {
        await withinDeadline(deps.limiter.consume('healthz'), deadline);
      } catch (error) {
        if (error instanceof AnalysisTimeoutError) return timedOut();
        throw error;
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...JSON_HEADERS, ...headers },
      });
    }
    if (request.method !== 'POST') return fail('invalid_request', 'Method not allowed.', false);

    const tooLarge = () =>
      fail('payload_too_large', `Body exceeds ${deps.env.MAX_BODY_BYTES} bytes.`, false);
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > deps.env.MAX_BODY_BYTES) return tooLarge();

    let json: unknown;
    try {
      json = JSON.parse(await readCappedText(request, deps.env.MAX_BODY_BYTES, deadline));
    } catch (error) {
      if (error instanceof BodyTooLargeError) return tooLarge();
      if (error instanceof AnalysisTimeoutError) return timedOut();
      return fail('invalid_request', 'Body is not valid JSON.', false);
    }
    const parsed = analyzeRequestSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return fail('invalid_request', issues, false);
    }

    let verdict: Awaited<ReturnType<RateLimiter['consume']>>;
    try {
      verdict = await withinDeadline(deps.limiter.consume(clientIp(request)), deadline);
    } catch (error) {
      if (error instanceof AnalysisTimeoutError) return timedOut();
      throw error;
    }
    if (!verdict.allowed) {
      return fail('rate_limited', 'Too many requests.', true, {
        'retry-after': String(verdict.retryAfterSeconds),
      });
    }

    try {
      // Every model call already gets at most the budget left; the race is the backstop that
      // answers at the deadline even if a call overruns its own timeout.
      const result = await withinDeadline(
        analyzeText(parsed.data, {
          model: deps.model,
          modelName: deps.env.LLM_MODEL,
          createId: deps.createAnalysisId,
          now: deps.now,
          maxChunkChars: DEFAULT_MAX_CHUNK_CHARS,
          retryDelayMs: 1000,
          deadline,
        }),
        deadline,
      );
      const body: AnalyzeResponse = { ok: true, result };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...JSON_HEADERS, ...headers },
      });
    } catch (error) {
      console.error('analyze failed', requestId, error instanceof Error ? error.message : error);
      if (error instanceof AnalysisTimeoutError) return timedOut();
      if (error instanceof ModelOutputInvalidError) {
        return fail('analysis_failed', 'The model did not return a valid analysis.', true);
      }
      if (error instanceof ModelUpstreamError) {
        return fail('upstream_error', 'The AI service is unavailable.', error.retryable);
      }
      return fail('upstream_error', 'Unexpected failure.', true);
    }
  };
}
