import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Provider, SigningService } from './signing.service';
import { samplePayload } from './provider-presets';
import { SendWebhookDto } from './dto/send-webhook.dto';

/** First retry waits this long; each further one doubles it. */
export const BASE_BACKOFF_MS = 500;
/** Ceiling on a single wait, so a long retry chain stays bounded. */
export const MAX_BACKOFF_MS = 30_000;
/** Per-attempt request timeout. */
export const ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_CHARS = 2_000;

export interface AttemptResult {
  attempt: number;
  statusCode: number | null;
  success: boolean;
  error?: string;
}

export interface DeliveryReport {
  delivered: boolean;
  attempts: AttemptResult[];
  event: string;
  signatureHeader: string;
}

/**
 * Delivers signed webhooks, retrying failures with exponential backoff and
 * recording every attempt.
 *
 * Attempts run inline rather than on a queue: the caller is usually a developer
 * testing their own receiver, and a report of what actually happened is more
 * useful to them than a job id. A queue is the right answer for large fan-outs,
 * which this isn't yet.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  /** Both overridable in tests — no real sockets, no real waiting. */
  fetchImpl: typeof fetch = (input, init) => fetch(input, init);
  sleepImpl = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));
  random: () => number = Math.random;

  constructor(
    private readonly prisma: PrismaService,
    private readonly signing: SigningService,
  ) {}

  /**
   * Exponential backoff with full jitter. Jitter matters even here: without it,
   * a receiver that just came back up gets every pending retry at once.
   */
  backoffMs(attempt: number): number {
    const ceiling = Math.min(
      BASE_BACKOFF_MS * 2 ** (attempt - 1),
      MAX_BACKOFF_MS,
    );
    return Math.round(this.random() * ceiling);
  }

  async send(
    projectId: string,
    webhookId: string,
    dto: SendWebhookDto,
  ): Promise<DeliveryReport> {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, projectId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const provider = webhook.provider as Provider;
    // No payload given: send something shaped like the provider's real event,
    // so a receiver's parsing code is exercised rather than side-stepped.
    const payload = dto.payload ?? samplePayload(provider, dto.event);
    const maxAttempts = dto.maxAttempts ?? 3;
    const attempts: AttemptResult[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Re-sign per attempt: time-bound schemes (Stripe, Slack) would otherwise
      // fail a receiver's staleness check on a delayed retry.
      const { headers, body } = this.signing.sign(
        provider,
        webhook.secret,
        dto.event,
        payload,
      );

      const result = await this.attempt(webhook.targetUrl, headers, body, attempt);
      attempts.push(result);

      await this.record(webhook.id, dto.event, payload, result);

      if (result.success) break;

      if (attempt < maxAttempts) {
        const wait = this.backoffMs(attempt);
        this.logger.log(
          `${webhook.name} attempt ${attempt} failed (${result.statusCode ?? result.error}); retrying in ${wait}ms`,
        );
        await this.sleepImpl(wait);
      }
    }

    return {
      delivered: attempts.some((a) => a.success),
      attempts,
      event: dto.event,
      signatureHeader: this.signing.signatureHeaderFor(provider),
    };
  }

  private async attempt(
    url: string,
    headers: Record<string, string>,
    body: string,
    attempt: number,
  ): Promise<AttemptResult & { responseBody?: string }> {
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      const text = await res.text().catch(() => '');
      return {
        attempt,
        statusCode: res.status,
        // Anything 2xx counts as accepted, matching what real providers do.
        success: res.status >= 200 && res.status < 300,
        responseBody: text.slice(0, MAX_RESPONSE_CHARS),
      };
    } catch (err) {
      // A refused connection or a timeout is a failed attempt, not a crash —
      // the receiver being down is exactly what retries exist for.
      const error = err instanceof Error ? err.message : String(err);
      return { attempt, statusCode: null, success: false, error };
    }
  }

  private async record(
    webhookId: string,
    event: string,
    payload: unknown,
    result: AttemptResult & { responseBody?: string },
  ): Promise<void> {
    await this.prisma.webhookDelivery
      .create({
        data: {
          webhookId,
          event,
          payload: (payload ?? {}) as never,
          statusCode: result.statusCode,
          attempt: result.attempt,
          success: result.success,
          responseBody: result.responseBody ?? result.error ?? null,
        },
      })
      .catch(() => undefined);
  }
}
