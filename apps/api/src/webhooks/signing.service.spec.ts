import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SigningService } from './signing.service';

const signing = new SigningService();
const SECRET = 'shhh-this-is-the-secret';
const EVENT = 'payment.captured';
const PAYLOAD = { id: 'evt_1', amount: 4999 };
const TS = 1_767_225_600;

/** Computed here independently, so the test can't just agree with the code. */
const hmacHex = (payload: string) =>
  createHmac('sha256', SECRET).update(payload).digest('hex');
const hmacB64 = (payload: string) =>
  createHmac('sha256', SECRET).update(payload).digest('base64');

const bodyOf = (payload: unknown) => JSON.stringify(payload);

describe('SigningService provider formats', () => {
  it("matches Stripe's t=<ts>,v1=<hmac of ts.body>", () => {
    const { headers, body } = signing.sign('stripe', SECRET, EVENT, PAYLOAD, TS);
    expect(headers['stripe-signature']).toBe(
      `t=${TS},v1=${hmacHex(`${TS}.${body}`)}`,
    );
  });

  it("matches GitHub's sha256=<hmac of body>", () => {
    const { headers, body } = signing.sign('github', SECRET, 'push', PAYLOAD, TS);
    expect(headers['x-hub-signature-256']).toBe(`sha256=${hmacHex(body)}`);
    expect(headers['x-github-event']).toBe('push');
    expect(headers['x-github-delivery']).toMatch(/^[0-9a-f]{32}$/);
  });

  it("matches Slack's v0=<hmac of v0:ts:body>", () => {
    const { headers, body } = signing.sign('slack', SECRET, EVENT, PAYLOAD, TS);
    expect(headers['x-slack-signature']).toBe(
      `v0=${hmacHex(`v0:${TS}:${body}`)}`,
    );
    expect(headers['x-slack-request-timestamp']).toBe(String(TS));
  });

  it("matches Shopify's base64 HMAC", () => {
    const { headers, body } = signing.sign('shopify', SECRET, 'orders/create', PAYLOAD, TS);
    expect(headers['x-shopify-hmac-sha256']).toBe(hmacB64(body));
    expect(headers['x-shopify-topic']).toBe('orders/create');
  });

  it("matches Razorpay's bare hex HMAC", () => {
    const { headers, body } = signing.sign('razorpay', SECRET, EVENT, PAYLOAD, TS);
    expect(headers['x-razorpay-signature']).toBe(hmacHex(body));
  });

  it('falls back to a MockFlow signature for unsigned providers', () => {
    const { headers, body } = signing.sign('discord', SECRET, EVENT, PAYLOAD, TS);
    expect(headers['x-mockflow-signature']).toBe(`sha256=${hmacHex(body)}`);
  });

  it('serialises the payload once, and signs exactly what it sends', () => {
    const { headers, body } = signing.sign('github', SECRET, 'push', PAYLOAD, TS);
    expect(body).toBe(bodyOf(PAYLOAD));
    expect(headers['x-hub-signature-256']).toBe(`sha256=${hmacHex(body)}`);
  });

  it('omits signatures entirely when no secret is set', () => {
    const { headers } = signing.sign('stripe', null, EVENT, PAYLOAD, TS);
    expect(headers['stripe-signature']).toBeUndefined();
    expect(headers['x-mockflow-event']).toBe(EVENT);
  });
});

describe('SigningService.verify', () => {
  it('accepts a signature it produced', () => {
    const { headers } = signing.sign('stripe', SECRET, EVENT, PAYLOAD, TS);
    expect(signing.verify('stripe', SECRET, EVENT, PAYLOAD, headers, TS)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const { headers } = signing.sign('stripe', SECRET, EVENT, PAYLOAD, TS);
    expect(
      signing.verify('stripe', SECRET, EVENT, { ...PAYLOAD, amount: 1 }, headers, TS),
    ).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const { headers } = signing.sign('github', SECRET, 'push', PAYLOAD, TS);
    expect(
      signing.verify('github', 'other-secret', 'push', PAYLOAD, headers, TS),
    ).toBe(false);
  });

  it('rejects a replayed timestamp for time-bound schemes', () => {
    const { headers } = signing.sign('slack', SECRET, EVENT, PAYLOAD, TS);
    expect(signing.verify('slack', SECRET, EVENT, PAYLOAD, headers, TS + 60)).toBe(
      false,
    );
  });

  it('rejects a missing signature header', () => {
    expect(signing.verify('stripe', SECRET, EVENT, PAYLOAD, {}, TS)).toBe(false);
  });
});

describe('SigningService.generateSecret', () => {
  it('uses the whsec_ prefix for Stripe', () => {
    expect(signing.generateSecret('stripe')).toMatch(/^whsec_[0-9a-f]{48}$/);
  });

  it('is plain hex elsewhere, and different every time', () => {
    const a = signing.generateSecret('github');
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(signing.generateSecret('github'));
  });
});
