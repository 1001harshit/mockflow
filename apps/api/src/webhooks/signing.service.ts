import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const PROVIDERS = [
  'stripe',
  'github',
  'slack',
  'shopify',
  'razorpay',
  'discord',
  'custom',
] as const;

export type Provider = (typeof PROVIDERS)[number];

export interface SignedRequest {
  headers: Record<string, string>;
  body: string;
}

/**
 * Signs outgoing webhooks the way the real providers do.
 *
 * The schemes here deliberately match production formats — Stripe's
 * `t=…,v1=…`, GitHub's `sha256=…`, Shopify's base64 — because the point of
 * simulating a provider is to exercise the verification code you'll ship
 * against the real one. A near-miss format would let broken code pass.
 */
@Injectable()
export class SigningService {
  /** A secret in the shape each provider issues, for newly created webhooks. */
  generateSecret(provider: Provider): string {
    const raw = randomBytes(24).toString('hex');
    return provider === 'stripe' ? `whsec_${raw}` : raw;
  }

  /**
   * Builds the headers a provider would send alongside `payload`.
   * `timestamp` is seconds since the epoch, injectable so tests can pin it.
   */
  sign(
    provider: Provider,
    secret: string | null,
    event: string,
    payload: unknown,
    timestamp: number = Math.floor(Date.now() / 1000),
  ): SignedRequest {
    const body = JSON.stringify(payload ?? {});
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': `MockFlow/1.0 (+${provider})`,
    };

    if (!secret) {
      headers['x-mockflow-event'] = event;
      return { headers, body };
    }

    switch (provider) {
      case 'stripe':
        // t=<ts>,v1=<hmac of "<ts>.<body>">
        headers['stripe-signature'] =
          `t=${timestamp},v1=${this.hmacHex(secret, `${timestamp}.${body}`)}`;
        headers['x-mockflow-event'] = event;
        break;

      case 'github':
        headers['x-hub-signature-256'] = `sha256=${this.hmacHex(secret, body)}`;
        headers['x-github-event'] = event;
        headers['x-github-delivery'] = randomBytes(16).toString('hex');
        break;

      case 'slack':
        // v0=<hmac of "v0:<ts>:<body>">
        headers['x-slack-signature'] =
          `v0=${this.hmacHex(secret, `v0:${timestamp}:${body}`)}`;
        headers['x-slack-request-timestamp'] = String(timestamp);
        break;

      case 'shopify':
        headers['x-shopify-hmac-sha256'] = this.hmacBase64(secret, body);
        headers['x-shopify-topic'] = event;
        break;

      case 'razorpay':
        headers['x-razorpay-signature'] = this.hmacHex(secret, body);
        headers['x-razorpay-event-id'] = randomBytes(12).toString('hex');
        break;

      // Discord doesn't sign outgoing webhooks, so anything we invented here
      // would be a fiction that teaches the wrong thing.
      case 'discord':
      case 'custom':
      default:
        headers['x-mockflow-signature'] = `sha256=${this.hmacHex(secret, body)}`;
        headers['x-mockflow-event'] = event;
        headers['x-mockflow-timestamp'] = String(timestamp);
        break;
    }

    return { headers, body };
  }

  /**
   * Verifies a signature this service produced. Mostly useful for tests and for
   * anyone checking their own verification logic against ours.
   */
  verify(
    provider: Provider,
    secret: string,
    event: string,
    payload: unknown,
    headers: Record<string, string>,
    timestamp: number,
  ): boolean {
    const expected = this.sign(provider, secret, event, payload, timestamp);
    const header = this.signatureHeaderFor(provider);
    const got = headers[header];
    const want = expected.headers[header];
    if (!got || !want || got.length !== want.length) return false;
    return timingSafeEqual(Buffer.from(got), Buffer.from(want));
  }

  /** Which header carries the signature for a provider. */
  signatureHeaderFor(provider: Provider): string {
    switch (provider) {
      case 'stripe':
        return 'stripe-signature';
      case 'github':
        return 'x-hub-signature-256';
      case 'slack':
        return 'x-slack-signature';
      case 'shopify':
        return 'x-shopify-hmac-sha256';
      case 'razorpay':
        return 'x-razorpay-signature';
      default:
        return 'x-mockflow-signature';
    }
  }

  private hmacHex(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private hmacBase64(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64');
  }
}
