import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenApiParser } from '../parser/openapi.parser';
import { FailureService } from '../failure/failure.service';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: OpenApiParser,
    private readonly failure: FailureService,
  ) {}

  /**
   * Parses an uploaded spec and (re)creates the project's endpoints and their
   * default responses. Idempotent per method+path.
   */
  async import(projectId: string, spec: any) {
    const parsed = this.parser.parse(spec);

    for (const ep of parsed.endpoints) {
      const endpoint = await this.prisma.endpoint.upsert({
        where: {
          projectId_method_path: {
            projectId,
            method: ep.method,
            path: ep.path,
          },
        },
        update: {
          description: ep.description ?? null,
          responseSchema: (ep.response.schema ?? undefined) as any,
        },
        create: {
          projectId,
          method: ep.method,
          path: ep.path,
          description: ep.description ?? null,
          responseSchema: (ep.response.schema ?? undefined) as any,
        },
      });

      await this.prisma.response.deleteMany({
        where: { endpointId: endpoint.id },
      });
      await this.prisma.response.create({
        data: {
          endpointId: endpoint.id,
          name: 'default',
          statusCode: ep.response.statusCode,
          body: (ep.response.body ?? undefined) as any,
          isDefault: true,
        },
      });
    }

    return { title: parsed.title ?? null, imported: parsed.endpoints.length };
  }

  /** Project detail for the dashboard header — name, slug and a few counts. */
  async detail(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        workspace: { select: { id: true, name: true } },
        _count: { select: { endpoints: true, requestLogs: true, webhooks: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  listEndpoints(projectId: string) {
    return this.prisma.endpoint.findMany({
      where: { projectId },
      orderBy: [{ path: 'asc' }, { method: 'asc' }],
      select: {
        id: true,
        method: true,
        path: true,
        description: true,
        stateful: true,
        failureRules: true,
        responses: {
          where: { isDefault: true },
          select: { statusCode: true, body: true },
        },
      },
    });
  }

  /** Edit an endpoint's default response and flags. */
  async updateEndpoint(
    projectId: string,
    endpointId: string,
    dto: UpdateEndpointDto,
  ) {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id: endpointId, projectId },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    if (
      dto.description !== undefined ||
      dto.stateful !== undefined ||
      dto.failureRules !== undefined
    ) {
      await this.prisma.endpoint.update({
        where: { id: endpointId },
        data: {
          description: dto.description,
          stateful: dto.stateful,
          // normalize() fills defaults and rejects rules totalling over 100%.
          failureRules:
            dto.failureRules === undefined
              ? undefined
              : (this.failure.normalize(dto.failureRules) as any),
        },
      });
    }

    if (dto.statusCode !== undefined || dto.body !== undefined) {
      const current = await this.prisma.response.findFirst({
        where: { endpointId, isDefault: true },
      });
      if (current) {
        await this.prisma.response.update({
          where: { id: current.id },
          data: {
            statusCode: dto.statusCode ?? current.statusCode,
            body: (dto.body ?? current.body ?? undefined) as any,
          },
        });
      } else {
        await this.prisma.response.create({
          data: {
            endpointId,
            name: 'default',
            isDefault: true,
            statusCode: dto.statusCode ?? 200,
            body: (dto.body ?? undefined) as any,
          },
        });
      }
    }

    return { updated: true };
  }

  listLogs(projectId: string, limit = 50) {
    return this.prisma.requestLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        method: true,
        path: true,
        statusCode: true,
        latencyMs: true,
        failureType: true,
        createdAt: true,
      },
    });
  }

  /** Aggregate latency/error metrics over the most recent requests. */
  async stats(projectId: string) {
    const [total, recent] = await Promise.all([
      this.prisma.requestLog.count({ where: { projectId } }),
      this.prisma.requestLog.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: { statusCode: true, latencyMs: true, failureType: true },
      }),
    ]);

    const latencies = recent.map((r) => r.latencyMs).sort((a, b) => a - b);
    const errors = recent.filter((r) => r.statusCode >= 400).length;

    // How much of the recent traffic was sabotaged on purpose (Phase 5), so a
    // spike in the error rate can be told apart from a genuine regression.
    const injected = recent.filter((r) => r.failureType);
    const byType: Record<string, number> = {};
    for (const row of injected) {
      byType[row.failureType as string] =
        (byType[row.failureType as string] ?? 0) + 1;
    }
    const percentile = (p: number) =>
      latencies.length
        ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]
        : 0;

    return {
      totalRequests: total,
      sampleSize: recent.length,
      errorRate: recent.length ? Number((errors / recent.length).toFixed(3)) : 0,
      injectedFailures: {
        count: injected.length,
        rate: recent.length
          ? Number((injected.length / recent.length).toFixed(3))
          : 0,
        byType,
      },
      latencyMs: {
        avg: latencies.length
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
      },
    };
  }
}
