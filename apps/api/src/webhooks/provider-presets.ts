import { randomBytes } from 'node:crypto';
import { Provider } from './signing.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Sample payloads shaped like each provider's real events.
 *
 * These exist so `send` without a payload produces something a receiver will
 * actually recognise — the envelope keys, the id prefixes, the nesting. Getting
 * the shape roughly right is what makes the simulation worth using; a generic
 * `{event, data}` blob would test nothing about the parsing code you ship.
 */

export interface PresetContext {
  /** Prefixed id in the provider's own style, e.g. `pi_3Nk2…`. */
  id: (prefix: string) => string;
  /** Seconds since the epoch. */
  now: number;
}

type Builder = (event: string, ctx: PresetContext) => unknown;

interface Preset {
  events: string[];
  build: Builder;
}

const PRESETS: Record<Provider, Preset> = {
  stripe: {
    events: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.refunded',
      'invoice.paid',
      'customer.subscription.deleted',
    ],
    build: (event, { id, now }) => ({
      id: id('evt'),
      object: 'event',
      api_version: '2024-06-20',
      created: now,
      livemode: false,
      type: event,
      data: {
        object: {
          id: id('pi'),
          object: 'payment_intent',
          amount: 499900,
          amount_received: event.endsWith('succeeded') ? 499900 : 0,
          currency: 'inr',
          status: event.endsWith('succeeded') ? 'succeeded' : 'requires_payment_method',
          customer: id('cus'),
          payment_method_types: ['card', 'upi'],
        },
      },
      request: { id: id('req'), idempotency_key: null },
    }),
  },

  github: {
    events: ['push', 'pull_request', 'issues', 'release'],
    build: (event, { id, now }) => {
      const repository = {
        id: 823_115_441,
        name: 'widgets',
        full_name: 'acme/widgets',
        private: false,
        default_branch: 'main',
      };
      const sender = { login: 'octocat', id: 583_231, type: 'User' };

      if (event === 'pull_request') {
        return {
          action: 'opened',
          number: 42,
          pull_request: {
            id: 1_842_009,
            number: 42,
            state: 'open',
            title: 'Add retry backoff to the delivery worker',
            user: sender,
            head: { ref: 'feat/backoff', sha: id('').slice(0, 40) },
            base: { ref: 'main', sha: id('').slice(0, 40) },
            created_at: new Date(now * 1000).toISOString(),
          },
          repository,
          sender,
        };
      }

      return {
        ref: 'refs/heads/main',
        before: id('').slice(0, 40),
        after: id('').slice(0, 40),
        repository,
        pusher: { name: 'octocat', email: 'octocat@example.com' },
        sender,
        commits: [
          {
            id: id('').slice(0, 40),
            message: 'Fix the off-by-one in the pagination cursor',
            timestamp: new Date(now * 1000).toISOString(),
            author: { name: 'Octo Cat', email: 'octocat@example.com' },
          },
        ],
      };
    },
  },

  slack: {
    events: ['app_mention', 'message.channels', 'reaction_added'],
    build: (event, { id, now }) => ({
      token: id('').slice(0, 24),
      team_id: `T${id('').slice(0, 10).toUpperCase()}`,
      api_app_id: `A${id('').slice(0, 10).toUpperCase()}`,
      type: 'event_callback',
      event_id: `Ev${id('').slice(0, 10).toUpperCase()}`,
      event_time: now,
      event: {
        type: event === 'message.channels' ? 'message' : event,
        user: `U${id('').slice(0, 10).toUpperCase()}`,
        text: 'deploy the staging build when you get a minute',
        ts: `${now}.000200`,
        channel: `C${id('').slice(0, 10).toUpperCase()}`,
        channel_type: 'channel',
      },
    }),
  },

  shopify: {
    events: ['orders/create', 'orders/paid', 'products/update', 'refunds/create'],
    build: (_event, { id, now }) => ({
      id: 5_284_913_772_105,
      email: 'priya.iyer@example.com',
      created_at: new Date(now * 1000).toISOString(),
      currency: 'INR',
      total_price: '2598.00',
      financial_status: 'paid',
      order_number: 1042,
      line_items: [
        {
          id: 13_992_118_442,
          title: 'Prestige Triply Saucepan',
          quantity: 2,
          price: '1299.00',
          sku: `HOM-${id('').slice(0, 4).toUpperCase()}`,
        },
      ],
      customer: {
        id: 6_120_449_113,
        first_name: 'Priya',
        last_name: 'Iyer',
        email: 'priya.iyer@example.com',
      },
    }),
  },

  razorpay: {
    events: [
      'payment.captured',
      'payment.failed',
      'order.paid',
      'refund.processed',
    ],
    build: (event, { id, now }) => ({
      entity: 'event',
      account_id: `acc_${id('').slice(0, 14)}`,
      event,
      contains: ['payment'],
      created_at: now,
      payload: {
        payment: {
          entity: {
            id: `pay_${id('').slice(0, 14)}`,
            entity: 'payment',
            amount: 499900,
            currency: 'INR',
            status: event === 'payment.failed' ? 'failed' : 'captured',
            order_id: `order_${id('').slice(0, 14)}`,
            method: 'upi',
            captured: event !== 'payment.failed',
            email: 'rahul.menon@example.com',
            contact: '+919876543210',
          },
        },
      },
    }),
  },

  discord: {
    events: ['INTERACTION_CREATE', 'MESSAGE_CREATE'],
    build: (event, { id, now }) => ({
      id: id('').slice(0, 18).replace(/\D/g, '') || '1180000000000000000',
      type: event === 'INTERACTION_CREATE' ? 2 : 0,
      application_id: '1179999999999999999',
      token: id('').slice(0, 24),
      channel_id: '1180111111111111111',
      timestamp: new Date(now * 1000).toISOString(),
      data: { name: 'deploy', type: 1 },
      member: {
        user: { id: '583231', username: 'octocat', global_name: 'Octo Cat' },
      },
    }),
  },

  custom: {
    events: ['created', 'updated', 'deleted'],
    build: (event, { id, now }) => ({
      id: id('evt'),
      event,
      timestamp: new Date(now * 1000).toISOString(),
      data: { resource: 'order', id: id('ord'), status: 'ok' },
    }),
  },
};

function defaultContext(): PresetContext {
  return {
    id: (prefix) => {
      const raw = randomBytes(16).toString('hex');
      return prefix ? `${prefix}_${raw.slice(0, 20)}` : raw;
    },
    now: Math.floor(Date.now() / 1000),
  };
}

/** The events MockFlow can simulate for a provider. */
export function eventsFor(provider: Provider): string[] {
  return PRESETS[provider]?.events ?? PRESETS.custom.events;
}

/** A payload shaped like the provider's real event of that name. */
export function samplePayload(
  provider: Provider,
  event: string,
  ctx: PresetContext = defaultContext(),
): unknown {
  const preset = PRESETS[provider] ?? PRESETS.custom;
  return preset.build(event, ctx);
}

/** Everything the dashboard needs to offer a provider picker. */
export function providerCatalog(): Array<{
  provider: Provider;
  events: string[];
}> {
  return (Object.keys(PRESETS) as Provider[]).map((provider) => ({
    provider,
    events: PRESETS[provider].events,
  }));
}
