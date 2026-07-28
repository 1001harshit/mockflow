import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Membership, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

interface RequestWithMembership {
  user?: { id: string };
  params?: Record<string, string>;
  membership?: Membership;
}

/**
 * Requires the current user to be a member of the workspace named by the `:id`
 * (or `:workspaceId`) route param, and — if `@Roles(...)` is set — to hold one
 * of those roles. Must run after JwtAuthGuard so `request.user` is populated.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<RequestWithMembership>();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException();

    const workspaceId = request.params?.id ?? request.params?.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Missing workspace id');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (required?.length && !required.includes(membership.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    request.membership = membership;
    return true;
  }
}
