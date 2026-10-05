import { describe, expect, it, vi } from 'vitest';
import { createDeadline } from './deadline.ts';
import { AnalysisTimeoutError, ModelOutputInvalidError, ModelUpstreamError } from './errors.ts';
import { withOneRetry } from './retry.ts';

/** A clock the test moves by hand, and a deadline `budgetMs` ahead of it. */
function manualDeadline(budgetMs: number) {
  let now = 1_000_000;
  const deadline = createDeadline(budgetMs, () => now);
  return { deadline, advance: (ms: number) => (now += ms) };
}

describe('withOneRetry', () => {
  it('returns the first successful value without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withOneRetry(fn, { delayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('retries exactly once on a retryable failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ModelOutputInvalidError())
      .mockResolvedValue('second');
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(withOneRetry(fn, { delayMs: 1000, sleep })).resolves.toBe('second');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
  it('gives up after the second failure', async () => {
    const fn = vi.fn().mockRejectedValue(new ModelOutputInvalidError());
    await expect(withOneRetry(fn, { delayMs: 0 })).rejects.toBeInstanceOf(ModelOutputInvalidError);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('does not retry a non-retryable failure', async () => {
    const fn = vi.fn().mockRejectedValue(new ModelUpstreamError('bad key', false));
    await expect(withOneRetry(fn, { delayMs: 0 })).rejects.toBeInstanceOf(ModelUpstreamError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('gives each attempt 60 s, or less when less of the budget is left', async () => {
    const { deadline, advance } = manualDeadline(140_000);
    const fn = vi
      .fn<(attempt: { timeoutMs: number }) => Promise<string>>()
      .mockImplementationOnce(() => {
        advance(100_000);
        return Promise.reject(new ModelOutputInvalidError());
      })
      .mockResolvedValue('second');
    await expect(withOneRetry(fn, { delayMs: 1000, deadline })).resolves.toBe('second');
    expect(fn.mock.calls.map(([attempt]) => attempt.timeoutMs)).toEqual([60_000, 40_000]);
  });
  it('skips the retry when less than 20 s of the budget would be left for it', async () => {
    const { deadline, advance } = manualDeadline(140_000);
    const first = new ModelOutputInvalidError();
    const fn = vi.fn().mockImplementation(() => {
      advance(119_500);
      return Promise.reject(first);
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(withOneRetry(fn, { delayMs: 1000, sleep, deadline })).rejects.toBe(first);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it('still retries with exactly 20 s left after the delay', async () => {
    const { deadline, advance } = manualDeadline(140_000);
    const fn = vi
      .fn<(attempt: { timeoutMs: number }) => Promise<string>>()
      .mockImplementationOnce(() => {
        advance(119_000);
        return Promise.reject(new ModelUpstreamError('overloaded', true));
      })
      .mockResolvedValue('second');
    const sleep = vi.fn((ms: number) => {
      advance(ms);
      return Promise.resolve();
    });
    await expect(withOneRetry(fn, { delayMs: 1000, sleep, deadline })).resolves.toBe('second');
    expect(fn.mock.calls[1]?.[0].timeoutMs).toBe(20_000);
  });
  it('starts no attempt once the budget is spent', async () => {
    const { deadline, advance } = manualDeadline(140_000);
    advance(140_000);
    const fn = vi.fn();
    await expect(withOneRetry(fn, { delayMs: 0, deadline })).rejects.toBeInstanceOf(
      AnalysisTimeoutError,
    );
    expect(fn).not.toHaveBeenCalled();
  });
});
