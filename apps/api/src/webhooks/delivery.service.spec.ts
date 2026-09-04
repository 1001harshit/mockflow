import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import {
  BASE_BACKOFF_MS,
  DeliveryService,
  MAX_BACKOFF_MS,
} from './delivery.service';
import { SigningService } from './signing.service';

const WEBHOOK = {
  id: 'wh_1',
  projectId: 'p1',
  name: 'Payments',
  provider: 'stripe',
  targetUrl: 'https://receiver.test/hook',
  secret: 'whsec_test',
};

/** A Prisma stand-in that records the delivery rows written. */
function prismaStub() {
  const rows: any[] = [];
  return {
    rows,
    webhook: { findFirst: vi.fn(async () => WEBHOOK) },
    webhookDelivery: {
      create: vi.fn(async ({ data }: any) => {
        rows.push(data);
        return data;
      }),
    },
  } as any;
}

function service(prisma: any) {
  const svc = new DeliveryService(prisma, new SigningService());
  svc.sleepImpl = async () => undefined; // no real waiting
  svc.random = () => 1; // full backoff, deterministically
  return svc;
}

const ok = () => new Response('thanks', { status: 200 });
const boom = () => new Response('nope', { status: 500 });

describe('DeliveryService.backoffMs', () => {
  const svc = service(prismaStub());

  it('doubles with each attempt', () => {
    expect(svc.backoffMs(1)).toBe(BASE_BACKOFF_MS);
    expect(svc.backoffMs(2)).toBe(BASE_BACKOFF_MS * 2);
    expect(svc.backoffMs(3)).toBe(BASE_BACKOFF_MS * 4);
  });

  it('never exceeds the ceiling', () => {
    expect(svc.backoffMs(20)).toBe(MAX_BACKOFF_MS);
  });

  it('jitters below the ceiling rather than pinning to it', () => {
    svc.random = () => 0.5;
    expect(svc.backoffMs(3)).toBe((BASE_BACKOFF_MS * 4) / 2);
  });
});

describe('DeliveryService.send', () => {
  it('stops after the first success', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    svc.fetchImpl = vi.fn(async () => ok()) as any;

    const report = await svc.send('p1', 'wh_1', { event: 'payment.captured' });

    expect(report.delivered).toBe(true);
    expect(report.attempts).toHaveLength(1);
    expect(svc.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a 500 and succeeds on a later attempt', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    let calls = 0;
    svc.fetchImpl = vi.fn(async () => (++calls < 3 ? boom() : ok())) as any;

    const report = await svc.send('p1', 'wh_1', { event: 'push' });

    expect(report.delivered).toBe(true);
    expect(report.attempts.map((a) => a.success)).toEqual([false, false, true]);
  });

  it('gives up after maxAttempts and reports failure', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    svc.fetchImpl = vi.fn(async () => boom()) as any;

    const report = await svc.send('p1', 'wh_1', {
      event: 'push',
      maxAttempts: 4,
    });

    expect(report.delivered).toBe(false);
    expect(report.attempts).toHaveLength(4);
    expect(svc.fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('treats a refused connection as a failed attempt, not a crash', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    svc.fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as any;

    const report = await svc.send('p1', 'wh_1', { event: 'push', maxAttempts: 2 });

    expect(report.delivered).toBe(false);
    expect(report.attempts[0]).toMatchObject({
      statusCode: null,
      success: false,
      error: 'ECONNREFUSED',
    });
  });

  it('records one row per attempt, numbered', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    svc.fetchImpl = vi.fn(async () => boom()) as any;

    await svc.send('p1', 'wh_1', { event: 'push', maxAttempts: 3 });

    expect(prisma.rows).toHaveLength(3);
    expect(prisma.rows.map((r: any) => r.attempt)).toEqual([1, 2, 3]);
    expect(prisma.rows.every((r: any) => r.success === false)).toBe(true);
  });

  it('waits between attempts but not after the last one', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    svc.fetchImpl = vi.fn(async () => boom()) as any;
    const sleeps: number[] = [];
    svc.sleepImpl = async (ms) => void sleeps.push(ms);

    await svc.send('p1', 'wh_1', { event: 'push', maxAttempts: 3 });

    expect(sleeps).toEqual([BASE_BACKOFF_MS, BASE_BACKOFF_MS * 2]);
  });

  it('re-signs each attempt so a delayed retry is not stale', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    const signatures: string[] = [];
    let calls = 0;
    svc.fetchImpl = vi.fn(async (_url: any, init: any) => {
      signatures.push(init.headers['stripe-signature']);
      return ++calls < 2 ? boom() : ok();
    }) as any;

    await svc.send('p1', 'wh_1', { event: 'payment.captured' });

    expect(signatures).toHaveLength(2);
    for (const sig of signatures) expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('accepts any 2xx, not just 200', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    // 204 must be constructed with a null body — it cannot carry one.
    svc.fetchImpl = vi.fn(async () => new Response(null, { status: 204 })) as any;

    const report = await svc.send('p1', 'wh_1', { event: 'push' });
    expect(report.delivered).toBe(true);
  });

  it('sends the signed body verbatim', async () => {
    const prisma = prismaStub();
    const svc = service(prisma);
    let sent = '';
    svc.fetchImpl = vi.fn(async (_url: any, init: any) => {
      sent = init.body;
      return ok();
    }) as any;

    await svc.send('p1', 'wh_1', {
      event: 'payment.captured',
      payload: { id: 'evt_9', amount: 250 },
    });

    expect(JSON.parse(sent)).toEqual({ id: 'evt_9', amount: 250 });
  });
});
