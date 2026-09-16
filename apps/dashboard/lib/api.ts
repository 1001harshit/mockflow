export type FailureType = 'error' | 'slow' | 'timeout' | 'network' | 'db_down';

export type WebhookProvider =
  | 'stripe'
  | 'github'
  | 'slack'
  | 'shopify'
  | 'razorpay'
  | 'discord'
  | 'custom';

export interface FailureRule {
  type: FailureType;
  percent: number;
  statusCode?: number;
  delayMs?: number;
  enabled?: boolean;
  body?: unknown;
}

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'mockflow_token';
const REFRESH_KEY = 'mockflow_refresh';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string, refreshToken?: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
}
export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

/**
 * Access tokens last 15 minutes. Without this the dashboard simply starts
 * failing every request once that runs out, which reads as the app being
 * broken rather than the session having ended.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const res = await fetch(BASE + '/api/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    accessToken?: string;
    refreshToken?: string;
  };
  if (!data.accessToken) return null;
  setToken(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function req<T = unknown>(
  path: string,
  options: RequestInit = {},
  retrying = false,
): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  // Expired access token: renew once and replay, rather than surfacing a 401
  // the user can do nothing about. If the refresh token is gone too, the
  // session really has ended — send them to log in again.
  if (res.status === 401 && !retrying && path !== '/api/auth/login') {
    const renewed = await refreshAccessToken();
    if (renewed) return req<T>(path, options, true);
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    // Surface the server's own words. Nest returns `message` as a string or an
    // array of validation failures; either is far more useful to read than the
    // raw JSON envelope this used to print.
    let detail = '';
    try {
      const body = (await res.json()) as { message?: unknown };
      const message = body?.message;
      if (Array.isArray(message)) detail = message.join('\n');
      else if (typeof message === 'string') detail = message;
    } catch {
      /* no JSON body */
    }
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json')
    ? res.json()
    : res.text()) as Promise<T>;
}

export const api = {
  base: BASE,
  login: (email: string, password: string) =>
    req<{ accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => req('/api/me'),
  workspaces: () =>
    req<Array<{ id: string; name: string; slug: string; role: string }>>(
      '/api/workspaces',
    ),
  projects: (wsId: string) =>
    req<Array<{ id: string; name: string; slug: string }>>(
      `/api/workspaces/${wsId}/projects`,
    ),
  createProject: (wsId: string, name: string) =>
    req(`/api/workspaces/${wsId}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  project: (pid: string) =>
    req<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      createdAt: string;
      workspace: { id: string; name: string };
      _count: { endpoints: number; requestLogs: number; webhooks: number };
    }>(`/api/projects/${pid}`),
  endpoints: (pid: string) =>
    req<
      Array<{
        id: string;
        method: string;
        path: string;
        description?: string;
        stateful: boolean;
        failureRules: FailureRule[] | null;
        responses: Array<{ statusCode: number }>;
      }>
    >(`/api/projects/${pid}/endpoints`),
  updateEndpoint: (
    pid: string,
    endpointId: string,
    patch: { failureRules?: FailureRule[]; stateful?: boolean },
  ) =>
    req(`/api/projects/${pid}/endpoints/${endpointId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  stats: (pid: string) =>
    req<{
      totalRequests: number;
      sampleSize: number;
      errorRate: number;
      injectedFailures: {
        count: number;
        rate: number;
        byType: Record<string, number>;
      };
      latencyMs: { avg: number; p50: number; p95: number; p99: number };
    }>(`/api/projects/${pid}/stats`),
  logs: (pid: string, limit = 20) =>
    req<
      Array<{
        id: string;
        method: string;
        path: string;
        statusCode: number;
        latencyMs: number;
        failureType: FailureType | null;
        createdAt: string;
      }>
    >(`/api/projects/${pid}/logs?limit=${limit}`),
  /** Fill an endpoint's stored response with believable data. */
  generate: (
    pid: string,
    endpointId: string,
    options: { count?: number; hint?: string; seed?: number; local?: boolean; save?: boolean } = {},
  ) =>
    req<{ source: 'openai' | 'local'; data: unknown; saved: boolean }>(
      `/api/projects/${pid}/ai/endpoints/${endpointId}/generate`,
      { method: 'POST', body: JSON.stringify(options) },
    ),
  aiStatus: (pid: string) =>
    req<{ provider: string; configured: boolean; fallback: string }>(
      `/api/projects/${pid}/ai/status`,
    ),

  /* ---------- webhooks ---------- */
  webhooks: (pid: string) =>
    req<
      Array<{
        id: string;
        name: string;
        provider: WebhookProvider;
        targetUrl: string;
        createdAt: string;
        _count: { deliveries: number };
      }>
    >(`/api/projects/${pid}/webhooks`),
  webhookProviders: (pid: string) =>
    req<Array<{ provider: WebhookProvider; events: string[] }>>(
      `/api/projects/${pid}/webhooks/providers`,
    ),
  createWebhook: (
    pid: string,
    input: { name: string; provider: WebhookProvider; targetUrl: string },
  ) =>
    req<{ id: string; secret: string; signatureHeader: string }>(
      `/api/projects/${pid}/webhooks`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  deleteWebhook: (pid: string, webhookId: string) =>
    req<{ deleted: boolean }>(`/api/projects/${pid}/webhooks/${webhookId}`, {
      method: 'DELETE',
    }),
  sendWebhook: (
    pid: string,
    webhookId: string,
    input: { event: string; payload?: unknown; maxAttempts?: number },
  ) =>
    req<{
      delivered: boolean;
      event: string;
      signatureHeader: string;
      attempts: Array<{
        attempt: number;
        statusCode: number | null;
        success: boolean;
        error?: string;
      }>;
    }>(`/api/projects/${pid}/webhooks/${webhookId}/send`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deliveries: (pid: string, webhookId: string, limit = 20) =>
    req<
      Array<{
        id: string;
        event: string;
        attempt: number;
        success: boolean;
        statusCode: number | null;
        createdAt: string;
      }>
    >(`/api/projects/${pid}/webhooks/${webhookId}/deliveries?limit=${limit}`),

  importSpec: (pid: string, spec: unknown) =>
    req(`/api/projects/${pid}/import`, {
      method: 'POST',
      body: JSON.stringify(spec),
    }),
};
