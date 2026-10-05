import { describe, expect, it } from 'vitest';
import { AnalysisError } from '@pdf-insight/domain';
import { errorKeyFor, initialState, reducer } from './state';

describe('reducer', () => {
  it('walks idle -> extracting -> analyzing -> done', () => {
    let s = reducer(initialState, { type: 'start' });
    expect(s.status).toBe('extracting');
    s = reducer(s, { type: 'stage', stage: 'analyzing', pages: 12 });
    expect(s).toEqual({ status: 'analyzing', pages: 12 });
    s = reducer(s, { type: 'done', result: {} as never });
    expect(s.status).toBe('done');
  });
  it('records an error with retryability and goes back to idle on reset', () => {
    const s = reducer(
      { status: 'analyzing', pages: 1 },
      { type: 'fail', error: new AnalysisError('rate_limited', 'slow', true) },
    );
    expect(s).toEqual({ status: 'error', code: 'rate_limited', message: 'slow', retryable: true });
    expect(reducer(s, { type: 'reset' })).toEqual(initialState);
  });
  it('maps every error code to a catalog key', () => {
    expect(errorKeyFor('rate_limited')).toBe('error.rate_limited');
    expect(errorKeyFor('too_large')).toBe('error.too_large');
    expect(errorKeyFor('invalid_file')).toBe('error.invalid_file');
  });
});
