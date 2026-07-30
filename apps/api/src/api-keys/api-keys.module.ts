import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyInfoController } from './api-key-info.controller';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard';

@Module({
  controllers: [ApiKeysController, ApiKeyInfoController],
  providers: [ApiKeysService, ApiKeyAuthGuard, WorkspaceRoleGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
