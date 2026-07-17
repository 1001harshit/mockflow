// Types shared across the API, dashboard, SDK, and CLI.

export const API_VERSION = 'v1';

export type Uuid = string;

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  uptime: number;
}

/** Failure-simulation rule (Phase 5). */
export interface FailureRule {
  type: 'error' | 'slow' | 'timeout' | 'network' | 'db_down';
  /** Probability 0..100 that this rule fires on a given request. */
  percent: number;
  /** For `error`: the status code to return. */
  statusCode?: number;
  /** For `slow`: extra delay in milliseconds. */
  delayMs?: number;
}
