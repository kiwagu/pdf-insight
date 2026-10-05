import type { ApiErrorCode } from '@pdf-insight/contracts';

export type AnalysisErrorCode =
  | ApiErrorCode
  | 'invalid_file'
  | 'too_large'
  | 'page_too_large'
  | 'extraction_failed'
  | 'network'
  | 'invalid_response';

/** Values a localized error message names, such as a page number or a limit. */
export type AnalysisErrorParams = Record<string, string | number>;

export class AnalysisError extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly params: AnalysisErrorParams = {},
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export class ModelOutputInvalidError extends Error {
  readonly retryable = true;
  constructor(message = 'model output did not match the schema') {
    super(message);
    this.name = 'ModelOutputInvalidError';
  }
}

export class ModelUpstreamError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ModelUpstreamError';
  }
}

/**
 * A model call that ran out of time. Retryable when it hit its own single-call timeout and budget
 * remains; not retryable when the analysis budget is spent before the call could start.
 */
export class AnalysisTimeoutError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AnalysisTimeoutError';
  }
}
