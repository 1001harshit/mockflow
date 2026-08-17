import { Injectable } from '@nestjs/common';
import { Endpoint } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MockResult } from '../mock/mock.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Query = Record<string, string | string[] | undefined>;

/**
 * Backs stateful endpoints with a real per-collection store: POST creates,
 * GET lists/reads, PUT replaces, PATCH merges, DELETE removes. The collection
 * is derived from the endpoint path (e.g. /users/{id} -> "users").
 */
@Injectable()
export class StatefulService {
  constructor(private readonly prisma: PrismaService) {}

  async handle(
    projectId: string,
    endpoint: Endpoint,
    actualPath: string,
    method: string,
    body: unknown,
    query: Query = {},
  ): Promise<MockResult> {
    const collection = this.collectionOf(endpoint.path);
    const itemLevel = /\{[^}]+\}\/?$/.test(endpoint.path);
    const id = itemLevel
      ? decodeURIComponent(actualPath.replace(/\/+$/, '').split('/').pop() ?? '')
      : null;

    switch (method) {
      case 'POST': {
        const created = await this.prisma.stateRecord.create({
          data: { projectId, collection, data: {} },
        });
        const data = { ...this.obj(body), id: created.id };
        await this.prisma.stateRecord.update({
          where: { id: created.id },
          data: { data },
        });
        return { statusCode: 201, body: data };
      }

      case 'GET':
        if (itemLevel) {
          const record = await this.find(projectId, collection, id);
          return record
            ? { statusCode: 200, body: record.data }
            : this.notFound(collection, id);
        }
        return { statusCode: 200, body: await this.list(projectId, collection, query) };

      case 'PUT':
      case 'PATCH': {
        const record = await this.find(projectId, collection, id);
        if (!record) return this.notFound(collection, id);
        const data =
          method === 'PUT'
            ? { ...this.obj(body), id }
            : { ...(record.data as object), ...this.obj(body), id };
        await this.prisma.stateRecord.update({
          where: { id: record.id },
          data: { data },
        });
        return { statusCode: 200, body: data };
      }

      case 'DELETE': {
        const record = await this.find(projectId, collection, id);
        if (!record) return this.notFound(collection, id);
        await this.prisma.stateRecord.delete({ where: { id: record.id } });
        return { statusCode: 200, body: { deleted: true, id } };
      }

      default:
        return { statusCode: 405, body: { message: `${method} not supported` } };
    }
  }

  /** List with search (`q`), sort (`_sort`/`_order`), pagination (`_page`/`_limit`). */
  private async list(projectId: string, collection: string, query: Query) {
    const records = await this.prisma.stateRecord.findMany({
      where: { projectId, collection },
      orderBy: { createdAt: 'asc' },
    });
    let rows = records.map((r) => r.data as Record<string, any>);

    const q = this.str(query.q)?.toLowerCase();
    if (q) {
      rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    }

    const sort = this.str(query._sort);
    if (sort) {
      const dir = this.str(query._order) === 'desc' ? -1 : 1;
      rows.sort((a, b) =>
        a[sort] > b[sort] ? dir : a[sort] < b[sort] ? -dir : 0,
      );
    }

    const limit = Math.min(Number(this.str(query._limit)) || 100, 500);
    const page = Math.max(Number(this.str(query._page)) || 1, 1);
    return rows.slice((page - 1) * limit, (page - 1) * limit + limit);
  }

  private find(projectId: string, collection: string, id: string | null) {
    if (!id) return Promise.resolve(null);
    return this.prisma.stateRecord.findFirst({
      where: { id, projectId, collection },
    });
  }

  private notFound(collection: string, id: string | null): MockResult {
    return { statusCode: 404, body: { message: `${collection}/${id} not found` } };
  }

  private collectionOf(path: string): string {
    const seg = path
      .replace(/^\/+/, '')
      .split('/')
      .find((s) => s && !/^\{.+\}$/.test(s));
    return seg ?? 'root';
  }

  private obj(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private str(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
