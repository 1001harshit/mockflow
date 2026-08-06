import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseGenerator } from './response-generator.service';

export interface MockResult {
  statusCode: number;
  body: unknown;
}

@Injectable()
export class MockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ResponseGenerator,
  ) {}

  /** Matches an incoming request against a project's endpoints and serves it. */
  async handle(
    projectId: string,
    method: HttpMethod,
    path: string,
  ): Promise<MockResult> {
    const endpoints = await this.prisma.endpoint.findMany({
      where: { projectId, method },
      include: { responses: { where: { isDefault: true }, take: 1 } },
    });

    const match = endpoints.find((e) => this.pathToRegex(e.path).test(path));
    if (!match) {
      throw new NotFoundException(`No mock for ${method} ${path}`);
    }

    const response = match.responses[0];
    const statusCode = response?.statusCode ?? 200;
    const body =
      response?.body !== null && response?.body !== undefined
        ? response.body
        : this.generator.generate(match.responseSchema);

    return { statusCode, body };
  }

  /** Turns a path template like "/users/{id}" into a matcher. */
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
