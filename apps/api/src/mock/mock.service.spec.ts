import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { MockService } from './mock.service';
import { ResponseGenerator } from './response-generator.service';
import { FailureService } from '../failure/failure.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

function harness(endpoints: any[], roll = 0.99) {
  const logs: any[] = [];
  const prisma = {
    endpoint: { findMany: vi.fn(async () => endpoints) },
    requestLog: {
      create: vi.fn(async ({ data }: any) => {
        logs.push(data);
        return data;
      }),
    },
  } as any;

  const failure = new FailureService();
  failure.random = () => roll;
  failure.sleep = vi.fn(async () => undefined);

  const stateful = { handle: vi.fn(async () => ({ statusCode: 200, body: { stateful: true } })) } as any;
  const service = new MockService(prisma, new ResponseGenerator(), stateful, failure);
  return { service, logs, stateful, failure };
}

const endpoint = (path: string, over: any = {}) => ({
  id: 'e1',
  path,
  method: 'GET',
  stateful: false,
  failureRules: null,
  responseSchema: null,
  responses: [{ statusCode: 200, body: { ok: true } }],
  ...over,
});

describe('MockService path matching', () => {
  it('serves an exact path', async () => {
    const { service } = harness([endpoint('/orders')]);
    const result = await service.handle('p1', 'GET' as any, '/orders');
    expect(result).toMatchObject({ statusCode: 200, body: { ok: true } });
  });

  it('tolerates a trailing slash', async () => {
    const { service } = harness([endpoint('/orders')]);
    expect((await service.handle('p1', 'GET' as any, '/orders/')).statusCode).toBe(200);
  });

  it('matches a {param} segment', async () => {
    const { service } = harness([endpoint('/orders/{id}')]);
    expect((await service.handle('p1', 'GET' as any, '/orders/42')).statusCode).toBe(200);
  });

  it('does not let a {param} swallow extra segments', async () => {
    const { service } = harness([endpoint('/orders/{id}')]);
    expect((await service.handle('p1', 'GET' as any, '/orders/42/items')).statusCode).toBe(404);
  });

  it('404s an unmatched path and says which one', async () => {
    const { service } = harness([endpoint('/orders')]);
    const result = await service.handle('p1', 'GET' as any, '/invoices');
    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ message: 'No mock for GET /invoices' });
  });

  it('treats regex characters in a path as literal text', async () => {
    const { service } = harness([endpoint('/files/report.json')]);
    expect((await service.handle('p1', 'GET' as any, '/files/reportXjson')).statusCode).toBe(404);
    expect((await service.handle('p1', 'GET' as any, '/files/report.json')).statusCode).toBe(200);
  });

  it('generates from the schema when no example body was stored', async () => {
    const { service } = harness([
      endpoint('/orders', {
        responses: [{ statusCode: 200, body: null }],
        responseSchema: { type: 'object', properties: { n: { type: 'integer' } } },
      }),
    ]);
    expect((await service.handle('p1', 'GET' as any, '/orders')).body).toEqual({ n: 0 });
  });

  it('delegates to the stateful store when the endpoint opts in', async () => {
    const { service, stateful } = harness([endpoint('/orders', { stateful: true })]);
    const result = await service.handle('p1', 'GET' as any, '/orders');
    expect(stateful.handle).toHaveBeenCalled();
    expect(result.body).toEqual({ stateful: true });
  });
});

describe('MockService failure injection', () => {
  const withRule = (rule: any, roll = 0.0) =>
    harness([endpoint('/orders', { failureRules: [rule] })], roll);

  it('replaces the response for an error rule', async () => {
    const { service } = withRule({ type: 'error', percent: 100, statusCode: 502 });
    const result = await service.handle('p1', 'GET' as any, '/orders');
    expect(result.statusCode).toBe(502);
    expect(result.failure).toBe('error');
  });

  it('still serves the real body for a slow rule', async () => {
    const { service, failure } = withRule({ type: 'slow', percent: 100, delayMs: 250 });
    const result = await service.handle('p1', 'GET' as any, '/orders');
    expect(result.body).toEqual({ ok: true });
    expect(result.failure).toBe('slow');
    expect(failure.sleep).toHaveBeenCalledWith(250);
  });

  it('flags a network rule for the controller to abort', async () => {
    const { service } = withRule({ type: 'network', percent: 100 });
    const result = await service.handle('p1', 'GET' as any, '/orders');
    expect(result.abort).toBe(true);
    expect(result.statusCode).toBe(0);
  });

  it('leaves the response untouched when the roll misses', async () => {
    const { service } = withRule({ type: 'error', percent: 10 }, 0.99);
    const result = await service.handle('p1', 'GET' as any, '/orders');
    expect(result.statusCode).toBe(200);
    expect(result.failure).toBeUndefined();
  });

  it('ignores a malformed rules column rather than failing the request', async () => {
    const { service } = harness([
      endpoint('/orders', { failureRules: [{ type: 'meltdown', percent: 100 }] }),
    ], 0.0);
    expect((await service.handle('p1', 'GET' as any, '/orders')).statusCode).toBe(200);
  });
});

describe('MockService logging', () => {
  it('logs a 404 against no endpoint', async () => {
    const { service, logs } = harness([endpoint('/orders')]);
    await service.handle('p1', 'GET' as any, '/nope');
    expect(logs[0]).toMatchObject({ statusCode: 404, endpointId: null, failureType: null });
  });

  it('records which failure fired', async () => {
    const { service, logs } = harness(
      [endpoint('/orders', { failureRules: [{ type: 'db_down', percent: 100 }] })],
      0.0,
    );
    await service.handle('p1', 'GET' as any, '/orders');
    expect(logs[0]).toMatchObject({ statusCode: 503, failureType: 'db_down' });
  });

  it('passes the caller metadata through to the log row', async () => {
    const { service, logs } = harness([endpoint('/orders')]);
    await service.handle('p1', 'GET' as any, '/orders', {
      ip: '10.0.0.1',
      userAgent: 'curl/8',
    });
    expect(logs[0]).toMatchObject({ ip: '10.0.0.1', userAgent: 'curl/8' });
  });
});
