import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenApiParser } from '../parser/openapi.parser';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: OpenApiParser,
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

  listEndpoints(projectId: string) {
    return this.prisma.endpoint.findMany({
      where: { projectId },
      orderBy: [{ path: 'asc' }, { method: 'asc' }],
      select: {
        id: true,
        method: true,
        path: true,
        description: true,
        responses: {
          where: { isDefault: true },
          select: { statusCode: true },
        },
      },
    });
  }
}
