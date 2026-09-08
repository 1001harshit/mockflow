import { describe, expect, it, vi } from 'vitest';
import { MockFlowClient } from './client';
import { MockFlowError } from './errors';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** Records every request and replies with whatever the test queued. */
function stub(replies: Array<{ status?: number; body?: unknown }> = [{}]) {
  const calls: Call[] = [];
  let i = 0;
  const transport = vi.fn(async (url: string, init: any) => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    const reply = replies[Math.min(i++, replies.length - 1)];
    return new Response(JSON.stringify(reply.body ?? { ok: true }), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { calls, transport: transport as unknown as typeof fetch };
}

const client = (opts: any = {}, transport?: typeof fetch) =>
  new MockFlowClient({ baseUrl: 'http://api.test', fetch: transport, ...opts });

describe('MockFlowClient transport', () => {
  it('trims a trailing slash from the base URL', () => {
    expect(client({ baseUrl: 'http://api.test/' }).baseUrl).toBe('http://api.test');
  });

  it('sends the bearer token once logged in', async () => {
    const { calls, transport } = stub([
      { body: { accessToken: 'tok', refreshToken: 'ref' } },
      { body: [] },
    ]);
    const c = client({}, transport);

    await c.login('dev@example.com', 'secret');
    await c.workspaces();

    expect(calls[0].headers.authorization).toBeUndefined();
    expect(calls[1].headers.authorization).toBe('Bearer tok');
  });

  it('falls back to the API key when there is no token', async () => {
    const { calls, transport } = stub();
    await client({ apiKey: 'key_123' }, transport).workspaces();
    expect(calls[0].headers['x-api-key']).toBe('key_123');
    expect(calls[0].headers.authorization).toBeUndefined();
  });

  it('prefers the token over the API key', async () => {
    const { calls, transport } = stub();
    await client({ apiKey: 'key_123', token: 'tok' }, transport).workspaces();
    expect(calls[0].headers.authorization).toBe('Bearer tok');
    expect(calls[0].headers['x-api-key']).toBeUndefined();
  });

  it('omits a content-type on requests with no body', async () => {
    const { calls, transport } = stub();
    await client({}, transport).workspaces();
    expect(calls[0].headers['content-type']).toBeUndefined();
  });

  it('throws MockFlowError carrying the status and server message', async () => {
    const { transport } = stub([
      { status: 400, body: { message: ['percent must not be greater than 100'] } },
    ]);
    const error = await client({}, transport)
      .workspaces()
      .catch((e) => e);

    expect(error).toBeInstanceOf(MockFlowError);
    expect(error.status).toBe(400);
    expect(error.message).toContain('percent must not be greater than 100');
    expect(error.retryable).toBe(false);
  });

  it('marks 5xx and 429 as retryable', async () => {
    for (const status of [500, 503, 429]) {
      const { transport } = stub([{ status }]);
      const error = await client({}, transport).workspaces().catch((e) => e);
      expect(error.retryable, String(status)).toBe(true);
    }
  });
});

describe('MockFlowClient routes', () => {
  it('builds mock URLs with or without a leading slash', () => {
    const c = client();
    expect(c.mockUrl('p1', '/orders')).toBe('http://api.test/mock/p1/orders');
    expect(c.mockUrl('p1', 'orders')).toBe('http://api.test/mock/p1/orders');
    expect(c.project('p1').mockUrl('/orders')).toBe('http://api.test/mock/p1/orders');
  });

  it('scopes project calls to their id', async () => {
    const { calls, transport } = stub([{ body: [] }, { body: {} }]);
    const project = client({ token: 't' }, transport).project('p1');

    await project.endpoints();
    await project.stats();

    expect(calls[0].url).toBe('http://api.test/api/projects/p1/endpoints');
    expect(calls[1].url).toBe('http://api.test/api/projects/p1/stats');
  });

  it('sends failure rules as a PATCH on the endpoint', async () => {
    const { calls, transport } = stub();
    await client({ token: 't' }, transport)
      .project('p1')
      .setFailureRules('e1', [{ type: 'error', percent: 25, statusCode: 502 }]);

    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toBe('http://api.test/api/projects/p1/endpoints/e1');
    expect(calls[0].body).toEqual({
      failureRules: [{ type: 'error', percent: 25, statusCode: 502 }],
    });
  });

  it('passes the local flag through as a query parameter', async () => {
    const { calls, transport } = stub();
    await client({ token: 't' }, transport).project('p1').suggest('e1', true);
    expect(calls[0].url).toContain('/ai/endpoints/e1/suggest?local=true');
  });

  it('posts generation options as the body', async () => {
    const { calls, transport } = stub();
    await client({ token: 't' }, transport)
      .project('p1')
      .generate('e1', { count: 10, save: true });
    expect(calls[0].body).toEqual({ count: 10, save: true });
  });

  it('routes webhook calls under the project', async () => {
    const { calls, transport } = stub([{ body: {} }, { body: {} }, { body: [] }]);
    const hooks = client({ token: 't' }, transport).project('p1').webhooks;

    await hooks.create({
      name: 'Payments',
      provider: 'stripe',
      targetUrl: 'http://localhost:9/h',
    });
    await hooks.send('w1', { event: 'payment.captured' });
    await hooks.providers();

    expect(calls[0].url).toBe('http://api.test/api/projects/p1/webhooks');
    expect(calls[1].url).toBe('http://api.test/api/projects/p1/webhooks/w1/send');
    expect(calls[2].url).toBe('http://api.test/api/projects/p1/webhooks/providers');
  });

  it('encodes event names in the sample query', async () => {
    const { calls, transport } = stub();
    await client({ token: 't' }, transport)
      .project('p1')
      .webhooks.sample('shopify', 'orders/create');
    expect(calls[0].url).toContain('event=orders%2Fcreate');
  });

  it('sends the spec itself as the import body', async () => {
    const { calls, transport } = stub();
    const spec = { openapi: '3.0.0', paths: {} };
    await client({ token: 't' }, transport).project('p1').importSpec(spec);
    expect(calls[0].body).toEqual(spec);
  });
});
