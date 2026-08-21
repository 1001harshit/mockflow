import { Injectable } from '@nestjs/common';
import { HttpMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatefulService } from '../stateful/stateful.service';
import { FailureService } from '../failure/failure.service';
import { ABORTED_STATUS, FailureRule } from '../failure/failure.types';
import { ResponseGenerator } from './response-generator.service';
import { MockMeta, MockResult } from './mock.types';

type Query = Record<string, string | string[] | undefined>;

@Injectable()
export class MockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ResponseGenerator,
    private readonly stateful: StatefulService,
    private readonly failure: FailureService,
  ) {}

  /**
   * Matches an incoming request against a project's endpoints and serves it —
   * from the stateful store if the endpoint is stateful, otherwise from its
   * example/schema. Failure rules (Phase 5) can delay, replace or abort the
   * response. Every hit (incl. 404s and injected failures) is logged.
   */
  async handle(
    projectId: string,
    method: HttpMethod,
    path: string,
    meta: MockMeta = {},
    body?: unknown,
    query: Query = {},
  ): Promise<MockResult> {
    const start = Date.now();

    const endpoints = await this.prisma.endpoint.findMany({
      where: { projectId, method },
      include: { responses: { where: { isDefault: true }, take: 1 } },
    });
    const match = endpoints.find((e) => this.pathToRegex(e.path).test(path));

    if (!match) {
      const missing: MockResult = {
        statusCode: 404,
        body: { message: `No mock for ${method} ${path}` },
      };
      this.log(projectId, null, method, path, missing, Date.now() - start, meta);
      return missing;
    }

    // Roll for a failure before doing any real work — a request that is going
    // to fail shouldn't pay the cost of generating a body it will never use.
    const rule = this.failure.pick(this.failure.parse(match.failureRules));
    if (rule && rule.type !== 'slow') {
      const result = await this.injected(rule);
      this.log(projectId, match.id, method, path, result, Date.now() - start, meta);
      return result;
    }

    // `slow` still serves the real response — it just takes its time first.
    if (rule) await this.failure.sleep(this.failure.delayFor(rule));

    const result: MockResult = match.stateful
      ? await this.stateful.handle(projectId, match, path, method, body, query)
      : this.fromExample(match);
    if (rule) result.failure = rule.type;

    this.log(projectId, match.id, method, path, result, Date.now() - start, meta);
    return result;
  }

  /** Builds the response for a failure rule, stalling first where the rule says so. */
  private async injected(rule: FailureRule): Promise<MockResult> {
    await this.failure.sleep(this.failure.delayFor(rule));

    if (rule.type === 'network') {
      return { statusCode: ABORTED_STATUS, body: null, failure: rule.type, abort: true };
    }
    return {
      statusCode: this.failure.statusFor(rule),
      body: this.failure.bodyFor(rule),
      failure: rule.type,
    };
  }

  private fromExample(
    match: { responseSchema: unknown; responses: Array<{ statusCode: number; body: unknown }> },
  ): MockResult {
    const response = match.responses[0];
    return {
      statusCode: response?.statusCode ?? 200,
      body:
        response?.body !== null && response?.body !== undefined
          ? response.body
          : this.generator.generate(match.responseSchema),
    };
  }

  private log(
    projectId: string,
    endpointId: string | null,
    method: string,
    path: string,
    result: MockResult,
    latencyMs: number,
    meta: MockMeta,
  ): void {
    void this.prisma.requestLog
      .create({
        data: {
          projectId,
          endpointId,
          method,
          path,
          statusCode: result.statusCode,
          latencyMs,
          failureType: result.failure ?? null,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      })
      .catch(() => undefined);
  }

  private pathToRegex(template: string): RegExp {
    const parts = template
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .map((seg) =>
        /^\{.+\}$/.test(seg)
          ? '[^/]+'
          : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      );
    return new RegExp(`^/${parts.join('/')}/?$`);
  }
}
