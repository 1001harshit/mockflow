import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { StatefulService } from './stateful.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** In-memory stand-in for the StateRecord table. */
function store(seed: Array<{ id: string; data: any }> = []) {
  const rows = seed.map((r, i) => ({
    ...r,
    projectId: 'p1',
    collection: 'orders',
    createdAt: new Date(2026, 0, i + 1),
  }));
  return {
    rows,
    stateRecord: {
      findMany: vi.fn(async () => rows),
      findFirst: vi.fn(async ({ where }: any) =>
        rows.find((r) => r.id === where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, id: `rec_${rows.length + 1}`, createdAt: new Date() };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const i = rows.findIndex((r) => r.id === where.id);
        return rows.splice(i, 1)[0];
      }),
    },
  } as any;
}

const endpoint = (path: string) => ({ path }) as any;
const service = (prisma: any) => new StatefulService(prisma);

describe('StatefulService CRUD', () => {
  it('creates a record and gives it an id', async () => {
    const prisma = store();
    const result = await service(prisma).handle(
      'p1', endpoint('/orders'), '/orders', 'POST', { item: 'coffee' },
    );
    expect(result.statusCode).toBe(201);
    expect(result.body).toMatchObject({ item: 'coffee' });
    expect((result.body as any).id).toBeTruthy();
  });

  it('reads one record back by id', async () => {
    const prisma = store([{ id: 'r1', data: { id: 'r1', item: 'tea' } }]);
    const result = await service(prisma).handle(
      'p1', endpoint('/orders/{id}'), '/orders/r1', 'GET', undefined,
    );
    expect(result.body).toEqual({ id: 'r1', item: 'tea' });
  });

  it('404s a missing record, naming it', async () => {
    const prisma = store();
    const result = await service(prisma).handle(
      'p1', endpoint('/orders/{id}'), '/orders/nope', 'GET', undefined,
    );
    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ message: 'orders/nope not found' });
  });

  it('PUT replaces the record, PATCH merges into it', async () => {
    const prisma = store([{ id: 'r1', data: { id: 'r1', item: 'tea', size: 'L' } }]);
    const svc = service(prisma);

    const patched = await svc.handle(
      'p1', endpoint('/orders/{id}'), '/orders/r1', 'PATCH', { item: 'coffee' },
    );
    expect(patched.body).toEqual({ id: 'r1', item: 'coffee', size: 'L' });

    const replaced = await svc.handle(
      'p1', endpoint('/orders/{id}'), '/orders/r1', 'PUT', { item: 'juice' },
    );
    expect(replaced.body).toEqual({ id: 'r1', item: 'juice' });
  });

  it('deletes a record', async () => {
    const prisma = store([{ id: 'r1', data: { id: 'r1' } }]);
    const result = await service(prisma).handle(
      'p1', endpoint('/orders/{id}'), '/orders/r1', 'DELETE', undefined,
    );
    expect(result.body).toEqual({ deleted: true, id: 'r1' });
    expect(prisma.rows).toHaveLength(0);
  });

  it('rejects a method it does not implement', async () => {
    const result = await service(store()).handle(
      'p1', endpoint('/orders'), '/orders', 'TRACE', undefined,
    );
    expect(result.statusCode).toBe(405);
  });
});

describe('StatefulService list querying', () => {
  const seeded = () =>
    store([
      { id: 'r1', data: { id: 'r1', item: 'coffee', price: 30 } },
      { id: 'r2', data: { id: 'r2', item: 'tea', price: 20 } },
      { id: 'r3', data: { id: 'r3', item: 'juice', price: 50 } },
    ]);

  const list = (query: any) =>
    service(seeded()).handle('p1', endpoint('/orders'), '/orders', 'GET', undefined, query);

  it('returns every record with no query', async () => {
    expect((await list({})).body).toHaveLength(3);
  });

  it('filters on a free-text q across the whole record', async () => {
    const body = (await list({ q: 'tea' })).body as any[];
    expect(body).toHaveLength(1);
    expect(body[0].item).toBe('tea');
  });

  it('matches q case-insensitively', async () => {
    expect((await list({ q: 'COFFEE' })).body).toHaveLength(1);
  });

  it('sorts ascending by default', async () => {
    const body = (await list({ _sort: 'price' })).body as any[];
    expect(body.map((r) => r.price)).toEqual([20, 30, 50]);
  });

  it('sorts descending on request', async () => {
    const body = (await list({ _sort: 'price', _order: 'desc' })).body as any[];
    expect(body.map((r) => r.price)).toEqual([50, 30, 20]);
  });

  it('paginates with _page and _limit', async () => {
    const body = (await list({ _sort: 'price', _limit: '2', _page: '2' })).body as any[];
    expect(body.map((r) => r.price)).toEqual([50]);
  });

  it('returns an empty page past the end rather than erroring', async () => {
    expect((await list({ _limit: '2', _page: '9' })).body).toEqual([]);
  });

  it('takes the first value when a query parameter repeats', async () => {
    expect((await list({ q: ['tea', 'coffee'] })).body).toHaveLength(1);
  });
});

describe('StatefulService collection naming', () => {
  it('derives the collection from the first literal path segment', async () => {
    const prisma = store();
    await service(prisma).handle(
      'p1', endpoint('/orders/{id}/items'), '/orders/1/items', 'POST', {},
    );
    expect(prisma.stateRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ collection: 'orders' }) }),
    );
  });

  it('ignores a non-object body rather than storing junk', async () => {
    const prisma = store();
    const result = await service(prisma).handle(
      'p1', endpoint('/orders'), '/orders', 'POST', 'just a string',
    );
    expect(Object.keys(result.body as object)).toEqual(['id']);
  });
});
