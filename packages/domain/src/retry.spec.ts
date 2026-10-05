import { describe, expect, it, vi } from 'vitest';
import { ModelOutputInvalidError, ModelUpstreamError } from './errors.ts';
import { withOneRetry } from './retry.ts';

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
});
