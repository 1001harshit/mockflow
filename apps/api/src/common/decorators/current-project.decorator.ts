import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface ProjectRef {
  id: string;
  workspaceId: string;
}

/** Injects the project resolved by ProjectAccessGuard into a handler param. */
export const CurrentProject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectRef => {
    const request = ctx.switchToHttp().getRequest<{ project: ProjectRef }>();
    return request.project;
  },
);
