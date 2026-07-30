import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKey } from '@prisma/client';
import { ApiKeysService } from '../api-keys.service';

interface RequestWithApiKey {
  headers: Record<string, string | string[] | undefined>;
  apiKey?: ApiKey;
}

/** Authenticates a request via the `x-api-key` header. */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<RequestWithApiKey>();
    const header = request.headers['x-api-key'];
    const presented = Array.isArray(header) ? header[0] : header;
    if (!presented) throw new UnauthorizedException('Missing API key');

    const key = await this.apiKeys.validate(presented);
    if (!key) throw new UnauthorizedException('Invalid or revoked API key');

    request.apiKey = key;
    return true;
  }
}
