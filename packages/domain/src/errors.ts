import type { ApiErrorCode } from '@pdf-insight/contracts';

export type AnalysisErrorCode =
  | ApiErrorCode
  | 'invalid_file'
  | 'too_large'
  | 'extraction_failed'
  | 'network'
  | 'invalid_response';

export class AnalysisError extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
    public readonly retryable: boolean,
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
