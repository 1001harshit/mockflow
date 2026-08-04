import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface RequestWithProject {
  user?: { id: string };
  params?: Record<string, string>;
  project?: { id: string; workspaceId: string };
}

/**
 * Requires the current user to be a member of the workspace that owns the
 * project named by the `:id` route param. Runs after JwtAuthGuard.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<RequestWithProject>();
    const userId = request.user?.id;
    const projectId = request.params?.id;
    if (!userId || !projectId) throw new ForbiddenException();

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (!membership) throw new ForbiddenException('No access to this project');

    request.project = project;
    return true;
  }
}
