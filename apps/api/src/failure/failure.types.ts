/**
 * Failure simulation (Phase 5).
 *
 * Every endpoint can carry a list of rules describing how often it should
 * misbehave — e.g. 10% of requests return 500, 20% are slow, 5% time out.
 * Rules are stored on `Endpoint.failureRules` as JSON.
 */

export const FAILURE_TYPES = [
  /** Return an error status (default 500) instead of the mock response. */
  'error',
  /** Serve the normal response, but only after a delay. */
  'slow',
  /** Stall for a long time, then answer 504 Gateway Timeout. */
  'timeout',
  /** Destroy the connection without replying at all (ECONNRESET). */
  'network',
  /** Answer 503 as if the backing datastore were unreachable. */
  'db_down',
] as const;

export type FailureType = (typeof FAILURE_TYPES)[number];

export interface FailureRule {
  type: FailureType;
  /** Chance this rule fires, as a percentage (0–100). */
  percent: number;
  /** `error` only — status code to return. Defaults to 500. */
  statusCode?: number;
  /** `error` / `db_down` — response body. Defaults to a canned error payload. */
  body?: unknown;
  /** `slow` / `timeout` — how long to stall, in milliseconds. */
  delayMs?: number;
  /** Keep the rule but stop it firing. Defaults to true. */
  enabled?: boolean;
}

/** Default stall for each stalling rule type, in milliseconds. */
export const DEFAULT_DELAY_MS: Record<'slow' | 'timeout', number> = {
  slow: 1_000,
  timeout: 30_000,
};

/** Upper bound on any injected delay, so a typo can't wedge a worker. */
export const MAX_DELAY_MS = 120_000;

/** Status codes used by the non-configurable failure types. */
export const TIMEOUT_STATUS = 504;
export const DB_DOWN_STATUS = 503;

/**
 * Status recorded in the request log when the socket was destroyed — there is
 * no HTTP status in that case, so 0 stands in for "no response".
 */
export const ABORTED_STATUS = 0;

/** Response header set whenever a failure was injected, for debugging. */
export const FAILURE_HEADER = 'x-mockflow-failure';

export function isFailureType(value: unknown): value is FailureType {
  return (
    typeof value === 'string' &&
    (FAILURE_TYPES as readonly string[]).includes(value)
  );
}
