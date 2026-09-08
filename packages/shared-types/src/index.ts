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
  type: FailureType;
  /** Probability 0..100 that this rule fires on a given request. */
  percent: number;
  /** For `error`: the status code to return. */
  statusCode?: number;
  /** For `slow` and `timeout`: how long to stall, in milliseconds. */
  delayMs?: number;
  /** Body to answer with, in place of the canned error payload. */
  body?: unknown;
  /** Keep the rule on the endpoint but stop it firing. */
  enabled?: boolean;
}

/** The failure types the mock plane can inject (Phase 5). */
export const FAILURE_TYPES = [
  'error',
  'slow',
  'timeout',
  'network',
  'db_down',
] as const;

export type FailureType = (typeof FAILURE_TYPES)[number];

/** Status recorded when a simulated network failure destroyed the connection. */
export const ABORTED_STATUS = 0;

/** Header carried by any answered response that a failure rule altered. */
export const FAILURE_HEADER = 'x-mockflow-failure';

export interface Endpoint {
  id: Uuid;
  method: HttpMethod;
  path: string;
  description?: string | null;
  stateful: boolean;
  failureRules: FailureRule[] | null;
  responses: Array<{ statusCode: number; body?: unknown }>;
}

export interface RequestLogEntry {
  id: Uuid;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  failureType: FailureType | null;
  createdAt: string;
}

export interface ProjectStats {
  totalRequests: number;
  sampleSize: number;
  errorRate: number;
  injectedFailures: {
    count: number;
    rate: number;
    byType: Record<string, number>;
  };
  latencyMs: { avg: number; p50: number; p95: number; p99: number };
}

/** Webhook providers MockFlow can imitate (Phase 7). */
export const WEBHOOK_PROVIDERS = [
  'stripe',
  'github',
  'slack',
  'shopify',
  'razorpay',
  'discord',
  'custom',
] as const;

export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

export interface WebhookAttempt {
  attempt: number;
  statusCode: number | null;
  success: boolean;
  error?: string;
}

export interface DeliveryReport {
  delivered: boolean;
  attempts: WebhookAttempt[];
  event: string;
  signatureHeader: string;
}

/** Schema-derived suggestions for an endpoint (Phase 6). */
export interface Suggestions {
  source: 'openai' | 'local';
  examples: Array<{ name: string; statusCode: number; body: unknown }>;
  validationRules: Array<{ field: string; rule: string; message: string }>;
  testCases: Array<{
    name: string;
    method: string;
    path: string;
    body?: unknown;
    expectStatus: number;
    note?: string;
  }>;
}
