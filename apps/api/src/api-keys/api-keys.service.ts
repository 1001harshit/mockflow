import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mints a new API key. The plaintext is returned exactly once and never
   * stored — only its SHA-256 hash and a short display prefix are persisted.
   */
  async create(workspaceId: string, name: string) {
    const key = `mf_${randomBytes(24).toString('base64url')}`;
    const prefix = key.slice(0, 11);
    const record = await this.prisma.apiKey.create({
      data: { name, workspaceId, prefix, hashedKey: this.hash(key) },
    });
    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      createdAt: record.createdAt,
      key,
    };
  }

  list(workspaceId: string) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(workspaceId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, workspaceId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (!key.revokedAt) {
      await this.prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    }
    return { id, revoked: true };
  }

  /** Resolves a presented key to its record, or null if invalid/revoked. */
  async validate(presented: string): Promise<ApiKey | null> {
    const key = await this.prisma.apiKey.findUnique({
      where: { hashedKey: this.hash(presented) },
    });
    if (!key || key.revokedAt) return null;
    await this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return key;
  }

  private hash(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
