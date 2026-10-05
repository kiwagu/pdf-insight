import { AnalysisTimeoutError } from './errors.ts';

/** The longest a single model call may take, however much of the budget is left. */
export const MODEL_CALL_TIMEOUT_MS = 60_000;
/** The least budget a retry needs to be worth starting. */
export const MIN_RETRY_BUDGET_MS = 20_000;

/** The time left for one analysis. Model calls, retries and the reduce step all draw on it. */
export interface Deadline {
  remainingMs: () => number;
}

/** A deadline `budgetMs` after the moment of the call, measured by `clock` (epoch milliseconds). */
export function createDeadline(budgetMs: number, clock: () => number): Deadline {
  const end = clock() + budgetMs;
  return { remainingMs: () => end - clock() };
}

/** No deadline at all: every model call gets the full single-call timeout. */
export const NO_DEADLINE: Deadline = { remainingMs: () => Number.POSITIVE_INFINITY };

/**
 * Settles as `work` does, or fails as a timeout once the deadline passes, whichever comes first.
 * On expiry `onExpire` runs, so the work can be told to stop (an abort, a stream cancel); work that
 * cannot be stopped is left to settle on its own and its outcome is ignored. The timeout is not
 * retryable: the budget it ends is the whole analysis's.
 */
export function withinDeadline<T>(
  work: Promise<T>,
  deadline: Deadline,
  onExpire?: () => void,
): Promise<T> {
  const spent = () => new AnalysisTimeoutError('the analysis time budget is spent', false);
  const remaining = deadline.remainingMs();
  if (remaining <= 0) {
    work.catch(() => undefined);
    onExpire?.();
    return Promise.reject(spent());
  }
  if (!Number.isFinite(remaining)) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(spent());
      onExpire?.();
    }, remaining);
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}
