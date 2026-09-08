import type {
  DeliveryReport,
  Endpoint,
  FailureRule,
  ProjectStats,
  RequestLogEntry,
  Suggestions,
  WebhookProvider,
} from '@mockflow/shared-types';
import { MockFlowError } from './errors';

export interface MockFlowClientOptions {
  /** Base URL of the MockFlow API, e.g. http://localhost:4000 */
  baseUrl: string;
  /** JWT access token. `login()` sets this for you. */
  token?: string;
  /** Workspace API key, used when no token is set. */
  apiKey?: string;
  /** Injected for tests, or to add retries/proxying around the transport. */
  fetch?: typeof fetch;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
}

export interface Webhook {
  id: string;
  name: string;
  provider: WebhookProvider;
  targetUrl: string;
  createdAt: string;
}

/**
 * Typed client for the MockFlow API.
 *
 * Project-scoped calls hang off `client.project(id)` so the id is given once
 * rather than threaded through every call.
 */
export class MockFlowClient {
  private token?: string;
  private readonly apiKey?: string;
  private readonly transport: typeof fetch;
  readonly baseUrl: string;

  constructor(options: MockFlowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.apiKey = options.apiKey;
    this.transport = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Logs in and remembers the access token for subsequent calls. */
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.request<{
      accessToken: string;
      refreshToken: string;
    }>('POST', '/api/auth/login', { email, password });
    this.token = tokens.accessToken;
    return tokens;
  }

  /** Sets the access token directly, e.g. one restored from disk. */
  setToken(token: string): void {
    this.token = token;
  }

  me(): Promise<unknown> {
    return this.request('GET', '/api/me');
  }

  workspaces(): Promise<Workspace[]> {
    return this.request('GET', '/api/workspaces');
  }

  projects(workspaceId: string): Promise<Project[]> {
    return this.request('GET', `/api/workspaces/${workspaceId}/projects`);
  }

  createProject(workspaceId: string, name: string): Promise<Project> {
    return this.request('POST', `/api/workspaces/${workspaceId}/projects`, {
      name,
    });
  }

  /** Everything scoped to one project. */
  project(projectId: string): ProjectClient {
    return new ProjectClient(this, projectId);
  }

  /** The public URL a mock path is served from. */
  mockUrl(projectId: string, path = ''): string {
    return `${this.baseUrl}/mock/${projectId}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /** @internal — shared by the sub-clients. */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    else if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const res = await this.transport(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    const parsed = text ? safeJson(text) : null;
    if (!res.ok) {
      throw new MockFlowError(res.status, res.statusText, parsed ?? text, url);
    }
    return parsed as T;
  }
}

/** Project-scoped operations. Obtained from `client.project(id)`. */
export class ProjectClient {
  constructor(
    private readonly client: MockFlowClient,
    readonly projectId: string,
  ) {}

  private path(suffix: string): string {
    return `/api/projects/${this.projectId}${suffix}`;
  }

  /** Uploads an OpenAPI/Swagger document, creating or updating endpoints. */
  importSpec(spec: unknown): Promise<{ title: string | null; imported: number }> {
    return this.client.request('POST', this.path('/import'), spec);
  }

  endpoints(): Promise<Endpoint[]> {
    return this.client.request('GET', this.path('/endpoints'));
  }

  updateEndpoint(
    endpointId: string,
    patch: {
      statusCode?: number;
      body?: unknown;
      description?: string;
      stateful?: boolean;
      failureRules?: FailureRule[];
    },
  ): Promise<{ updated: boolean }> {
    return this.client.request(
      'PATCH',
      this.path(`/endpoints/${endpointId}`),
      patch,
    );
  }

  /** Replaces an endpoint's failure rules. Pass `[]` to clear them. */
  setFailureRules(
    endpointId: string,
    rules: FailureRule[],
  ): Promise<{ updated: boolean }> {
    return this.updateEndpoint(endpointId, { failureRules: rules });
  }

  logs(limit = 50): Promise<RequestLogEntry[]> {
    return this.client.request('GET', this.path(`/logs?limit=${limit}`));
  }

  stats(): Promise<ProjectStats> {
    return this.client.request('GET', this.path('/stats'));
  }

  mockUrl(path = ''): string {
    return this.client.mockUrl(this.projectId, path);
  }

  /** Fills an endpoint's response with generated data. */
  generate(
    endpointId: string,
    options: {
      count?: number;
      hint?: string;
      seed?: number;
      local?: boolean;
      save?: boolean;
    } = {},
  ): Promise<{ source: 'openai' | 'local'; data: unknown; saved: boolean }> {
    return this.client.request(
      'POST',
      this.path(`/ai/endpoints/${endpointId}/generate`),
      options,
    );
  }

  /** Examples, validation rules and a starting test suite for an endpoint. */
  suggest(endpointId: string, local = false): Promise<Suggestions> {
    return this.client.request(
      'POST',
      this.path(`/ai/endpoints/${endpointId}/suggest${local ? '?local=true' : ''}`),
      {},
    );
  }

  get webhooks(): WebhooksClient {
    return new WebhooksClient(this.client, this.projectId);
  }
}

/** Webhook simulation for one project. */
export class WebhooksClient {
  constructor(
    private readonly client: MockFlowClient,
    private readonly projectId: string,
  ) {}

  private path(suffix: string): string {
    return `/api/projects/${this.projectId}/webhooks${suffix}`;
  }

  /** The secret comes back only here — store it if you need to verify locally. */
  create(input: {
    name: string;
    provider: WebhookProvider;
    targetUrl: string;
    secret?: string;
  }): Promise<Webhook & { secret: string; signatureHeader: string }> {
    return this.client.request('POST', this.path(''), input);
  }

  list(): Promise<Webhook[]> {
    return this.client.request('GET', this.path(''));
  }

  remove(webhookId: string): Promise<{ deleted: boolean }> {
    return this.client.request('DELETE', this.path(`/${webhookId}`));
  }

  /** Fires a signed delivery, retrying until it lands or attempts run out. */
  send(
    webhookId: string,
    input: { event: string; payload?: unknown; maxAttempts?: number },
  ): Promise<DeliveryReport> {
    return this.client.request('POST', this.path(`/${webhookId}/send`), input);
  }

  deliveries(webhookId: string, limit = 50): Promise<unknown[]> {
    return this.client.request(
      'GET',
      this.path(`/${webhookId}/deliveries?limit=${limit}`),
    );
  }

  providers(): Promise<Array<{ provider: WebhookProvider; events: string[] }>> {
    return this.client.request('GET', this.path('/providers'));
  }

  sample(
    provider: WebhookProvider,
    event?: string,
  ): Promise<{ provider: string; event: string; payload: unknown }> {
    const query = event ? `?event=${encodeURIComponent(event)}` : '';
    return this.client.request(
      'GET',
      this.path(`/providers/${provider}/sample${query}`),
    );
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
