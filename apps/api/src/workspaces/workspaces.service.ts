import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueSlug } from '../common/slug';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Workspaces the user belongs to, each annotated with their role. */
  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  /** Creates a workspace and makes the creator its OWNER. */
  async create(userId: string, name: string) {
    const slug = await uniqueSlug(
      name,
      async (s) => (await this.prisma.workspace.count({ where: { slug: s } })) > 0,
    );
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({ data: { name, slug } });
      await tx.membership.create({
        data: { userId, workspaceId: workspace.id, role: Role.OWNER },
      });
      return workspace;
    });
  }

  listProjects(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProject(workspaceId: string, name: string, description?: string) {
    const slug = await uniqueSlug(
      name,
      async (s) =>
        (await this.prisma.project.count({ where: { workspaceId, slug: s } })) >
        0,
    );
    return this.prisma.project.create({
      data: { workspaceId, name, slug, description },
    });
  }
}
