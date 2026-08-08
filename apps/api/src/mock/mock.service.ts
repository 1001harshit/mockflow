import { Injectable } from '@nestjs/common';
import { HttpMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseGenerator } from './response-generator.service';

export interface MockResult {
  statusCode: number;
  body: unknown;
}

export interface MockMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class MockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ResponseGenerator,
  ) {}

  /**
   * Matches an incoming request against a project's endpoints, serves it, and
   * records a RequestLog. A miss is a normal 404 result (also logged), not a
   * thrown exception, so every hit is measured uniformly.
   */
  async handle(
    projectId: string,
    method: HttpMethod,
    path: string,
    meta: MockMeta = {},
  ): Promise<MockResult> {
    const start = Date.now();

    const endpoints = await this.prisma.endpoint.findMany({
      where: { projectId, method },
      include: { responses: { where: { isDefault: true }, take: 1 } },
    });
    const match = endpoints.find((e) => this.pathToRegex(e.path).test(path));

    let result: MockResult;
    let endpointId: string | null = null;
    if (!match) {
      result = {
        statusCode: 404,
        body: { message: `No mock for ${method} ${path}` },
      };
    } else {
      endpointId = match.id;
      const response = match.responses[0];
      result = {
        statusCode: response?.statusCode ?? 200,
        body:
          response?.body !== null && response?.body !== undefined
            ? response.body
            : this.generator.generate(match.responseSchema),
      };
    }

    this.log(projectId, endpointId, method, path, result.statusCode, Date.now() - start, meta);
    return result;
  }

  private log(
    projectId: string,
    endpointId: string | null,
    method: string,
    path: string,
    statusCode: number,
    latencyMs: number,
    meta: MockMeta,
  ): void {
    // Fire-and-forget so logging never slows or breaks the response path.
    void this.prisma.requestLog
      .create({
        data: {
          projectId,
          endpointId,
          method,
          path,
          statusCode,
          latencyMs,
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
