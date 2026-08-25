export type FailureType = 'error' | 'slow' | 'timeout' | 'network' | 'db_down';

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

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function req<T = unknown>(
  path: string,
  options: RequestInit = {},
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
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status} ${res.statusText} ${detail}`);
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json')
    ? res.json()
    : res.text()) as Promise<T>;
}

export const api = {
  base: BASE,
  login: (email: string, password: string) =>
    req<{ accessToken: string }>('/api/auth/login', {
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
  importSpec: (pid: string, spec: unknown) =>
    req(`/api/projects/${pid}/import`, {
      method: 'POST',
      body: JSON.stringify(spec),
    }),
};
