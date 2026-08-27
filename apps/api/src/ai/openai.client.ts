import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export interface CompletionOptions {
  /** Steers the model; defaults to a terse "return JSON only" instruction. */
  system?: string;
  /** Use the cheaper bulk model — for high-volume, low-stakes generation. */
  bulk?: boolean;
  maxTokens?: number;
  /** Low by default: mock data should be plausible, not imaginative. */
  temperature?: number;
}

const DEFAULT_SYSTEM =
  'You generate data for API mocks. Reply with a single JSON object and ' +
  'nothing else — no prose, no code fences.';

/**
 * Minimal OpenAI chat client. Deliberately a plain `fetch` call rather than the
 * SDK: one endpoint, one response shape, and nothing to keep in step.
 *
 * When no API key is configured the client reports itself unconfigured so
 * callers can fall back to local generation instead of failing.
 */
@Injectable()
export class OpenAiClient {
  private readonly logger = new Logger(OpenAiClient.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly bulkModel: string;

  constructor(config: ConfigService) {
    this.apiKey = (config.get<string>('OPENAI_API_KEY') ?? '').trim();
    this.model = config.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.bulkModel = config.get<string>('OPENAI_MODEL_BULK') || 'gpt-4o-mini';
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  /** Runs a prompt in JSON mode and parses the reply. */
  async json<T = unknown>(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<T> {
    if (!this.configured) {
      throw new ServiceUnavailableException('OPENAI_API_KEY is not configured');
    }

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options.bulk ? this.bulkModel : this.model,
        response_format: { type: 'json_object' },
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 2_000,
        messages: [
          { role: 'system', content: options.system ?? DEFAULT_SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.warn(`OpenAI responded ${res.status}: ${detail.slice(0, 200)}`);
      throw new ServiceUnavailableException(
        `OpenAI request failed with ${res.status}`,
      );
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException('OpenAI returned an empty choice');
    }

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new ServiceUnavailableException('OpenAI did not return valid JSON');
    }
  }
}
