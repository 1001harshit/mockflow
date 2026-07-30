import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiKey } from '@prisma/client';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';

/** Lets a caller confirm which workspace an API key belongs to. */
@Controller('api')
export class ApiKeyInfoController {
  @Get('key-info')
  @UseGuards(ApiKeyAuthGuard)
  info(@Req() request: { apiKey: ApiKey }) {
    return {
      workspaceId: request.apiKey.workspaceId,
      name: request.apiKey.name,
      prefix: request.apiKey.prefix,
    };
  }
}
