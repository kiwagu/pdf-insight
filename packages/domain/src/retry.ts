import {
  MIN_RETRY_BUDGET_MS,
  MODEL_CALL_TIMEOUT_MS,
  NO_DEADLINE,
  type Deadline,
} from './deadline.ts';
import { AnalysisTimeoutError } from './errors.ts';
import type { ModelCallOptions } from './ports.ts';

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const isRetryable = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && 'retryable' in e && e.retryable === true;

export interface RetryOptions {
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
  /** The analysis budget the attempts draw on; without one, each attempt gets the full timeout. */
  deadline?: Deadline;
}

/**
 * Runs `fn` and, after a retryable failure, once more. Each attempt gets the single-call timeout or
 * the budget left, whichever is shorter; the retry runs only when at least `MIN_RETRY_BUDGET_MS`
 * would be left for it after the delay, otherwise the first failure stands. Once the budget is
 * spent no attempt starts at all.
 */
export async function withOneRetry<T>(
  fn: (options: ModelCallOptions) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const deadline = options.deadline ?? NO_DEADLINE;
  const attempt = async (): Promise<T> => {
    const remaining = deadline.remainingMs();
    if (remaining <= 0) {
      throw new AnalysisTimeoutError('the analysis time budget is spent', false);
    }
    return fn({ timeoutMs: Math.floor(Math.min(MODEL_CALL_TIMEOUT_MS, remaining)) });
  };
  try {
    return await attempt();
  } catch (first) {
    if (!isRetryable(first)) throw first;
    if (deadline.remainingMs() - options.delayMs < MIN_RETRY_BUDGET_MS) throw first;
    await (options.sleep ?? defaultSleep)(options.delayMs);
    return attempt();
  }
}
