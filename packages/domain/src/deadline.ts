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
