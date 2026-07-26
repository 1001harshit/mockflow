import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SafeUser } from '../../auth/auth.service';

/** Injects the authenticated user (set by JwtStrategy) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SafeUser => {
    const request = ctx.switchToHttp().getRequest<{ user: SafeUser }>();
    return request.user;
  },
);
