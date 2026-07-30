import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/** Manage a workspace's API keys. Restricted to OWNER/ADMIN members. */
@Controller('api/workspaces/:id/keys')
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Roles(Role.OWNER, Role.ADMIN)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('id') workspaceId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(workspaceId, dto.name);
  }

  @Get()
  list(@Param('id') workspaceId: string) {
    return this.apiKeys.list(workspaceId);
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.OK)
  revoke(@Param('id') workspaceId: string, @Param('keyId') keyId: string) {
    return this.apiKeys.revoke(workspaceId, keyId);
  }
}
