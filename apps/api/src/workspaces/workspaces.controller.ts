import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SafeUser } from '../auth/auth.service';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller('api/workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: SafeUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto.name);
  }

  @Get(':id/projects')
  @UseGuards(WorkspaceRoleGuard)
  listProjects(@Param('id') workspaceId: string) {
    return this.workspaces.listProjects(workspaceId);
  }

  @Post(':id/projects')
  @UseGuards(WorkspaceRoleGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  createProject(
    @Param('id') workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.workspaces.createProject(
      workspaceId,
      dto.name,
      dto.description,
    );
  }
}
