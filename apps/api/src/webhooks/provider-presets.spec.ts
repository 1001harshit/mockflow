import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  PresetContext,
  eventsFor,
  providerCatalog,
  samplePayload,
} from './provider-presets';
import { PROVIDERS, Provider } from './signing.service';

/** Fixed ids and clock, so shapes can be asserted exactly. */
const ctx: PresetContext = {
  id: (prefix) => (prefix ? `${prefix}_abc123` : 'f'.repeat(40)),
  now: 1_767_225_600,
};

describe('provider catalog', () => {
  it('covers every provider the signer knows about', () => {
    const covered = providerCatalog().map((p) => p.provider);
    expect(covered.sort()).toEqual([...PROVIDERS].sort());
  });

  it('lists at least one event per provider', () => {
    for (const provider of PROVIDERS) {
      expect(eventsFor(provider).length, provider).toBeGreaterThan(0);
    }
  });

  it('produces JSON-serialisable payloads for every provider and event', () => {
    for (const provider of PROVIDERS) {
      for (const event of eventsFor(provider)) {
        const payload = samplePayload(provider, event, ctx);
        expect(() => JSON.stringify(payload), `${provider}/${event}`).not.toThrow();
        expect(payload, `${provider}/${event}`).toBeTypeOf('object');
      }
    }
  });
});

describe('payload shapes match their provider', () => {
  it("wraps Stripe events in the object/data envelope", () => {
    const payload = samplePayload('stripe', 'payment_intent.succeeded', ctx) as any;
    expect(payload.object).toBe('event');
    expect(payload.type).toBe('payment_intent.succeeded');
    expect(payload.data.object.object).toBe('payment_intent');
    expect(payload.id).toMatch(/^evt_/);
    expect(payload.data.object.status).toBe('succeeded');
  });

  it('reflects a failed Stripe payment in its status', () => {
    const payload = samplePayload(
      'stripe',
      'payment_intent.payment_failed',
      ctx,
    ) as any;
    expect(payload.data.object.status).toBe('requires_payment_method');
    expect(payload.data.object.amount_received).toBe(0);
  });

  it('sends a ref and commits for a GitHub push', () => {
    const payload = samplePayload('github', 'push', ctx) as any;
    expect(payload.ref).toBe('refs/heads/main');
    expect(payload.repository.full_name).toBe('acme/widgets');
    expect(payload.commits).toHaveLength(1);
  });

  it('sends a pull_request object for a GitHub pull_request', () => {
    const payload = samplePayload('github', 'pull_request', ctx) as any;
    expect(payload.action).toBe('opened');
    expect(payload.pull_request.number).toBe(payload.number);
    expect(payload.ref).toBeUndefined();
  });

  it('wraps Slack events in an event_callback', () => {
    const payload = samplePayload('slack', 'app_mention', ctx) as any;
    expect(payload.type).toBe('event_callback');
    expect(payload.event.type).toBe('app_mention');
    expect(payload.team_id).toMatch(/^T/);
  });

  it('maps slack message.channels onto the message event type', () => {
    const payload = samplePayload('slack', 'message.channels', ctx) as any;
    expect(payload.event.type).toBe('message');
  });

  it('sends a flat order for Shopify, with line items', () => {
    const payload = samplePayload('shopify', 'orders/create', ctx) as any;
    expect(payload.financial_status).toBe('paid');
    expect(payload.line_items[0].quantity).toBe(2);
    expect(payload.currency).toBe('INR');
  });

  it('nests Razorpay payments under payload.payment.entity', () => {
    const payload = samplePayload('razorpay', 'payment.captured', ctx) as any;
    expect(payload.entity).toBe('event');
    expect(payload.payload.payment.entity.id).toMatch(/^pay_/);
    expect(payload.payload.payment.entity.captured).toBe(true);
  });

  it('marks a failed Razorpay payment as uncaptured', () => {
    const payload = samplePayload('razorpay', 'payment.failed', ctx) as any;
    expect(payload.payload.payment.entity.status).toBe('failed');
    expect(payload.payload.payment.entity.captured).toBe(false);
  });

  it('falls back to the custom envelope for an unknown event name', () => {
    const payload = samplePayload('custom', 'anything.at.all', ctx) as any;
    expect(payload.event).toBe('anything.at.all');
    expect(payload.id).toMatch(/^evt_/);
  });
});
