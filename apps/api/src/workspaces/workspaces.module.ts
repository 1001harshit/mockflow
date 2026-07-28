import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceRoleGuard],
})
export class WorkspacesModule {}
