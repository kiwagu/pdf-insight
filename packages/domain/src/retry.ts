const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const isRetryable = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && 'retryable' in e && e.retryable === true;

export async function withOneRetry<T>(
  fn: () => Promise<T>,
  options: { delayMs: number; sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    if (!isRetryable(first)) throw first;
    await (options.sleep ?? defaultSleep)(options.delayMs);
    return fn();
  }
}
