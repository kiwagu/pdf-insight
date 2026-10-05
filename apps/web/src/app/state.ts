import type { AnalysisResult } from '@pdf-insight/contracts';
import type { AnalysisError, AnalysisErrorCode, Stage } from '@pdf-insight/domain';
import type { MessageKey } from '@pdf-insight/i18n';

export type AppState =
  | { status: 'idle' }
  | { status: 'extracting' }
  | { status: 'analyzing'; pages: number | undefined }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; code: AnalysisErrorCode; message: string; retryable: boolean };

export type AppAction =
  | { type: 'start' }
  | { type: 'stage'; stage: Stage; pages?: number }
  | { type: 'done'; result: AnalysisResult }
  | { type: 'fail'; error: AnalysisError }
  | { type: 'restore'; result: AnalysisResult }
  | { type: 'reset' };

export const initialState: AppState = { status: 'idle' };

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'start':
      return { status: 'extracting' };
    case 'stage':
      return action.stage === 'extracting'
        ? { status: 'extracting' }
        : { status: 'analyzing', pages: action.pages };
    case 'done':
    case 'restore':
      return { status: 'done', result: action.result };
    case 'fail':
      return {
        status: 'error',
        code: action.error.code,
        message: action.error.message,
        retryable: action.error.retryable,
      };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

// Literal keys, one per code: a new code without a catalog message fails to compile here.
const ERROR_KEYS: Record<AnalysisErrorCode, MessageKey> = {
  invalid_request: 'error.invalid_request',
  payload_too_large: 'error.payload_too_large',
  origin_forbidden: 'error.origin_forbidden',
  rate_limited: 'error.rate_limited',
  analysis_failed: 'error.analysis_failed',
  upstream_error: 'error.upstream_error',
  invalid_file: 'error.invalid_file',
  too_large: 'error.too_large',
  extraction_failed: 'error.extraction_failed',
  network: 'error.network',
  invalid_response: 'error.invalid_response',
};

export function errorKeyFor(code: AnalysisErrorCode): MessageKey {
  return ERROR_KEYS[code];
}
